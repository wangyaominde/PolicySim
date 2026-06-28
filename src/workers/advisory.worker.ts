// Advisory worker — runs the document Decision Review off the main thread.
//   1. Each selected role reads the documents through its own lens and returns
//      a structured review (streamed).
//   2. A neutral facilitator synthesizes all reviews into one unified
//      decision brief (streamed).

import { callLLM, extractJsonObject, type LlmConfig } from './llmClient';
import type {
  Agent,
  AdvisoryTask,
  DecisionSynthesis,
  DocumentPayload,
  RoleReview,
  Verdict,
} from '../types';

const VALID_VERDICTS: Verdict[] = [
  'strong_yes', 'lean_yes', 'neutral', 'lean_no', 'strong_no', 'need_info',
];

// Combined document budget across all files for one model call. Sized for
// MiniMax-M3's 1M-token context, leaving generous headroom for the prompt,
// the model's reasoning, and the JSON output.
const MAX_DOC_CHARS = 800_000;

interface StartReviewMsg {
  type: 'START_REVIEW';
  roles: Agent[];
  task: AdvisoryTask;
  documents: DocumentPayload[];
  apiKey: string;
  apiBaseUrl?: string;
  model?: string;
  maxConcurrency: number;
}

interface SynthesizeMsg {
  type: 'SYNTHESIZE';
  reviews: RoleReview[];
  roleNames: Record<string, string>;
  task: AdvisoryTask;
  apiKey: string;
  apiBaseUrl?: string;
  model?: string;
}

/* ----------------------------- helpers ----------------------------- */

function clampVerdict(v: unknown): Verdict {
  return VALID_VERDICTS.includes(v as Verdict) ? (v as Verdict) : 'neutral';
}

function clamp01(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!isFinite(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : String(x))).filter(Boolean);
}

