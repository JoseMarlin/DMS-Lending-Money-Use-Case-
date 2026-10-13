import { fileKindOf } from './fileKind';
import FileTypeIcon from './FileTypeIcon';

/**
 * The File cell of the Files tables (Figma Workflow file, Files tab): the file icon, the name in
 * bold and, under it, a muted line, for example "Priya Kulkarni · 9 Oct 2026, 6:23 PM". Long names
 * are cut with an ellipsis; the full name is in the tooltip. With `onOpen` the name is a button
 * that opens the file (the Files & Folders list).
 */
export default function FileCell({
  fileName,
  mimeType,
  subline,
  onOpen,
}: {
  fileName: string;
  mimeType: string;
  subline: string;
  onOpen?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <FileTypeIcon kind={fileKindOf(mimeType)} size={28} className="shrink-0" />
      <div className="min-w-0">
        <p title={fileName} className="truncate text-[13px] leading-[18px] font-semibold text-ink">
          {onOpen ? (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={onOpen}
              className="max-w-full truncate rounded text-left font-[inherit] hover:text-primary hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              {fileName}
            </button>
          ) : (
            fileName
          )}
        </p>
        <p className="mt-1 truncate text-[12px] leading-4 text-subtle">{subline}</p>
      </div>
    </div>
  );
}
