// API Worker - handles all Claude API calls off the main thread

let API_BASE_URL = 'https://api.anthropic.com';
let MODEL = 'claude-sonnet-4-20250514';

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
  apiBaseUrl?: string;
  model?: string;
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

async function callAPI(
  systemPrompt: string,
  apiKey: string,
  agentId: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const apiUrl = `${API_BASE_URL}/v1/messages`;

  // First try streaming
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  // Only add this header for direct Anthropic API calls (not proxied)
  if (API_BASE_URL.includes('anthropic.com')) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        temperature: 0,
        stream: true,
        messages: [{ role: 'user', content: systemPrompt }],
      }),
    });
  } catch (err: any) {
    console.warn(`[Worker] Streaming fetch failed for ${agentId}, trying non-streaming:`, err.message);
    return callAPINonStreaming(systemPrompt, apiKey, agentId, onChunk);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[Worker] API error for ${agentId}: ${response.status}`, errorText);
    // Fallback to non-streaming
    return callAPINonStreaming(systemPrompt, apiKey, agentId, onChunk);
  }

  // Check if we actually got a stream
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('event-stream') && !contentType.includes('text/event-stream')) {
    // Non-streaming response — parse as JSON directly
    const data = await response.json();
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
    onChunk(text);
    return text;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = ''; // Buffer for incomplete SSE lines

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines from buffer
    const lines = buffer.split('\n');
    // Keep the last potentially incomplete line in buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);

        // Handle text deltas (both Anthropic and MiniMax compatible)
        if (parsed.type === 'content_block_delta') {
          const delta = parsed.delta;
          if (delta?.type === 'text_delta' && delta.text) {
            fullText += delta.text;
            onChunk(delta.text);
          } else if (delta?.text && !delta?.type) {
            // Anthropic native format
            fullText += delta.text;
            onChunk(delta.text);
          }
          // Skip thinking_delta, signature_delta etc
        }
      } catch {
        // Malformed JSON chunk — skip
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith('data: ')) {
    const data = buffer.slice(6).trim();
    if (data && data !== '[DONE]') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta') {
          const t = parsed.delta?.text;
          if (t) {
            fullText += t;
            onChunk(t);
          }
        }
      } catch { /* skip */ }
    }
  }

  return fullText;
}

// Fallback: non-streaming API call
async function callAPINonStreaming(
  systemPrompt: string,
  apiKey: string,
  agentId: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const apiUrl = `${API_BASE_URL}/v1/messages`;

  const nsHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (API_BASE_URL.includes('anthropic.com')) {
    nsHeaders['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: nsHeaders,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: systemPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.find((c: any) => c.type === 'text')?.text || '';

  // Simulate streaming by sending text in chunks
  const chunkSize = 20;
  for (let i = 0; i < text.length; i += chunkSize) {
    onChunk(text.slice(i, i + chunkSize));
  }

  return text;
}

function parseAgentResponse(text: string, agentId: string, round: number): any {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in: ' + text.slice(0, 100));
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
    return {
      agentId,
      round,
      stance: 'neutral' as const,
      impactScore: 0,
      publicStatement: text || '（AI 响应为空）',
      privateThought: '（JSON 解析失败）',
      actions: [],
      allianceIntent: [],
      oppositionIntent: [],
      ruleExploitation: '',
      spawnSubAgents: [],
    };
  }
}

// Main worker message handler
self.onmessage = async (event: MessageEvent) => {
  const { type, ...data } = event.data;

  if (type === 'START_ROUND') {
    const config = data as RoundConfig;
    const { agents, policy, roundContext, round, apiKey, apiBaseUrl, model, maxConcurrency } = config;
    if (apiBaseUrl) API_BASE_URL = apiBaseUrl;
    if (model) MODEL = model;

    console.log(`[Worker] Starting round ${round} with ${agents.length} agents, model=${MODEL}, base=${API_BASE_URL}`);

    // Run agents with concurrency limit
    const semaphore = { active: 0 };
    const allDone: Promise<void>[] = [];

    for (const agent of agents) {
      // Wait if at concurrency limit
      while (semaphore.active >= maxConcurrency) {
        await new Promise(r => setTimeout(r, 50));
      }

      semaphore.active++;

      const task = (async () => {
        try {
          // Notify main thread that this agent started streaming
          self.postMessage({
            type: 'AGENT_STREAM_CHUNK',
            agentId: agent.id,
            chunk: '',
          });

          const prompt = buildAgentPrompt(agent, policy, roundContext);
          const fullText = await callAPI(prompt, apiKey, agent.id, (chunk) => {
            self.postMessage({
              type: 'AGENT_STREAM_CHUNK',
              agentId: agent.id,
              chunk,
            });
          });

          console.log(`[Worker] Agent ${agent.id} done, got ${fullText.length} chars`);

          const response = parseAgentResponse(fullText, agent.id, round);
          self.postMessage({
            type: 'AGENT_COMPLETE',
            agentId: agent.id,
            response,
          });
        } catch (err: any) {
          console.error(`[Worker] Agent ${agent.id} failed:`, err);
          self.postMessage({
            type: 'ERROR',
            agentId: agent.id,
            error: `Agent ${agent.name} failed: ${err.message}`,
          });
          // Still send a fallback complete so the UI doesn't hang
          self.postMessage({
            type: 'AGENT_COMPLETE',
            agentId: agent.id,
            response: {
              agentId: agent.id,
              round,
              stance: 'neutral',
              impactScore: 0,
              publicStatement: `[API 调用失败] ${err.message}`,
              privateThought: '',
              actions: [],
              allianceIntent: [],
              oppositionIntent: [],
              ruleExploitation: '',
              spawnSubAgents: [],
            },
          });
        } finally {
          semaphore.active--;
        }
      })();

      allDone.push(task);
    }

    await Promise.all(allDone);
    self.postMessage({ type: 'ROUND_COMPLETE', round });
  }
};