function buildDocBlock(documents: DocumentPayload[]): string {
  let used = 0;
  const blocks: string[] = [];
  for (const doc of documents) {
    if (!doc.content) continue;
    const header = `===== 文件：${doc.name} =====\n`;
    const remaining = MAX_DOC_CHARS - used - header.length;
    if (remaining <= 200) break;
    let body = doc.content;
    if (body.length > remaining) body = body.slice(0, remaining) + '\n…（已截断）';
    const block = header + body;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join('\n\n');
}

function buildTaskBlock(task: AdvisoryTask): string {
  let block = `决策任务 / 问题：\n${task.question}`;
  if (task.options && task.options.length > 0) {
    const opts = task.options
      .map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`)
      .join('\n');
    block += `\n\n候选方案：\n${opts}`;
  }
  if (task.context && task.context.trim()) {
    block += `\n\n补充背景：\n${task.context.trim()}`;
  }
  return block;
}

function buildReviewPrompt(role: Agent, task: AdvisoryTask, docBlock: string): string {
  const v = role.values;
  const optionLine =
    task.options && task.options.length > 0
      ? `  "option_preference": "如果有候选方案，你最倾向哪个（写方案字母或名称），否则留空",\n`
      : '';
  return `你是「${role.name}」，${role.role}

你的价值观权重：经济=${v.economy} 稳定=${v.stability} 环境=${v.environment} 创新=${v.innovation} 公平=${v.equality}
你的行事策略：${role.strategy}
你掌握的资源：${role.resources.join('、') || '无'}

现在请你**以这个角色的立场和专业视角**，仔细阅读下面的资料，并就给定的决策任务给出你的判断。

${buildTaskBlock(task)}

需要审阅的资料如下：
${docBlock || '（未提供文件，仅根据任务问题判断）'}

请基于资料内容（而非空泛常识）作答，引用资料中的具体信息支撑你的观点。以严格 JSON 输出，不要输出任何 JSON 以外的文字：
{
  "verdict": "strong_yes|lean_yes|neutral|lean_no|strong_no|need_info（你对该决策的总体倾向）",
  "confidence": 0到1之间的小数（你对自己判断的信心）,
  "headline": "一句话核心结论（30字内）",
  "key_points": ["你从你的视角注意到的3-5个关键点，结合资料具体内容"],
  "concerns": ["你担心的风险或反对理由（可为空数组）"],
  "recommendation": "你给决策者的具体建议（2-4句）",
  "evidence": [{ "quote": "资料中的关键原文片段（简短）", "note": "为什么这条重要" }],
${optionLine}}`;
}

function parseReview(text: string, agentId: string): RoleReview {
  try {
    const p = extractJsonObject(text) as Record<string, unknown>;
    return {
      agentId,
      verdict: clampVerdict(p.verdict),
      confidence: clamp01(p.confidence),
      headline: typeof p.headline === 'string' ? p.headline : '',
      keyPoints: asStringArray(p.key_points),
      concerns: asStringArray(p.concerns),
      recommendation: typeof p.recommendation === 'string' ? p.recommendation : '',
      evidence: Array.isArray(p.evidence)
        ? (p.evidence as Record<string, unknown>[])
            .map((e) => ({
              quote: typeof e?.quote === 'string' ? e.quote : '',
              note: typeof e?.note === 'string' ? e.note : '',
            }))
            .filter((e) => e.quote || e.note)
        : [],
      optionPreference:
        typeof p.option_preference === 'string' && p.option_preference.trim()
          ? p.option_preference.trim()
          : undefined,
      status: 'done',
    };
  } catch {
    return {
      agentId,
      verdict: 'neutral',
      confidence: 0.3,
      headline: '（解析失败）',
      keyPoints: [],
      concerns: [],
      recommendation: text.slice(0, 500) || '（AI 响应为空）',
      evidence: [],
      status: 'error',
    };
  }
}

function computeVoteTally(reviews: RoleReview[]): Partial<Record<Verdict, number>> {
  const tally: Partial<Record<Verdict, number>> = {};
  for (const r of reviews) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  return tally;
}

function buildSynthesisPrompt(
  reviews: RoleReview[],
  roleNames: Record<string, string>,
  task: AdvisoryTask,
): string {
  const verdictLabel: Record<Verdict, string> = {
    strong_yes: '强烈支持',
    lean_yes: '倾向支持',
    neutral: '中立',
    lean_no: '倾向反对',
    strong_no: '强烈反对',
    need_info: '信息不足',
  };

  const reviewsBlock = reviews
    .map((r) => {
      const name = roleNames[r.agentId] || r.agentId;
      const parts = [
        `### ${name}（倾向：${verdictLabel[r.verdict]}，信心 ${Math.round(r.confidence * 100)}%）`,
        `核心结论：${r.headline}`,
      ];
      if (r.keyPoints.length) parts.push(`关键点：${r.keyPoints.join('；')}`);
      if (r.concerns.length) parts.push(`顾虑：${r.concerns.join('；')}`);
      if (r.recommendation) parts.push(`建议：${r.recommendation}`);
      if (r.optionPreference) parts.push(`倾向方案：${r.optionPreference}`);
      return parts.join('\n');
    })
    .join('\n\n');

  const optionField =
    task.options && task.options.length > 0
      ? `  "recommended_option": "在候选方案中你最终推荐的那个（方案字母或名称）",\n`
      : '';

  return `你是一位**中立、务实的首席决策顾问 / 主持人**。下面是多位不同立场角色针对同一份资料和同一个决策任务给出的独立评审意见。你的任务是把这些意见综合成一份能帮助决策者**直接拍板**的统一决策简报。

${buildTaskBlock(task)}

各角色的独立评审意见：
${reviewsBlock}

要求：
- 给出**明确**的决策建议，不要和稀泥、不要含糊其辞。
- 诚实呈现共识与分歧：哪些点大家一致，哪些点存在冲突需要权衡。
- 兼顾各角色的核心关切，尤其是高信心的反对意见。
- 给出可执行的下一步，以及还缺什么信息。

以严格 JSON 输出，不要输出任何 JSON 以外的文字：
{
  "decision": "一句话明确的最终决策建议（拍板结论）",
${optionField}  "confidence": 0到1之间的小数（你对该建议的总体信心）,
  "consensus_level": 0到1之间的小数（各角色意见的一致程度，0=高度分裂，1=高度一致）,
  "summary": "执行摘要（3-5句，让决策者快速理解结论和理由）",
  "rationale": "做出该建议的核心理由",
  "agreements": ["各方达成共识的要点"],
  "disagreements": ["存在分歧、需要决策者权衡的要点"],
  "risks": ["主要风险"],
  "action_items": ["建议的下一步具体行动"],
  "open_questions": ["还需要补充的信息 / 未决问题"]
}`;
}

function parseSynthesis(text: string, voteTally: Partial<Record<Verdict, number>>): DecisionSynthesis {
  try {
    const p = extractJsonObject(text) as Record<string, unknown>;
    return {
      decision: typeof p.decision === 'string' ? p.decision : '',
      recommendedOption:
        typeof p.recommended_option === 'string' && p.recommended_option.trim()
          ? p.recommended_option.trim()
          : undefined,
      confidence: clamp01(p.confidence),
      consensusLevel: clamp01(p.consensus_level),
      summary: typeof p.summary === 'string' ? p.summary : '',
      rationale: typeof p.rationale === 'string' ? p.rationale : '',
      agreements: asStringArray(p.agreements),
      disagreements: asStringArray(p.disagreements),
      risks: asStringArray(p.risks),
      actionItems: asStringArray(p.action_items),
      openQuestions: asStringArray(p.open_questions),
      voteTally,
    };
  } catch {
    return {
      decision: '（综合解析失败）',
      confidence: 0.3,
      consensusLevel: 0,
      summary: text.slice(0, 500) || '（AI 响应为空）',
      rationale: '',
      agreements: [],
      disagreements: [],
      risks: [],
      actionItems: [],
      openQuestions: [],
      voteTally,
    };
  }
}

