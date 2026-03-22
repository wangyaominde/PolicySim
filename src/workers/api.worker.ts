// API Worker - handles all Claude API calls off the main thread
// Uses fetch directly since we can't use the SDK in a Worker

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

interface AgentConfig {
  id: string;
  name: string;
  avatar: string;
  role: string;
  values: Record<string, number>;
  resources: string[];
  influence: number;
  strategy: string;
  allies: string[];
  rivals: string[];
  subAgentSlots: any[];
}

interface RoundConfig {
  agents: AgentConfig[];
  policy: string;
  roundContext: string;
  round: number;
  apiKey: string;
  maxConcurrency: number;
}

function buildAgentPrompt(agent: AgentConfig, policy: string, roundContext: string): string {
  return `你是 ${agent.name}，${agent.role}。

你的核心价值观权重：economy=${agent.values.economy}, stability=${agent.values.stability}, environment=${agent.values.environment}, innovation=${agent.values.innovation}, equality=${agent.values.equality}
你掌握的资源：${agent.resources.join('、')}
你的博弈策略风格：${agent.strategy}
你的盟友：${agent.allies.join('、') || '无'}，你的对手：${agent.rivals.join('、') || '无'}

现在政府/市场发布了以下政策/事件：
${policy}

${roundContext ? `上一轮各方反应摘要：\n${roundContext}` : ''}

请以 JSON 格式输出你的反应：
{
  "stance": "support|oppose|neutral|conditional",
  "impact_score": -10到+10的整数,
  "public_statement": "你的公开声明（100-200字）",
  "private_thought": "你的私下真实想法（50-100字）",
  "actions": [{ "type": "lobby|threaten|ally|invest|boycott|observe", "target": "目标agent_id", "description": "行动描述" }],
  "alliance_intent": [{ "agent_id": "想结盟的agent_id", "reason": "原因" }],
  "opposition_intent": [{ "agent_id": "想对抗的agent_id", "reason": "原因" }],
  "rule_exploitation": "发现的规则漏洞或套利空间",
  "spawn_subagents": [{ "slot_id": "子智能体槽位id", "task": "具体任务指令", "priority": "high|normal|low" }]
}

只输出 JSON，不要加其他文字。`;
}

async function callClaudeAPI(
  systemPrompt: string,
  apiKey: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      stream: true,
      messages: [{ role: 'user', content: systemPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text;
            onChunk(parsed.delta.text);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  return fullText;
}

function parseAgentResponse(text: string, agentId: string, round: number): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      agentId,
      round,
      stance: parsed.stance || 'neutral',
      impactScore: parsed.impact_score || 0,
      publicStatement: parsed.public_statement || '',
      privateThought: parsed.private_thought || '',
      actions: (parsed.actions || []).map((a: any) => ({
        type: a.type || 'observe',
        target: a.target || '',
        description: a.description || '',
      })),
      allianceIntent: (parsed.alliance_intent || []).map((i: any) => ({
        agentId: i.agent_id || '',
        reason: i.reason || '',
      })),
      oppositionIntent: (parsed.opposition_intent || []).map((i: any) => ({
        agentId: i.agent_id || '',
        reason: i.reason || '',
      })),
      ruleExploitation: parsed.rule_exploitation || '',
      spawnSubAgents: (parsed.spawn_subagents || []).map((s: any) => ({
        slotId: s.slot_id || '',
        task: s.task || '',
        priority: s.priority || 'normal',
      })),
    };
  } catch (e) {
    // Return a fallback response if JSON parsing fails
    return {
      agentId,
      round,
      stance: 'neutral' as const,
      impactScore: 0,
      publicStatement: text.slice(0, 200),
      privateThought: '（解析失败，原始文本已保留）',
      actions: [],
      allianceIntent: [],
      oppositionIntent: [],
      ruleExploitation: '',
      spawnSubAgents: [],
    };
  }
}

// Limit concurrency
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const running: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(
      value => { results.push({ status: 'fulfilled', value }); },
      reason => { results.push({ status: 'rejected', reason }); }
    );
    running.push(promise);

    if (running.length >= maxConcurrency) {
      await Promise.race(running);
      // Remove completed promises
      running.splice(0, running.length, ...running.filter(p => {
        let resolved = false;
        p.then(() => { resolved = true; });
        return !resolved;
      }));
    }
  }

  await Promise.all(running);
  return results;
}

// Main worker interface exposed via postMessage
self.onmessage = async (event: MessageEvent) => {
  const { type, ...data } = event.data;

  if (type === 'START_ROUND') {
    const config = data as RoundConfig;
    const { agents, policy, roundContext, round, apiKey, maxConcurrency } = config;

    const tasks = agents.map(agent => async () => {
      const prompt = buildAgentPrompt(agent, policy, roundContext);

      const fullText = await callClaudeAPI(prompt, apiKey, (chunk) => {
        self.postMessage({
          type: 'AGENT_STREAM_CHUNK',
          agentId: agent.id,
          chunk,
        });
      });

      const response = parseAgentResponse(fullText, agent.id, round);

      self.postMessage({
        type: 'AGENT_COMPLETE',
        agentId: agent.id,
        response,
      });

      return response;
    });

    try {
      await runWithConcurrency(tasks, maxConcurrency);
      self.postMessage({ type: 'ROUND_COMPLETE', round });
    } catch (error: any) {
      self.postMessage({ type: 'ERROR', error: error.message });
    }
  }
};
