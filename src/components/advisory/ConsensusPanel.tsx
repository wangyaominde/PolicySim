import { motion } from 'framer-motion';
import type { Agent, RoleReview } from '../../types';
import { VERDICT_META, VERDICT_DISPLAY_ORDER } from './verdictMeta';

export default function ConsensusPanel({
  reviews,
  agents,
  totalRoles,
}: {
  reviews: RoleReview[];
  agents: Agent[];
  totalRoles: number;
}) {
  const done = reviews.length;
  const tally: Record<string, number> = {};
  let scoreSum = 0;
  let confSum = 0;
  for (const r of reviews) {
    tally[r.verdict] = (tally[r.verdict] || 0) + 1;
    scoreSum += VERDICT_META[r.verdict].score;
    confSum += r.confidence;
  }
  // Net sentiment in [-2, 2] → [0, 1] for the diverging meter.
  const net = done > 0 ? scoreSum / done : 0;
  const netPct = ((net + 2) / 4) * 100;
  const avgConf = done > 0 ? confSum / done : 0;

  const sentimentLabel =
    net > 0.75 ? '整体倾向支持'
    : net > 0.15 ? '略偏支持'
    : net < -0.75 ? '整体倾向反对'
    : net < -0.15 ? '略偏反对'
    : '意见分化 / 中立';

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">
            评审进度
          </h4>
          <span className="text-[10px] font-mono text-on-surface-variant">
            {done}/{totalRoles}
          </span>
        </div>
        <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${totalRoles > 0 ? (done / totalRoles) * 100 : 0}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Net sentiment meter */}
      <div>
        <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-2">
          整体倾向
        </h4>
        <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-500/30 via-zinc-500/30 to-emerald-500/30">
          {/* center marker */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
          <motion.div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full bg-on-surface shadow-lg ring-2 ring-surface-container"
            animate={{ left: `${netPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] uppercase tracking-wider text-on-surface-variant/60">
          <span>反对</span>
          <span className="text-on-surface-variant">{sentimentLabel}</span>
          <span>支持</span>
        </div>
      </div>

      {/* Verdict distribution */}
      <div>
        <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-2">
          立场分布
        </h4>
        <div className="space-y-1.5">
          {VERDICT_DISPLAY_ORDER.filter((v) => (tally[v] || 0) > 0).map((v) => {
            const count = tally[v] || 0;
            const meta = VERDICT_META[v];
            const pct = done > 0 ? (count / done) * 100 : 0;
            return (
              <div key={v} className="flex items-center gap-2">
                <span className="text-[11px] text-on-surface-variant w-14 shrink-0">{meta.label}</span>
                <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${meta.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-[10px] font-mono text-on-surface-variant w-4 text-right">{count}</span>
              </div>
            );
          })}
          {done === 0 && (
            <p className="text-[11px] text-on-surface-variant/60">尚无评审结果</p>
          )}
        </div>
      </div>

      {/* Avg confidence */}
      {done > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">
              平均信心
            </h4>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {Math.round(avgConf * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-tertiary rounded-full"
              animate={{ width: `${avgConf * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Per-role verdicts */}
      {done > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-2">
            各角色立场
          </h4>
          <ul className="space-y-1.5">
            {reviews.map((r) => {
              const agent = agents.find((a) => a.id === r.agentId);
              const meta = VERDICT_META[r.verdict];
              return (
                <li key={r.agentId} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{agent?.avatar ?? '👤'}</span>
                  <span className="text-[11px] text-on-surface truncate flex-1">{agent?.name ?? r.agentId}</span>
                  <span className={`text-[10px] font-medium ${meta.text}`}>{meta.short}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
