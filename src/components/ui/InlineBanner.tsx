import type { ReactNode } from 'react';

export type BannerVariant = 'info' | 'warning' | 'error' | 'success';

export interface InlineBannerProps {
  variant?: BannerVariant;
  /** Bold first line */
  title?: string;
  children?: ReactNode;
  className?: string;
}

const STYLES: Record<BannerVariant, { box: string; icon: string }> = {
  info: { box: 'border-primary-200 bg-primary-50', icon: 'text-primary' },
  warning: { box: 'border-warning/40 bg-warning/10', icon: 'text-warning' },
  error: { box: 'border-error/40 bg-error/10', icon: 'text-error-text' },
  success: { box: 'border-success/40 bg-success/10', icon: 'text-success' },
};

function Icon({ variant }: { variant: BannerVariant }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (variant) {
    case 'success':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 3 2 20h20L12 3Z" />
          <path d="M12 10v4M12 17.5v.01" />
        </svg>
      );
    case 'error':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5M12 16v.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8v.01" />
        </svg>
      );
  }
}

/**
 * Message strip for the top of a card. Not in the Figma form file: built from the same tokens, so
 * it is provisional. Errors are announced at once (role alert); the others politely (role status).
 */
export default function InlineBanner({
  variant = 'info',
  title,
  children,
  className = '',
}: InlineBannerProps) {
  const style = STYLES[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-field border px-3 py-2.5 ${style.box} ${className}`}
    >
      <span className={`mt-0.5 shrink-0 ${style.icon}`}>
        <Icon variant={variant} />
      </span>
      <div className="min-w-0 flex-1 text-body-m text-ink">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
