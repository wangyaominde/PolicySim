import type { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export default function GlassPanel({ children, className = '' }: GlassPanelProps) {
  return (
    <div
      className={`bg-surface-container/60 backdrop-blur-xl border border-primary/5 rounded-lg ${className}`}
    >
      {children}
    </div>
  );
}
