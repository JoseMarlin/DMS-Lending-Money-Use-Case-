import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, EmptyState, FileCell, type Column, type SortState } from '@/components/ui';
import type { HomeLoanApplication } from '@/data/types';
import FilePreviewModal from '@/features/files/FilePreviewModal';
import FileRowMenu from '@/features/files/FileRowMenu';
import FileStatusBadge from '@/features/files/FileStatusBadge';
import { folderLink } from '@/features/files/filesPageModel';
import { fileRows, sortFileRows, type FileRow } from './filesModel';

/**
 * The Folder cell: where the file is now, as a link into Files & Folders, with the status of the file
 * under it (Draft, Pending approval, Returned, Rejected, Filed). The place follows the status of the
 * application, so it changes by itself when the application is submitted, approved or rejected.
 */
function FolderCell({ row }: { row: FileRow }) {
  return (
    <div>
      <Link
        to={folderLink(row.folderId)}
        title={row.folderPath}
        aria-label={`Open the folder ${row.folderPath} in Files & Folders`}
        className="rounded text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {row.folderLabel}
      </Link>
      <p className="mt-0.5">
        <FileStatusBadge status={row.status} showFiled />
      </p>
    </div>
  );
}

/**
 * The Files tab (Figma Workflow file, Files tab): one row for each uploaded document, with
 * sortable columns File, Folder, DocType and Comments, and a menu with Preview. The Folder is a link
 * to where the file is now, with the status of the file under it.
 */
export default function FilesTab({ application }: { application: HomeLoanApplication }) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [preview, setPreview] = useState<FileRow | null>(null);
  const rows = sortFileRows(fileRows(application), sort);

  const onSortChange = (id: string) =>
    setSort((current) =>
      current && current.id === id
        ? { id, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { id, dir: 'asc' },
    );

  const columns: Column<FileRow>[] = [
    {
      id: 'file',
      header: 'File',
      sortable: true,
      width: '38%',
      render: (row) => (
        <FileCell fileName={row.fileName} mimeType={row.mimeType} subline={row.subline} />
      ),
    },
    {
      id: 'folder',
      header: 'Folder',
      sortable: true,
      width: '18%',
      render: (row) => <FolderCell row={row} />,
    },
    {
      id: 'docType',
      header: 'DocType',
      sortable: true,
      width: '18%',
      render: (row) => <span className="[overflow-wrap:anywhere]">{row.docType}</span>,
    },
    {
      id: 'comments',
      header: 'Comments',
      sortable: true,
      width: '18%',
      render: (row) =>
        row.comment ? (
          <span className="[overflow-wrap:anywhere]">{row.comment}</span>
        ) : (
          <>
            <span aria-hidden>-</span>
            <span className="sr-only">No comment</span>
          </>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      width: '8%',
      render: (row) => (
        <FileRowMenu
          fileName={row.fileName}
          items={[{ label: 'Preview', onSelect: () => setPreview(row) }]}
        />
      ),
    },
  ];

  return (
    <div className="px-5 pt-4 pb-24">
      {rows.length > 0 ? (
        <DataTable
          variant="files"
          caption="Files of the application"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          sort={sort}
          onSortChange={onSortChange}
          minWidth={620}
        />
      ) : (
        <EmptyState title="No files">No document was uploaded with this application.</EmptyState>
      )}
      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
