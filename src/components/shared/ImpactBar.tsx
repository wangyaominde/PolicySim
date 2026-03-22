import { motion } from 'framer-motion';

interface ImpactBarProps {
  score: number; // -10 to +10
}

export default function ImpactBar({ score }: ImpactBarProps) {
  const clampedScore = Math.max(-10, Math.min(10, score));
  // Convert score to 0-100 percentage where 50 is center (0)
  const percent = ((clampedScore + 10) / 20) * 100;

  return (
    <div className="flex items-center gap-3">
      {/* Bar */}
      <div className="relative flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-on-surface-variant/30 z-10" />

        {/* Fill */}
        {clampedScore < 0 ? (
          // Negative: fill from center leftward
          <motion.div
            className="absolute top-0 bottom-0 rounded-full"
            style={{
              right: '50%',
              background: 'linear-gradient(90deg, var(--color-secondary-container), var(--color-secondary))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${50 - percent}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        ) : clampedScore > 0 ? (
          // Positive: fill from center rightward
          <motion.div
            className="absolute top-0 bottom-0 left-1/2 rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-container))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percent - 50}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        ) : null}
      </div>

      {/* Label */}
      <span
        className={`text-xs font-mono font-medium w-8 text-right ${
          clampedScore > 0
            ? 'text-primary'
            : clampedScore < 0
              ? 'text-secondary'
              : 'text-on-surface-variant'
        }`}
      >
        {clampedScore > 0 ? '+' : ''}
        {clampedScore}
      </span>
    </div>
  );
}
