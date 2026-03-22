import type { Stance } from '../../types';

interface StanceChipProps {
  stance: Stance;
  size?: 'sm' | 'md';
}

const stanceConfig: Record<Stance, { bg: string; text: string; label: string }> = {
  support: {
    bg: 'bg-primary-container/20',
    text: 'text-primary',
    label: '支持',
  },
  oppose: {
    bg: 'bg-secondary-container/20',
    text: 'text-secondary',
    label: '反对',
  },
  neutral: {
    bg: 'bg-surface-variant',
    text: 'text-on-surface-variant',
    label: '中立',
  },
  conditional: {
    bg: 'bg-tertiary-container/20',
    text: 'text-tertiary',
    label: '有条件',
  },
};

export default function StanceChip({ stance, size = 'md' }: StanceChipProps) {
  const config = stanceConfig[stance];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}
