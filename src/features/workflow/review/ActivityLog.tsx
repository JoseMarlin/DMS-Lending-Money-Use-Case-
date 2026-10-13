import type { ActivityEntry, ActivityTone } from './activityModel';

const DOT: Record<ActivityTone, string> = {
  neutral: 'bg-muted',
  success: 'bg-status-approved-text',
  warning: 'bg-status-progress-text',
  error: 'bg-status-rejected-text',
};

const CHIP: Record<ActivityTone, string> = {
  neutral: 'border-status-draft-border bg-status-draft-bg text-status-draft-text',
  success: 'border-status-approved-border bg-status-approved-bg text-status-approved-text',
  warning: 'border-status-progress-border bg-status-progress-bg text-status-progress-text',
  error: 'border-status-rejected-border bg-status-rejected-bg text-status-rejected-text',
};

function Entry({ entry, last }: { entry: ActivityEntry; last: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {last ? null : (
        <span aria-hidden className="absolute top-[30px] bottom-0.5 left-3 w-px bg-line" />
      )}
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-table-head"
      >
        <span className={`h-2 w-2 rounded-full ${DOT[entry.tone]}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] font-semibold text-ink">
          <span>{entry.title}</span>
          {entry.chip ? (
            <span
              className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] leading-4 font-medium whitespace-nowrap ${CHIP[entry.chip.tone]}`}
            >
              {entry.chip.label}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[12px] leading-4 font-medium text-subtle">
          {entry.actor}
          {entry.when ? (
            <>
              {' · '}
              {/* the time stays in one piece, so a long name wraps before it */}
              <span className="whitespace-nowrap">{entry.when}</span>
            </>
          ) : null}
        </p>
        {entry.details.map((line) => (
          <p key={line} className="mt-0.5 text-[12px] leading-4 text-ink [overflow-wrap:anywhere]">
            {line}
          </p>
        ))}
        {entry.comment ? (
          <p className="mt-0.5 text-[12px] leading-4 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
            {entry.comment}
          </p>
        ) : null}
        {entry.reference ? (
          <p className="mt-0.5 text-[11px] leading-4 text-subtle [overflow-wrap:anywhere]">
            Reference {entry.reference}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The Activity log tab: the events of the application as a vertical timeline, newest first. It
 * borrows the look of the Progress panel (a circle and a hairline down the side, the name in bold,
 * who and when in muted text, a chip, the comment). There is no Figma frame for it.
 */
export default function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="px-5 pt-6 text-body-m text-subtle">
        Nothing has been recorded for this application yet.
      </p>
    );
  }
  return (
    <div className="px-5 pt-4 pb-10">
      <p className="mb-4 text-[12px] leading-4 font-medium text-subtle">
        {entries.length} {entries.length === 1 ? 'event' : 'events'}, newest first
      </p>
      <ol aria-label="Activity, newest first" className="max-w-[720px]">
        {entries.map((entry, index) => (
          <Entry key={entry.id} entry={entry} last={index === entries.length - 1} />
        ))}
      </ol>
    </div>
  );
}