/* --------------------------- orchestration -------------------------- */

async function runReviews(msg: StartReviewMsg): Promise<RoleReview[]> {
  const config: LlmConfig = {
    apiKey: msg.apiKey,
    apiBaseUrl: msg.apiBaseUrl || 'https://api.anthropic.com',
    model: msg.model || 'claude-sonnet-4-20250514',
  };
  const docBlock = buildDocBlock(msg.documents);
  const concurrency = Math.max(1, msg.maxConcurrency || 4);

  const reviews: RoleReview[] = [];
  const semaphore = { active: 0 };
  const tasks: Promise<void>[] = [];

  for (const role of msg.roles) {
    while (semaphore.active >= concurrency) {
      await new Promise((r) => setTimeout(r, 40));
    }
    semaphore.active++;

    const task = (async () => {
      try {
        self.postMessage({ type: 'REVIEW_STREAM_CHUNK', agentId: role.id, chunk: '' });
        const prompt = buildReviewPrompt(role, msg.task, docBlock);
        const fullText = await callLLM(prompt, config, {
          label: `review:${role.id}`,
          // Reasoning models (e.g. MiniMax-M3) spend a large slice of the budget
          // on hidden thinking; give the JSON answer plenty of headroom.
          maxTokens: 16000,
          onChunk: (chunk) =>
            self.postMessage({ type: 'REVIEW_STREAM_CHUNK', agentId: role.id, chunk }),
        });
        const review = parseReview(fullText, role.id);
        reviews.push(review);
        self.postMessage({ type: 'REVIEW_COMPLETE', agentId: role.id, review });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'ADVISORY_ERROR', agentId: role.id, error: message });
        const fallback: RoleReview = {
          agentId: role.id,
          verdict: 'need_info',
          confidence: 0,
          headline: '审阅失败',
          keyPoints: [],
          concerns: [`[API 调用失败] ${message}`],
          recommendation: '',
          evidence: [],
          status: 'error',
        };
        reviews.push(fallback);
        self.postMessage({ type: 'REVIEW_COMPLETE', agentId: role.id, review: fallback });
      } finally {
        semaphore.active--;
      }
    })();
    tasks.push(task);
  }

  await Promise.all(tasks);
  return reviews;
}

async function runSynthesis(
  reviews: RoleReview[],
  roleNames: Record<string, string>,
  task: AdvisoryTask,
  config: LlmConfig,
): Promise<void> {
  const voteTally = computeVoteTally(reviews);
  try {
    const prompt = buildSynthesisPrompt(reviews, roleNames, task);
    const fullText = await callLLM(prompt, config, {
      label: 'synthesis',
      maxTokens: 14000,
      onChunk: (chunk) => self.postMessage({ type: 'SYNTHESIS_STREAM_CHUNK', chunk }),
    });
    const synthesis = parseSynthesis(fullText, voteTally);
    self.postMessage({ type: 'SYNTHESIS_COMPLETE', synthesis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'ADVISORY_ERROR', error: `综合阶段失败：${message}` });
    self.postMessage({
      type: 'SYNTHESIS_COMPLETE',
      synthesis: parseSynthesis('', voteTally),
    });
  }
}

/* ----------------------------- entry ------------------------------- */

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as StartReviewMsg | SynthesizeMsg;

  if (msg.type === 'START_REVIEW') {
    const config: LlmConfig = {
      apiKey: msg.apiKey,
      apiBaseUrl: msg.apiBaseUrl || 'https://api.anthropic.com',
      model: msg.model || 'claude-sonnet-4-20250514',
    };
    const reviews = await runReviews(msg);
    self.postMessage({ type: 'ALL_REVIEWS_COMPLETE' });

    const roleNames: Record<string, string> = {};
    for (const role of msg.roles) roleNames[role.id] = role.name;
    await runSynthesis(reviews, roleNames, msg.task, config);
  } else if (msg.type === 'SYNTHESIZE') {
    const config: LlmConfig = {
      apiKey: msg.apiKey,
      apiBaseUrl: msg.apiBaseUrl || 'https://api.anthropic.com',
      model: msg.model || 'claude-sonnet-4-20250514',
    };
    await runSynthesis(msg.reviews, msg.roleNames, msg.task, config);
  }
};
