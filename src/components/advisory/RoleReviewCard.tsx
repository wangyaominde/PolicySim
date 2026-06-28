import { motion, AnimatePresence } from 'framer-motion';
import type { Agent, RoleReview } from '../../types';
import { VERDICT_META } from './verdictMeta';
import VerdictChip from './VerdictChip';

/** Card shown while a role is still reading the documents. */
function ReadingCard({ agent, progress }: { agent: Agent; progress: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-surface-container rounded-lg p-5 mb-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{agent.avatar}</span>
        <span className="font-headline text-sm text-on-surface font-semibold truncate">
          {agent.name}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
          阅读中
        </span>
      </div>
      <div className="border-l-2 border-primary/40 pl-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((d) => (
              <motion.span
                key={d}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: d }}
                className="w-2 h-2 rounded-full bg-primary"
              />
            ))}
          </div>
          <span className="text-xs text-on-surface-variant">
            正在阅读资料并形成意见…
          </span>
        </div>
        <div className="mt-3 h-1 bg-surface-container-highest rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary/60 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function RoleReviewCard({
  review,
  agent,
  streamingText,
  isExpanded,
  onToggle,
}: {
  review?: RoleReview;
  agent?: Agent;
  streamingText?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (!agent) return null;

  // Still streaming, no parsed review yet → reading placeholder.
  if (!review) {
    if (streamingText === undefined) return null;
    const progress = Math.min(95, Math.round(streamingText.length / 10));
    return <ReadingCard agent={agent} progress={progress} />;
  }

  const meta = VERDICT_META[review.verdict];
  const failed = review.status === 'error';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="bg-surface-container rounded-lg p-5 mb-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl shrink-0">{agent.avatar}</span>
        <div className="min-w-0">
          <div className="font-headline text-sm text-on-surface font-semibold truncate">
            {agent.name}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {!failed && (
            <span className="text-[10px] text-on-surface-variant font-mono">
              信心 {Math.round(review.confidence * 100)}%
            </span>
          )}
          <VerdictChip verdict={review.verdict} size="md" />
        </div>
      </div>

      {/* Headline */}
      {review.headline && (
        <div className={`border-l-2 pl-4 mb-3 ${meta.border}`}>
          <p className="text-sm text-on-surface font-medium leading-relaxed">
            {review.headline}
          </p>
        </div>
      )}

      {/* Recommendation */}
      {review.recommendation && (
        <p className="text-sm text-on-surface-variant leading-relaxed mb-3">
          {review.recommendation}
        </p>
      )}

      {/* Option preference */}
      {review.optionPreference && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary">
          倾向方案：{review.optionPreference}
        </div>
      )}

      {/* Expand toggle */}
      {(review.keyPoints.length > 0 || review.concerns.length > 0 || review.evidence.length > 0) && (
        <>
          <button
            onClick={onToggle}
            className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors font-medium"
          >
            {isExpanded ? '- 收起依据' : '+ 查看依据'}
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden space-y-3 mt-3"
              >
                {review.keyPoints.length > 0 && (
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-1.5">
                      关键观察
                    </h5>
                    <ul className="space-y-1">
                      {review.keyPoints.map((p, i) => (
                        <li key={i} className="text-xs text-on-surface flex gap-2 leading-relaxed">
                          <span className="text-primary mt-0.5 shrink-0">·</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.concerns.length > 0 && (
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-amber-400 font-medium mb-1.5">
                      顾虑 / 风险
                    </h5>
                    <ul className="space-y-1">
                      {review.concerns.map((c, i) => (
                        <li key={i} className="text-xs text-on-surface-variant flex gap-2 leading-relaxed">
                          <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.evidence.length > 0 && (
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-1.5">
                      文件依据
                    </h5>
                    <div className="space-y-2">
                      {review.evidence.map((e, i) => (
                        <div key={i} className="bg-surface-container-lowest rounded-md p-2.5">
                          {e.quote && (
                            <p className="text-xs text-on-surface italic border-l-2 border-surface-variant pl-2 leading-relaxed">
                              “{e.quote}”
                            </p>
                          )}
                          {e.note && (
                            <p className="text-[11px] text-on-surface-variant mt-1">{e.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
