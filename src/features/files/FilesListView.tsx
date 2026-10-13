import { Link } from 'react-router-dom';
import { DataTable, FileCell, type Column } from '@/components/ui';
import FileRowMenu from './FileRowMenu';
import FileStatusBadge from './FileStatusBadge';
import FolderGlyph from './FolderGlyph';
import MovedBadge from './MovedBadge';
import { folderLink, type ListRow } from './filesPageModel';

/** A folder's row: the folder, its name as a link that opens it, and its counts underneath. */
function FolderNameCell({ row, onOpenFolder }: { row: ListRow; onOpenFolder: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex h-7 w-[26px] shrink-0 items-center justify-center rounded bg-table-head"
      >
        <FolderGlyph width={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] leading-[18px] font-semibold text-ink">
          <Link
            to={folderLink(row.id)}
            onClick={onOpenFolder}
            title={row.name}
            className="rounded hover:text-primary hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            {row.name}
          </Link>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-subtle">
          <span className="min-w-0 truncate">{row.subline}</span>
          {row.moved ? <MovedBadge /> : null}
        </p>
      </div>
    </div>
  );
}

/**
 * The list view: a table in the style of the Files tab of the review screen, with the columns File
 * (icon, name and "{uploader} · {date, time}" under it), DocType, Folder, Status and a kebab menu.
 * Folders are rows too, ahead of the files, so that they can be opened from here.
 */
export default function FilesListView({
  rows,
  onOpenFolder,
  onPreview,
  isFavourite,
  onToggleFavourite,
}: {
  rows: ListRow[];
  /** A folder was chosen */
  onOpenFolder: () => void;
  onPreview: (fileId: string) => void;
  isFavourite: (fileId: string) => boolean;
  onToggleFavourite: (fileId: string) => void;
}) {
  const columns: Column<ListRow>[] = [
    {
      id: 'file',
      header: 'File',
      width: '38%',
      render: (row) =>
        row.kind === 'folder' ? (
          <FolderNameCell row={row} onOpenFolder={onOpenFolder} />
        ) : (
          <FileCell
            fileName={row.name}
            mimeType={row.file?.mimeType ?? ''}
            subline={row.subline}
            onOpen={() => onPreview(row.id)}
          />
        ),
    },
    {
      id: 'docType',
      header: 'DocType',
      width: '19%',
      render: (row) =>
        row.docType ? (
          <span className="[overflow-wrap:anywhere]">{row.docType}</span>
        ) : (
          <>
            <span aria-hidden>-</span>
            <span className="sr-only">No DocType</span>
          </>
        ),
    },
    {
      id: 'folder',
      header: 'Folder',
      width: '19%',
      render: (row) => (
        <span title={row.folderPath} className="[overflow-wrap:anywhere] text-subtle">
          {row.folderLabel}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '16%',
      render: (row) =>
        row.status ? (
          <FileStatusBadge status={row.status} showFiled />
        ) : (
          <>
            <span aria-hidden>-</span>
            <span className="sr-only">Folders have no status</span>
          </>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      width: '8%',
      render: (row) =>
        row.kind === 'file' ? (
          <FileRowMenu
            fileName={row.name}
            items={[
              { label: 'Preview', onSelect: () => onPreview(row.id) },
              {
                label: isFavourite(row.id) ? 'Remove from favourites' : 'Add to favourites',
                onSelect: () => onToggleFavourite(row.id),
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <DataTable
      variant="files"
      caption="Files and folders"
      columns={columns}
      rows={rows}
      rowKey={(row) => `${row.kind}-${row.id}`}
      sort={null}
      onSortChange={() => {}}
      minWidth={720}
    />
  );
}
