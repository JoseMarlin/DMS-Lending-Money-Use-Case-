import { Button } from '@/components/ui';

interface SubmittedCardProps {
  applicationId: string;
  onStartNew: () => void;
}

/** Shown after Submit: the Application ID and what happens next. No workflow yet. */
export default function SubmittedCard({ applicationId, onStartNew }: SubmittedCardProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12 5 5 9-10" />
        </svg>
      </span>
      <div className="flex flex-col gap-1">
        <h2 tabIndex={-1} data-step-heading className="text-heading-s text-label outline-none">
          Application submitted
        </h2>
        <p className="text-body-m text-ink">Application ID</p>
        <p className="text-heading-s text-primary">{applicationId}</p>
      </div>
      <p className="text-body-m text-ink">Your application has been sent for approval.</p>
      <Button onClick={onStartNew}>Start new application</Button>
    </div>
  );
}
