import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
  icon?: ReactNode;
}

const variantStyles: Record<string, string> = {
  primary: 'text-surface hover:brightness-110',
  secondary: 'bg-surface-container-highest text-on-surface border border-on-surface/15',
  ghost: 'bg-transparent text-primary hover:bg-surface-container-low',
};

export default function Button({
  variant,
  children,
  icon,
  className = '',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${className}`}
      style={{
        ...(isPrimary
          ? {
              background:
                'linear-gradient(135deg, var(--color-primary), var(--color-primary-container))',
            }
          : {}),
        ...style,
      }}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
