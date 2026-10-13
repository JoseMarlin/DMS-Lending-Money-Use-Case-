import type { ReactNode } from 'react';
import { Badge, ProgressBar, type BadgeTone, type ProgressTone } from '@/components/ui';
import { CheckStatus } from '@/data/types';

interface Look {
  badge: BadgeTone;
  bar: ProgressTone;
  /** How full the bar is when it is not animating */
  fill: number;
}

const LOOKS: Record<CheckStatus, Look> = {
  [CheckStatus.Pending]: { badge: 'neutral', bar: 'neutral', fill: 0 },
  [CheckStatus.Checking]: { badge: 'info', bar: 'info', fill: 100 },
  [CheckStatus.Verified]: { badge: 'success', bar: 'success', fill: 100 },
  [CheckStatus.Failed]: { badge: 'error', bar: 'error', fill: 100 },
  [CheckStatus.Unavailable]: { badge: 'warning', bar: 'warning', fill: 100 },
  [CheckStatus.OtpRequired]: { badge: 'warning', bar: 'warning', fill: 0 },
  [CheckStatus.NotApplicable]: { badge: 'neutral', bar: 'neutral', fill: 0 },
};

interface KycCheckRowProps {
  /** For example "PAN" */
  title: string;
  /** One line under the title saying what is being checked */
  description: ReactNode;
  status: CheckStatus;
  /** While Checking: how long the check takes, so the bar fills in that time */
  durationMs?: number | null;
  /** Retries used so far, shown while the source is unavailable */
  retries?: number;
  /** For an Unavailable source: no more tries to come */
  final?: boolean;
  maxRetries?: number;
  /** Extra line, for example the reference ID */
  detail?: ReactNode;
  /** A button, for example "Enter OTP" */
  action?: ReactNode;
}

/** One check of Step 2: name, status badge, progress bar and a line of detail. */
export default function KycCheckRow({
  title,
  description,
  status,
  durationMs,
  retries = 0,
  final = true,
  maxRetries = 3,
  detail,
  action,
}: KycCheckRowProps) {
  const look = LOOKS[status];
  const checking = status === CheckStatus.Checking;
  const retrying = status === CheckStatus.Unavailable && !final && retries > 0;
  const gaveUp = status === CheckStatus.Unavailable && final;

  return (
    <li className="flex flex-col gap-2.5 rounded-field border border-line bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-link-s text-label">{title}</h3>
          <p className="text-xs leading-4 [overflow-wrap:anywhere] text-subtle">{description}</p>
        </div>
        <Badge tone={look.badge} busy={checking} className="min-w-[104px] justify-center">
          {status}
        </Badge>
      </div>

      {/* key: the bar starts again from empty on every try */}
      <ProgressBar
        key={`${status}-${retries}`}
        label={`${title} check`}
        tone={look.bar}
        value={look.fill}
        animateMs={checking && durationMs ? durationMs : undefined}
      />

      {retrying ? (
        <p className="text-xs leading-4 text-warning">
          Source not available. Trying again ({retries} of {maxRetries}).
        </p>
      ) : null}
      {gaveUp ? (
        <p className="text-xs leading-4 text-warning">
          Source still not available after {maxRetries} retries. This counts as an exception.
        </p>
      ) : null}
      {detail ? (
        <p className="text-xs leading-4 [overflow-wrap:anywhere] text-subtle">{detail}</p>
      ) : null}
      {action ? <div>{action}</div> : null}
    </li>
  );
}
