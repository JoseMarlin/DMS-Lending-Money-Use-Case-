import { Fragment } from 'react';
import { FileTypeIcon, fileKindOf, fileTypeShort } from '@/components/ui';
import { StarOutlineIcon } from '@/components/ui/icons';
import { StarIcon } from '@/components/shell/icons';
import { FileStatus, type FileNode } from '@/data/fileSystem';
import FileStatusBadge from './FileStatusBadge';

/** A name that may break after each underscore: "Aadhaar_Masked_<wbr>Copy.pdf", not in the middle of a word. */
function breakableName(name: string) {
  return name.split('_').map((part, index, parts) => (
    <Fragment key={index}>
      {index < parts.length - 1 ? `${part}_` : part}
      {index < parts.length - 1 ? <wbr /> : null}
    </Fragment>
  ));
}

/**
 * A file in the grid (Figma node 299:6140): a pale thumbnail panel, the name with a star, who
 * uploaded it, and chips for the version and the DocType. The thumbnail is a plain placeholder (the
 * type of the file on a light panel), never a drawing of a real document. A file that is not in a
 * final place carries a small status badge on the corner of the thumbnail.
 *
 * The name is the button that opens the preview, and it is stretched over the whole card, so the
 * card is one big target; the star sits above it.
 */
export default function FileCard({
  file,
  iconSize,
  favourite,
  onToggleFavourite,
  onOpen,
}: {
  file: FileNode;
  /** Height of the file icon on the thumbnail, in pixels: it follows the size of the card */
  iconSize: number;
  favourite: boolean;
  onToggleFavourite: () => void;
  onOpen: () => void;
}) {
  const Star = favourite ? StarIcon : StarOutlineIcon;
  return (
    <div className="group relative min-w-0">
      {/* the badge has a strip of its own at the top, so that it never covers the icon on a small card;
          the hover is matched on the name button because its stretched overlay is what the pointer is over */}
      <div
        className={`relative flex aspect-[6/5] flex-col items-center justify-center gap-1.5 rounded-lg border border-transparent bg-table-head group-has-[button[aria-haspopup=dialog]:hover]:border-primary-200 group-has-[button[aria-haspopup=dialog]:hover]:shadow-card ${
          file.status === FileStatus.Filed ? '' : 'pt-7'
        }`}
      >
        <FileTypeIcon kind={fileKindOf(file.mimeType)} size={iconSize} />
        <span className="text-[11px] leading-4 font-semibold text-subtle">
          {fileTypeShort(file.mimeType)}
        </span>
        <FileStatusBadge status={file.status} className="absolute top-2 left-2 bg-white" />
      </div>
      {/* two lines high, so that the uploader and the chips line up from card to card */}
      <div className="mt-3.5 flex min-h-9 items-start gap-1">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onOpen}
          // the visible name has a break after each underscore: the name is said as it is
          aria-label={file.name}
          title={file.docType ? `${file.name} · ${file.docType}` : file.name}
          className="line-clamp-2 min-w-0 flex-1 rounded text-left text-[13px] leading-[18px] font-medium text-ink [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary"
        >
          {breakableName(file.name)}
        </button>
        <button
          type="button"
          aria-label={`Favourite ${file.name}`}
          aria-pressed={favourite}
          onClick={onToggleFavourite}
          className={`relative z-10 mr-[7px] -my-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
            favourite ? 'text-ink' : 'text-muted'
          }`}
        >
          <Star size={favourite ? 14 : 15} />
        </button>
      </div>
      <p className="truncate text-[12px] leading-4 font-medium text-subtle">{file.uploadedBy}</p>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-chip-version-bg px-2 text-[11px] leading-[18px] font-semibold text-chip-version-text">
          {file.version}
        </span>
        {file.docType ? (
          <span className="inline-flex h-[18px] max-w-full min-w-0 items-center rounded-full border border-primary-200 bg-primary-50 px-2 text-[11px] leading-[18px] font-semibold text-primary">
            <span className="truncate">{file.docType}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
