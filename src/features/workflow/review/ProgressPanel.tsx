import { CommentsIcon, ListIcon } from '@/components/ui/icons';
import type { ProgressStep, StepTone } from './reviewModel';

const CHIP: Record<StepTone, string> = {
  success: 'border-status-approved-border bg-status-approved-bg text-status-approved-text',
  warning: 'border-status-progress-border bg-status-progress-bg text-status-progress-text',
  error: 'border-status-rejected-border bg-status-rejected-bg text-status-rejected-text',
};

const CIRCLE: Record<ProgressStep['state'], string> = {
  done: 'bg-table-head text-subtle',
  current: 'bg-primary text-white ring-[3px] ring-primary-100',
  upcoming: 'bg-table-head text-subtle',
};

function Step({ step, last }: { step: ProgressStep; last: boolean }) {
  return (
    <li
      aria-current={step.state === 'current' ? 'step' : undefined}
      className="relative flex gap-3 pb-6 last:pb-0"
    >
      {last ? null : (
        <span aria-hidden className="absolute top-[38px] bottom-0.5 left-4 w-px bg-line" />
      )}
      <span
        aria-hidden
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] leading-[18px] font-semibold ${CIRCLE[step.state]}`}
      >
        {step.index}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] leading-[18px] font-semibold ${
            step.state === 'upcoming' ? 'text-subtle' : 'text-ink'
          }`}
        >
          {step.name}
        </p>
        <p className="mt-0.5 text-[12px] leading-4 font-medium text-subtle">
          {step.actor}
          {step.when ? (
            <>
              {' \u00b7 '}
              {/* the time stays in one piece, so a long name wraps before it */}
              <span className="whitespace-nowrap">{step.when}</span>
            </>
          ) : null}
        </p>
        {step.chip ? (
          <span
            className={`mt-2 inline-flex h-5 items-center rounded-full border px-2 text-[10px] leading-4 font-medium whitespace-nowrap ${CHIP[step.chip.tone]}`}
          >
            {step.chip.label}
          </span>
        ) : null}
        {step.comment ? (
          <p className="mt-0.5 text-[12px] leading-4 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
            {step.comment}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The right panel: one numbered circle for each node of the instance, with who did it and when, a
 * chip, and the comment. The current node has a blue circle. On the panel's edge is a small rail of
 * icons; the list icon is this panel, the comments icon is only drawn.
 */
export default function ProgressPanel({ steps }: { steps: ProgressStep[] }) {
  return (
    <>
      <aside
        aria-label="Progress"
        className="flex w-[320px] shrink-0 flex-col border-l border-line bg-white"
      >
        <h2 className="flex h-12 shrink-0 items-center border-b border-line px-4 text-[16px] leading-6 font-semibold text-ink">
          Progress
        </h2>
        <ol
          // the list scrolls, so the keyboard has to be able to reach it
          tabIndex={0}
          aria-label="Progress steps"
          className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          {steps.map((step, i) => (
            <Step key={step.index} step={step} last={i === steps.length - 1} />
          ))}
        </ol>
      </aside>
      <nav
        aria-label="Panels"
        className="flex w-12 shrink-0 flex-col gap-1 border-l border-line bg-white"
      >
        <button
          type="button"
          aria-label="Progress"
          aria-pressed="true"
          className="relative flex h-12 w-full items-center justify-center bg-primary-50 text-primary before:absolute before:inset-y-0 before:-left-px before:w-0.5 before:bg-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <ListIcon size={26} />
        </button>
        {/* only drawn */}
        <button
          type="button"
          disabled
          aria-label="Comments"
          className="flex h-12 w-full items-center justify-center text-subtle"
        >
          <CommentsIcon size={24} />
        </button>
      </nav>
    </>
  );
}
