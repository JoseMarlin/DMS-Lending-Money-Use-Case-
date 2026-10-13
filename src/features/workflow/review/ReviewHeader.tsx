import { Link } from 'react-router-dom';
import { Badge, Bullet, Button, Tooltip } from '@/components/ui';
import { KebabIcon } from '@/components/ui/icons';
import type { WorkflowInstance } from '@/data/types';
import { recordSheetPath } from '@/features/master/paths';
import { formatListDateTime } from '@/lib/format';
import { headerTitle } from './reviewModel';

/**
 * The top of the centre column: what was submitted, the meta line, a kebab (only drawn) and
 * Take Action. Take Action is switched off, with a tip that says why, when the current user has
 * no action on the instance. It is aria-disabled, not disabled, so the keyboard can still reach it
 * and the tip shows on focus too.
 */
export default function ReviewHeader({
  instance,
  applicantName,
  kycException,
  blockedReason,
  onTakeAction,
}: {
  instance: WorkflowInstance;
  applicantName: string;
  kycException: boolean;
  /** null when the user has the action; otherwise why not */
  blockedReason: string | null;
  onTakeAction: () => void;
}) {
  const blocked = blockedReason !== null;
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5 font-semibold text-ink">
          <span className="[overflow-wrap:anywhere]">{headerTitle(applicantName)}</span>
          {kycException ? (
            // pulled in by 2px so that the badge does not make the row taller than the title
            <Badge tone="warning" className="-my-0.5">
              KYC Exception
            </Badge>
          ) : null}
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-4 font-medium text-subtle">
          <span>{instance.id}</span>
          <Bullet />
          <Link
            to={recordSheetPath(instance.applicationId)}
            aria-label={`Open the record of ${instance.applicationId}`}
            className="rounded text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {instance.applicationId}
          </Link>
          <Bullet />
          <span>Initiated by {instance.initiatedBy}</span>
          <Bullet />
          <span>{formatListDateTime(instance.initiatedAt)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* only drawn */}
        <button
          type="button"
          disabled
          aria-label="More options"
          className="flex h-8 w-8 items-center justify-center text-label"
        >
          <KebabIcon size={20} />
        </button>
        <Tooltip text={blockedReason}>
          {(describedBy) => (
            <Button
              size="sm"
              aria-disabled={blocked || undefined}
              aria-describedby={describedBy}
              onClick={() => {
                if (!blocked) onTakeAction();
              }}
              className={`px-[11px] ${blocked ? 'cursor-not-allowed opacity-50 hover:bg-primary!' : ''}`}
            >
              Take Action
            </Button>
          )}
        </Tooltip>
      </div>
    </div>
  );
}
