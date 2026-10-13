import { useEffect, useState } from 'react';

export type ProgressTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface ProgressBarProps {
  /** 0 to 100 */
  value: number;
  tone?: ProgressTone;
  /** What the bar is for, read out by screen readers, for example "PAN check" */
  label: string;
  /** Fills from empty to `value` over this many milliseconds, for a check that is running */
  animateMs?: number;
  className?: string;
}

const TONES: Record<ProgressTone, string> = {
  neutral: 'bg-field-border',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

/**
 * Thin progress bar. Not in the Figma form file: built from the same tokens, so it is provisional.
 * Give `animateMs` to see it fill (a mocked check in progress); otherwise it shows `value` at once.
 * Mount it again (change its key) to run the animation again.
 */
export default function ProgressBar({
  value,
  tone = 'info',
  label,
  animateMs,
  className = '',
}: ProgressBarProps) {
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!animateMs) return;
    // one frame after mounting, so the browser animates from empty
    const frame = requestAnimationFrame(() => setStarted(true));
    const timer = setTimeout(() => setFinished(true), animateMs);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [animateMs]);

  // While the bar is filling, how long the check will take is not known to the user: a progress bar
  // without a value is "in progress" for a screen reader, instead of announcing 0 and then 100
  const filling = Boolean(animateMs) && !finished;

  const width = animateMs ? (started ? value : 0) : value;
  const clamped = Math.max(0, Math.min(100, width));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={filling ? undefined : Math.round(clamped)}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      <div
        className={`h-full rounded-full ${TONES[tone]} ${animateMs ? 'ease-linear' : 'transition-[width] duration-200'}`}
        style={{
          width: `${clamped}%`,
          transitionProperty: animateMs ? 'width' : undefined,
          transitionDuration: animateMs ? `${animateMs}ms` : undefined,
        }}
      />
    </div>
  );
}
