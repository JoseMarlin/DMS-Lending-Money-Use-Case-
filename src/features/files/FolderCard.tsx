import { Link } from 'react-router-dom';
import FolderGlyph from './FolderGlyph';
import MovedBadge from './MovedBadge';

/**
 * A folder in the grid (Figma node 299:6140): 78px high, an orange folder on a pale panel that
 * fills the left end of the card, the name, "{n} Folders, {n} files" and "Last updated {time}". The whole card is the link
 * that opens the folder.
 */
export default function FolderCard({
  name,
  to,
  counts,
  updated,
  location,
  moved = false,
  onOpen,
}: {
  name: string;
  to: string;
  counts: string;
  updated: string;
  /** Where the folder is ("HL-2026-0001 Vijay Kulkarni"), for the results of a search: three folders may be called 01 KYC */
  location?: string;
  /** Files were moved into this folder (or a folder in it) and it was not opened since: a "Moved" mark */
  moved?: boolean;
  /** Called when the folder is opened (a click, or Enter on the link) */
  onOpen?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onOpen}
      className="flex h-[78px] items-center gap-3 overflow-hidden rounded-card border border-line bg-white pr-3 text-left hover:border-primary-200 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden
        className="flex h-full w-[60px] shrink-0 items-center justify-center bg-table-head"
      >
        <FolderGlyph />
      </span>
      <span className="min-w-0 flex-1">
        <span
          title={name}
          className="block truncate text-[13px] leading-[18px] font-semibold text-ink"
        >
          {name}
        </span>
        {location ? (
          <span className="block truncate text-[12px] leading-4 text-subtle">in {location}</span>
        ) : null}
        {/* the mark has the counts line: it must not take the room of the name */}
        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-4 text-subtle">
          <span className="min-w-0 truncate">{counts}</span>
          {moved ? <MovedBadge /> : null}
        </span>
        {updated ? (
          <span className="block truncate text-[12px] leading-4 text-subtle">{updated}</span>
        ) : null}
      </span>
    </Link>
  );
}
