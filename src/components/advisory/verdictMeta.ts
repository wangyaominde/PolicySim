import type { Verdict } from '../../types';

export interface VerdictMeta {
  label: string;
  short: string;
  chip: string;   // tailwind classes for the chip (bg/text/border)
  bar: string;    // solid bg color for bars/dots
  border: string; // left-border accent color
  text: string;   // text color
  score: number;  // numeric weight for averaging (yes positive, no negative)
}

// NOTE: every tailwind class is written out as a literal so the v4 scanner
// generates it — do not build these class names dynamically at runtime.
export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  strong_yes: {
    label: '强烈支持', short: '强支持',
    chip: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    bar: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-300', score: 2,
  },
  lean_yes: {
    label: '倾向支持', short: '倾向',
    chip: 'bg-green-500/15 text-green-300 border-green-500/25',
    bar: 'bg-green-500', border: 'border-green-500', text: 'text-green-300', score: 1,
  },
  neutral: {
    label: '中立', short: '中立',
    chip: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    bar: 'bg-zinc-500', border: 'border-zinc-500', text: 'text-zinc-300', score: 0,
  },
  lean_no: {
    label: '倾向反对', short: '倾反',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    bar: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-300', score: -1,
  },
  strong_no: {
    label: '强烈反对', short: '强反对',
    chip: 'bg-red-500/20 text-red-300 border-red-500/30',
    bar: 'bg-red-500', border: 'border-red-500', text: 'text-red-300', score: -2,
  },
  need_info: {
    label: '信息不足', short: '待定',
    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    bar: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-300', score: 0,
  },
};

/** Order used for rendering tallies / distributions. */
export const VERDICT_DISPLAY_ORDER: Verdict[] = [
  'strong_yes', 'lean_yes', 'neutral', 'lean_no', 'strong_no', 'need_info',
];
