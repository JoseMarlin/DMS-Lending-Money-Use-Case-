import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Shows a small spinner before the text, for something in progress */
  busy?: boolean;
  children: ReactNode;
  className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-field-disabled text-subtle border-field-border',
  info: 'bg-primary-50 text-primary border-primary-200',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/40',
  error: 'bg-error/10 text-error-text border-error/30',
};

/**
 * Small status pill. Not in the Figma form file: built from the same tokens, so it is provisional.
 * The text always says the status, so colour is never the only signal.
 */
export default function Badge({ tone = 'neutral', busy, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-4 font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {busy ? (
        <svg
          aria-hidden
          className="animate-spin"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      ) : null}
      {children}
    </span>
  );
}
