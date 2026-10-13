import type { ListStatus } from '@/data/listStatus';

const STYLES: Record<ListStatus, string> = {
  'In-Progress': 'border-status-progress-border bg-status-progress-bg text-status-progress-text',
  'Action Required': 'border-status-action-border bg-status-action-bg text-status-action-text',
  Approved: 'border-status-approved-border bg-status-approved-bg text-status-approved-text',
  Rejected: 'border-status-rejected-border bg-status-rejected-bg text-status-rejected-text',
  Draft: 'border-status-draft-border bg-status-draft-bg text-status-draft-text',
};

/**
 * The pill that shows where an application stands: yellow In-Progress, orange Action Required,
 * green Approved, red Rejected (as in the Figma list) and a grey Draft (added, no Figma reference).
 * The word is always in the chip, so colour is never the only signal.
 */
export default function StatusChip({ status }: { status: ListStatus }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-3 text-body-m whitespace-nowrap ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
