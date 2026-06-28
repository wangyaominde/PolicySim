import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  Agent,
  AdvisoryEvent,
  DecisionSynthesis,
  RoleReview,
  Verdict,
} from '../types';
import { useAgentStore, useAdvisoryStore, useUIStore, useHistoryStore } from '../stores';
import {
  RoleReviewCard,
  DecisionSynthesisCard,
  ConsensusPanel,
  VerdictChip,
} from '../components/advisory';
import { VERDICT_META } from '../components/advisory/verdictMeta';

/* ------------------------------------------------------------------ */
/*  Markdown export                                                     */
/* ------------------------------------------------------------------ */

function buildMarkdown(
  question: string,
  options: string[],
  synthesis: DecisionSynthesis | null,
  reviews: RoleReview[],
  agents: Agent[],
): string {
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
  const lines: string[] = [];
  lines.push(`# 决策评审报告`, '');
  lines.push(`## 决策任务`, question, '');
  if (options.length) {
    lines.push(`### 候选方案`);
    options.forEach((o, i) => lines.push(`- ${String.fromCharCode(65 + i)}) ${o}`));
    lines.push('');
  }
  if (synthesis) {
    lines.push(`## 统一决策建议`, `**${synthesis.decision}**`, '');
    if (synthesis.recommendedOption) lines.push(`推荐方案：${synthesis.recommendedOption}`, '');
    lines.push(
      `- 共识度：${Math.round(synthesis.consensusLevel * 100)}% ｜ 信心：${Math.round(synthesis.confidence * 100)}%`,
      '',
    );
    if (synthesis.summary) lines.push(`### 执行摘要`, synthesis.summary, '');
    if (synthesis.rationale) lines.push(`### 核心理由`, synthesis.rationale, '');
    const block = (title: string, items: string[]) => {
      if (!items.length) return;
      lines.push(`### ${title}`);
      items.forEach((it) => lines.push(`- ${it}`));
      lines.push('');
    };
    block('共识', synthesis.agreements);
    block('分歧 / 需权衡', synthesis.disagreements);
    block('主要风险', synthesis.risks);
    block('下一步行动', synthesis.actionItems);
    block('待补充信息', synthesis.openQuestions);
  }
  lines.push(`## 各角色独立意见`, '');
  for (const r of reviews) {
    lines.push(`### ${name(r.agentId)}（${VERDICT_META[r.verdict].label}，信心 ${Math.round(r.confidence * 100)}%）`);
    if (r.headline) lines.push(r.headline);
    if (r.recommendation) lines.push('', r.recommendation);
    if (r.keyPoints.length) {
      lines.push('', '关键观察：');
      r.keyPoints.forEach((p) => lines.push(`- ${p}`));
    }
    if (r.concerns.length) {
      lines.push('', '顾虑：');
      r.concerns.forEach((c) => lines.push(`- ${c}`));
    }
    lines.push('');
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Mock fallback (used when no API key is configured)                 */
/* ------------------------------------------------------------------ */

function mockReview(agent: Agent): RoleReview {
  const lean = agent.values.innovation + agent.values.economy - agent.values.stability;
  const verdict: Verdict =
    lean > 0.7 ? 'lean_yes' : lean < -0.3 ? 'lean_no' : 'neutral';
  return {
    agentId: agent.id,
    verdict,
    confidence: 0.5 + Math.random() * 0.3,
    headline: `从「${agent.name}」的视角，这份资料${verdict === 'lean_yes' ? '总体可行但需谨慎' : verdict === 'lean_no' ? '存在明显隐忧' : '利弊参半'}。`,
    keyPoints: [
      `结合自身关注点（${agent.strategy}），关注资料中与切身利益相关的部分。`,
      '资料的关键数据需要进一步核实其来源与时效。',
    ],
    concerns: verdict === 'lean_no' ? ['潜在成本与风险被低估', '缺乏可执行的落地路径'] : ['执行细节仍不清晰'],
    recommendation: '建议在补充关键信息后再做最终决定，并设置阶段性复盘节点。',
    evidence: [],
    status: 'done',
  };
}

function mockSynthesis(reviews: RoleReview[]): DecisionSynthesis {
  const tally: Partial<Record<Verdict, number>> = {};
  for (const r of reviews) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  const yes = (tally.lean_yes || 0) + (tally.strong_yes || 0);
  const no = (tally.lean_no || 0) + (tally.strong_no || 0);
  return {
    decision:
      yes > no
        ? '倾向推进，但建议先小范围试点并补齐关键信息。'
        : no > yes
        ? '建议暂缓，待关键风险得到缓解后再评估。'
        : '意见分化，建议先补充信息、明确边界条件后再决策。',
    confidence: 0.6,
    consensusLevel: reviews.length ? Math.max(yes, no) / reviews.length : 0,
    summary: '各角色在「需要更多信息」上高度一致，但在是否立即推进上存在分歧。整体建议以低风险、可回退的方式推进。',
    rationale: '在收益不确定、风险可控的前提下，分阶段推进既能保留选项，又能控制下行风险。',
    agreements: ['关键数据需要进一步核实', '应设置阶段性复盘节点'],
    disagreements: ['是否立即全面推进', '资源投入的优先级'],
    risks: ['信息不充分导致误判', '执行落地路径不清晰'],
    actionItems: ['补齐关键数据与来源', '制定小范围试点方案', '设定明确的决策复盘时间点'],
    openQuestions: ['预算与时间约束的硬上限是多少？', '失败时的回退成本有多大？'],
    voteTally: tally,
  };
}

/* ------------------------------------------------------------------ */
/*  Left column                                                         */
/* ------------------------------------------------------------------ */

function statusLabel(status: string): { text: string; cls: string } {
  switch (status) {
    case 'reading': return { text: '各角色阅读中', cls: 'bg-blue-500/20 text-blue-400' };
    case 'synthesizing': return { text: '综合意见中', cls: 'bg-amber-500/20 text-amber-400' };
    case 'completed': return { text: '已完成', cls: 'bg-primary/20 text-primary' };
    case 'error': return { text: '出错', cls: 'bg-red-500/20 text-red-400' };
    default: return { text: '准备中', cls: 'bg-zinc-500/20 text-zinc-400' };
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdvisoryPage() {
  const navigate = useNavigate();

  const config = useAdvisoryStore((s) => s.config);
  const startAdvisory = useAdvisoryStore((s) => s.startAdvisory);
  const reviews = useAdvisoryStore((s) => s.reviews);
  const streamingReviews = useAdvisoryStore((s) => s.streamingReviews);
  const synthesis = useAdvisoryStore((s) => s.synthesis);
  const status = useAdvisoryStore((s) => s.status);
  const error = useAdvisoryStore((s) => s.error);
  const appendReviewChunk = useAdvisoryStore((s) => s.appendReviewChunk);
  const addReview = useAdvisoryStore((s) => s.addReview);
  const setSynthesis = useAdvisoryStore((s) => s.setSynthesis);
  const setStatus = useAdvisoryStore((s) => s.setStatus);
  const setError = useAdvisoryStore((s) => s.setError);

  const presetAgents = useAgentStore((s) => s.agents);
  const customAgents = useAgentStore((s) => s.customAgents);
  const apiKey = useUIStore((s) => s.apiKey);
  const apiBaseUrl = useUIStore((s) => s.apiBaseUrl);
  const model = useUIStore((s) => s.model);

  const allAgents = useMemo(() => [...presetAgents, ...customAgents], [presetAgents, customAgents]);
  const roles = useMemo(
    () => (config ? config.roleIds.map((id) => allAgents.find((a) => a.id === id)).filter(Boolean) as Agent[] : []),
    [config, allAgents],
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Bumping runKey re-triggers the pipeline (used by the retry button).
  const [runKey, setRunKey] = useState(0);
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Kick off the pipeline once per mount. A per-run `cancelled` flag (captured
  // in this closure) makes it StrictMode-safe: the first run is fully cancelled
  // by its own cleanup and can't race the second run. The status guard avoids
  // restarting an already-finished run when remounting (e.g. browser Back).
  useEffect(() => {
    if (!config) return;
    if (synthesis || status === 'completed' || status === 'error') return;
    let cancelled = false;
    let worker: Worker | null = null;

    const persistRun = (result: DecisionSynthesis) => {
      useHistoryStore.getState().saveRun({
        id: config.id,
        kind: 'advisory',
        title: config.task.question,
        createdAt: config.createdAt,
        task: config.task,
        documentMeta: config.documents.map((d) => ({ name: d.name, charCount: d.charCount })),
        roleIds: config.roleIds,
        reviews: useAdvisoryStore.getState().reviews,
        synthesis: result,
      });
    };

    const runMock = async () => {
      for (const role of roles) {
        if (cancelled) return;
        appendReviewChunk(role.id, '');
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));
        if (cancelled) return;
        addReview(mockReview(role));
      }
      if (cancelled) return;
      setStatus('synthesizing');
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled) return;
      const result = mockSynthesis(useAdvisoryStore.getState().reviews);
      setSynthesis(result);
      persistRun(result);
    };

    const runReal = () => {
      worker = new Worker(new URL('../workers/advisory.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e: MessageEvent) => {
        if (cancelled) return;
        const msg = e.data as AdvisoryEvent;
        switch (msg.type) {
          case 'REVIEW_STREAM_CHUNK': appendReviewChunk(msg.agentId, msg.chunk); break;
          case 'REVIEW_COMPLETE': addReview(msg.review); break;
          case 'ALL_REVIEWS_COMPLETE': setStatus('synthesizing'); break;
          case 'SYNTHESIS_STREAM_CHUNK': setStatus('synthesizing'); break;
          case 'SYNTHESIS_COMPLETE': setSynthesis(msg.synthesis); persistRun(msg.synthesis); break;
          case 'ADVISORY_ERROR': setError(msg.error); break;
        }
      };
      // Surface worker-level failures (module load error, uncaught exception)
      // so the UI doesn't hang on a silent spinner.
      worker.onerror = (e) => {
        if (cancelled) return;
        setError(e.message || '后台分析进程出错');
        setStatus('error');
      };
      worker.onmessageerror = () => {
        if (cancelled) return;
        setError('后台分析进程通信失败');
        setStatus('error');
      };
      worker.postMessage({
        type: 'START_REVIEW',
        roles,
        task: config.task,
        documents: config.documents
          .filter((d) => d.status === 'ready')
          .map((d) => ({ id: d.id, name: d.name, content: d.content })),
        apiKey,
        apiBaseUrl,
        model,
        maxConcurrency: 4,
      });
    };

    if (apiKey) runReal();
    else runMock();

    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = useCallback(() => {
    if (!config) return;
    startAdvisory(config); // resets reviews/synthesis/status → 'reading'
    setRunKey((k) => k + 1);
  }, [config, startAdvisory]);

  const handleExport = useCallback(() => {
    if (!config) return;
    const md = buildMarkdown(config.task.question, config.task.options, synthesis, reviews, allAgents);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-review-${config.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [config, synthesis, reviews, allAgents]);

  // No config → likely a direct navigation / refresh.
  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-on-surface-variant gap-4">
        <p className="text-sm">没有正在进行的决策评审。</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium"
        >
          返回首页
        </button>
      </div>
    );
  }

  const sl = statusLabel(status);
  const reviewMap = new Map(reviews.map((r) => [r.agentId, r]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-6">
      {/* ===================== LEFT ===================== */}
      <aside className="rounded-lg bg-surface-container-low p-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        {/* Task */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🧭</span>
            <h3 className="font-headline text-sm text-on-surface font-semibold">决策任务</h3>
          </div>
          <p className="text-xs text-on-surface leading-relaxed bg-surface-container rounded-md p-3">
            {config.task.question}
          </p>
          {config.task.options.length > 0 && (
            <div className="mt-2 space-y-1">
              {config.task.options.map((o, i) => (
                <div key={i} className="text-[11px] text-on-surface-variant flex gap-1.5">
                  <span className="text-primary font-medium">{String.fromCharCode(65 + i)})</span>
                  <span>{o}</span>
                </div>
              ))}
            </div>
          )}
          {config.task.context && (
            <p className="mt-2 text-[11px] text-on-surface-variant/80 italic">
              背景：{config.task.context}
            </p>
          )}
          <div className="mt-3">
            <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${sl.cls}`}>
              {sl.text}
            </span>
          </div>
        </div>

        {/* Documents */}
        <div className="mb-5 border-t border-white/5 pt-4">
          <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-2">
            资料文件 ({config.documents.length})
          </h4>
          <ul className="space-y-1.5">
            {config.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs">
                <span className="shrink-0">📄</span>
                <span className="truncate text-on-surface flex-1">{d.name}</span>
                <span className="text-[10px] text-on-surface-variant font-mono shrink-0">
                  {(d.charCount / 1000).toFixed(1)}k
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Roles */}
        <div className="border-t border-white/5 pt-4">
          <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-2">
            评审角色 ({roles.length})
          </h4>
          <ul className="space-y-1">
            {roles.map((role) => {
              const r = reviewMap.get(role.id);
              return (
                <li key={role.id} className="flex items-center gap-2 px-1 py-1">
                  <span className="text-base">{role.avatar}</span>
                  <span className="text-xs text-on-surface truncate flex-1">{role.name}</span>
                  {r ? (
                    <VerdictChip verdict={r.verdict} />
                  ) : streamingReviews[role.id] !== undefined ? (
                    <span className="text-[9px] text-primary animate-pulse">阅读中</span>
                  ) : (
                    <span className="text-[9px] text-on-surface-variant/50">待命</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* ===================== CENTER ===================== */}
      <main className="min-w-0">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline text-lg text-on-surface font-semibold">决策评审工作台</h2>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            + 新建评审
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <span className="text-red-400 mt-0.5">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300 font-medium">
                {status === 'error' ? '分析失败' : '部分分析出现问题'}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5 break-words">{error}</p>
            </div>
            {status === 'error' && (
              <button
                onClick={handleRetry}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors"
              >
                重试
              </button>
            )}
          </div>
        )}

        {/* Unified decision (top) */}
        <DecisionSynthesisCard
          synthesis={synthesis}
          task={config.task}
          synthesizing={status === 'synthesizing'}
          onExport={status === 'completed' ? handleExport : undefined}
        />

        {/* Role reviews */}
        <div className="flex items-center gap-2 mb-3 mt-2">
          <h3 className="text-[11px] uppercase tracking-widest text-on-surface-variant font-medium">
            各角色独立意见
          </h3>
          <span className="text-[11px] text-on-surface-variant/60">
            {reviews.length}/{roles.length}
          </span>
        </div>

        {roles.map((role) => (
          <RoleReviewCard
            key={role.id}
            agent={role}
            review={reviewMap.get(role.id)}
            streamingText={streamingReviews[role.id]}
            isExpanded={expanded.has(role.id)}
            onToggle={() => toggleExpand(role.id)}
          />
        ))}
      </main>

      {/* ===================== RIGHT ===================== */}
      <aside className="rounded-lg bg-surface-container-low p-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <h3 className="font-headline text-sm text-on-surface font-semibold mb-4">汇总看板</h3>
        <ConsensusPanel reviews={reviews} agents={allAgents} totalRoles={roles.length} />
      </aside>
    </div>
  );
}
