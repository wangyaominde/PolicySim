import { motion } from 'framer-motion';
import type { AdvisoryTask, DecisionSynthesis } from '../../types';

function Gauge({ value, label, accent }: { value: number; label: string; accent: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-container-highest" />
          <motion.circle
            cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
            className={accent}
            stroke="currentColor"
            strokeDasharray={2 * Math.PI * 15.5}
            initial={{ strokeDashoffset: 2 * Math.PI * 15.5 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 15.5 * (1 - value) }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-on-surface">
          {pct}%
        </span>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-on-surface-variant">{label}</span>
    </div>
  );
}

function ListBlock({
  title, items, icon, tone,
}: {
  title: string;
  items: string[];
  icon: string;
  tone: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className={`text-[10px] uppercase tracking-widest font-medium mb-1.5 ${tone}`}>{title}</h4>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-on-surface-variant flex gap-2 leading-relaxed">
            <span className={`mt-0.5 shrink-0 ${tone}`}>{icon}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Card shown while the facilitator is still synthesizing. */
function SynthesizingCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-surface-container p-6 mb-6"
    >
      <div className="flex items-center gap-3">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="text-2xl"
        >
          🧭
        </motion.span>
        <div>
          <h3 className="font-headline text-base text-on-surface font-semibold">
            正在综合各方意见，形成统一决策…
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            主持人正在权衡共识与分歧，准备帮你拍板
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.15 }}
            className="h-1.5 flex-1 rounded-full bg-primary/50"
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function DecisionSynthesisCard({
  synthesis,
  task,
  synthesizing,
  onExport,
}: {
  synthesis: DecisionSynthesis | null;
  task: AdvisoryTask;
  synthesizing: boolean;
  onExport?: () => void;
}) {
  if (!synthesis) {
    return synthesizing ? <SynthesizingCard /> : null;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-surface-container to-surface-container p-6 mb-6 shadow-xl shadow-primary/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🧭</span>
          <div>
            <h3 className="font-headline text-lg font-bold text-voltage">统一决策建议</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">
              {task.question}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Gauge value={synthesis.consensusLevel} label="共识度" accent="text-primary" />
          <Gauge value={synthesis.confidence} label="信心" accent="text-tertiary" />
        </div>
      </div>

      {/* The decision */}
      <div className="rounded-xl bg-surface-container-lowest/60 border border-primary/20 p-4 mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">建议决策</span>
          {synthesis.recommendedOption && (
            <span className="text-[10px] rounded-md bg-primary/15 text-primary px-2 py-0.5">
              推荐：{synthesis.recommendedOption}
            </span>
          )}
        </div>
        <p className="text-xl lg:text-2xl font-headline font-semibold text-on-surface leading-snug tracking-tight">
          {synthesis.decision}
        </p>
        {synthesis.summary && (
          <p className="text-sm text-on-surface-variant leading-relaxed mt-2">{synthesis.summary}</p>
        )}
      </div>

      {/* Rationale */}
      {synthesis.rationale && (
        <div className="border-l-2 border-primary/40 pl-4 mb-4">
          <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-1">核心理由</h4>
          <p className="text-sm text-on-surface leading-relaxed">{synthesis.rationale}</p>
        </div>
      )}

      {/* Agreements vs disagreements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
        <ListBlock title="共识" items={synthesis.agreements} icon="✓" tone="text-emerald-400" />
        <ListBlock title="分歧 / 需权衡" items={synthesis.disagreements} icon="⚖" tone="text-amber-400" />
      </div>

      {/* Risks, actions, open questions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <ListBlock title="主要风险" items={synthesis.risks} icon="⚠" tone="text-red-400" />
        <ListBlock title="下一步行动" items={synthesis.actionItems} icon="→" tone="text-primary" />
        <ListBlock title="待补充信息" items={synthesis.openQuestions} icon="?" tone="text-blue-400" />
      </div>

      {onExport && (
        <div className="mt-5 flex justify-end">
          <button
            onClick={onExport}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
          >
            导出 Markdown
          </button>
        </div>
      )}
    </motion.div>
  );
}
