import { InlineBanner } from '@/components/ui';
import type { ValidationIssue } from '../validation/validate';

interface ValidationSummaryProps {
  issues: ValidationIssue[];
  /** Called when an issue is picked, to take the user to that field */
  onSelect: (issue: ValidationIssue) => void;
}

/** Text of one line: the message, with the field name in front unless the message has it already. */
function lineFor(issue: ValidationIssue): string {
  const named = issue.message.toLowerCase().includes(issue.label.toLowerCase());
  return named ? issue.message : `${issue.label}: ${issue.message}`;
}

/**
 * Error banner for the top of the card, shown after "Next: KYC Validation" while anything is still
 * wrong. Each line takes the user to its field. A long list scrolls inside the banner.
 */
export default function ValidationSummary({ issues, onSelect }: ValidationSummaryProps) {
  if (issues.length === 0) return null;
  const count = issues.length;
  return (
    <div className="px-6 pb-3">
      <InlineBanner
        variant="error"
        title={`Fix ${count} ${count === 1 ? 'error' : 'errors'} before moving to KYC Validation`}
      >
        <ul className="mt-1 max-h-16 space-y-0.5 overflow-y-auto pr-1 text-sm">
          {issues.map((issue) => (
            <li key={issue.fieldId}>
              <button
                type="button"
                onClick={() => onSelect(issue)}
                className="text-left underline-offset-2 hover:underline focus-visible:underline"
              >
                {lineFor(issue)}
              </button>
            </li>
          ))}
        </ul>
      </InlineBanner>
    </div>
  );
}
