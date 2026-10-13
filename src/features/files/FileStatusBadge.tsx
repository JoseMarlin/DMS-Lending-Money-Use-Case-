import { FileStatus } from '@/data/fileSystem';

/** Each status that is not final has its own colour, from the status chips of the lists. */
const STYLES: Record<Exclude<FileStatus, 'Filed'>, string> = {
  [FileStatus.Draft]: 'border-status-draft-border bg-status-draft-bg text-status-draft-text',
  [FileStatus.PendingApproval]:
    'border-status-progress-border bg-status-progress-bg text-status-progress-text',
  [FileStatus.Returned]: 'border-status-action-border bg-status-action-bg text-status-action-text',
  [FileStatus.Rejected]:
    'border-status-rejected-border bg-status-rejected-bg text-status-rejected-text',
};

/**
 * Where a file stands, as a small pill: Draft (grey), Pending approval (amber), Returned (orange),
 * Rejected (red). A filed file is in its final place and gets no badge; `showFiled` writes the word
 * as plain text instead, for a table that has a Status column. Not in the Figma frame: provisional.
 * The word is always in the pill, so colour is never the only signal.
 */
export default function FileStatusBadge({
  status,
  showFiled = false,
  className = '',
}: {
  status: FileStatus;
  /** true writes "Filed" as plain text, 'chip' as a green pill; false (the default) draws nothing for a filed file */
  showFiled?: boolean | 'chip';
  className?: string;
}) {
  if (status === FileStatus.Filed) {
    if (showFiled === 'chip') {
      // the final place, as a pill of its own (the side panel of the record sheet)
      return (
        <span
          className={`inline-flex h-5 items-center rounded-full border border-status-approved-border bg-status-approved-bg px-2 text-[11px] leading-4 font-semibold whitespace-nowrap text-status-approved-text ${className}`}
        >
          Filed
        </span>
      );
    }
    return showFiled ? <span className={`text-subtle ${className}`}>Filed</span> : null;
  }
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full border px-2 text-[11px] leading-4 font-semibold whitespace-nowrap ${STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}
