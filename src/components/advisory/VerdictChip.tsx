import type { Verdict } from '../../types';
import { VERDICT_META } from './verdictMeta';

export default function VerdictChip({
  verdict,
  size = 'sm',
}: {
  verdict: Verdict;
  size?: 'sm' | 'md';
}) {
  const meta = VERDICT_META[verdict];
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center font-medium tracking-wide rounded-full border ${pad} ${meta.chip}`}
    >
      {meta.label}
    </span>
  );
}
