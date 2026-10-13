export interface StepperProps {
  steps: string[];
  /** 1-based number of the step the user is on */
  current: number;
}

/**
 * Minimal step indicator. Not in the Figma design: it reuses the card tokens (primary for the
 * current and finished steps, muted for the next ones) and adds nothing else.
 */
export default function Stepper({ steps, current }: StepperProps) {
  return (
    <ol aria-label="Progress" className="flex items-center gap-3 px-6 py-3">
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        const isLast = number === steps.length;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={`flex items-center gap-3 ${isLast ? '' : 'flex-1'}`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  done || active
                    ? 'border-primary bg-primary text-white'
                    : 'border-field-border bg-white text-subtle'
                }`}
              >
                {done ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                ) : (
                  number
                )}
              </span>
              <span className={`text-sm ${active ? 'font-bold text-label' : 'text-subtle'}`}>
                <span className="sr-only">{`Step ${number} of ${steps.length}: `}</span>
                {label}
              </span>
            </span>
            {isLast ? null : (
              <span
                aria-hidden
                className={`h-px flex-1 ${done ? 'bg-primary' : 'bg-field-border'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
