import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, FileTypeIcon, Modal, fileKindOf, fileTypeName } from '@/components/ui';
import type { FileStatus } from '@/data/fileSystem';
import { formatFileSize, formatListDateTime } from '@/lib/format';
import FileStatusBadge from './FileStatusBadge';

/** What the preview needs to know about a file. */
export interface PreviewFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docType: string;
  uploadedBy: string;
  uploadedAt: string;
  /** Where the file is: "Loans / Home Loan / ...". Leave it out when the screen has no folder to tell. */
  folderPath?: string;
  /** The application the file belongs to, when it belongs to one (Files & Folders) */
  applicationId?: string;
  applicantName?: string;
  /** Where the file stands: Filed, Draft, Pending approval, Returned or Rejected (Files & Folders) */
  status?: FileStatus;
  /** Where "View record" goes. Without it there is no such link. */
  recordHref?: string;
  /** What the person who attached the file wrote about it */
  note?: string;
}

interface Row {
  label: string;
  value: ReactNode;
  /** A second, muted line under the value */
  note?: string;
}

/** The Folder row, if there is something to say about the folder. */
function folderRow(file: PreviewFile): Row[] {
  return file.folderPath ? [{ label: 'Folder', value: file.folderPath }] : [];
}

/** The Linked application row, for a file that belongs to an application: "HL-2026-0001 · Vijay Kulkarni". */
function applicationRow(file: PreviewFile): Row[] {
  if (!file.applicationId) return [];
  return [
    {
      label: 'Linked application',
      value: [file.applicationId, file.applicantName].filter(Boolean).join(' · '),
    },
  ];
}

/** "Priya Kulkarni · 9 Oct 2026, 6:23 PM", where the date and time never break across two lines. */
function uploadedBy(file: PreviewFile): ReactNode {
  const when = formatListDateTime(file.uploadedAt);
  return (
    <>
      {file.uploadedBy}
      {file.uploadedBy && when ? ' · ' : ''}
      {when ? <span className="whitespace-nowrap">{when}</span> : null}
    </>
  );
}

/**
 * A simple preview of a file: its name and type, and a plain placeholder where the page would be.
 * There is no real file storage in this prototype, so this is a mock; it says so. Not in the
 * Figma files, so it is provisional.
 */
export default function FilePreviewModal({
  file,
  onClose,
}: {
  /** null while it is closed */
  file: PreviewFile | null;
  onClose: () => void;
}) {
  const rows: Row[] = file
    ? [
        { label: 'Type', value: fileTypeName(file.mimeType) },
        { label: 'Size', value: formatFileSize(file.sizeBytes) || '—' },
        { label: 'DocType', value: file.docType || '—' },
        ...applicationRow(file),
        ...(file.status
          ? [{ label: 'Status', value: <FileStatusBadge status={file.status} showFiled /> }]
          : []),
        {
          label: 'Uploaded by',
          value: uploadedBy(file),
        },
        ...folderRow(file),
        ...(file.note ? [{ label: 'Note', value: file.note }] : []),
      ]
    : [];

  return (
    <Modal
      open={file !== null}
      title={file?.fileName ?? 'File preview'}
      onClose={onClose}
      footer={
        <>
          {file?.recordHref ? (
            <Link
              to={file.recordHref}
              className="inline-flex h-10 items-center justify-center rounded-field border border-primary-border bg-white px-4 text-button-s whitespace-nowrap text-primary hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              View record
            </Link>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {file ? (
        <div className="flex flex-col gap-4">
          <div
            role="img"
            aria-label={`Placeholder for the preview of ${file.fileName}`}
            className="flex h-44 flex-col items-center justify-center gap-2 rounded-card border border-line bg-table-head"
          >
            <FileTypeIcon kind={fileKindOf(file.mimeType)} size={56} />
            <p className="text-[12px] leading-4 font-medium text-subtle">
              {fileTypeName(file.mimeType)} &middot; preview is mocked in this demo
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-m">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-subtle">{row.label}</dt>
                <dd className="font-medium text-ink [overflow-wrap:anywhere]">
                  {row.value}
                  {row.note ? (
                    <span className="block text-[12px] leading-4 font-normal text-subtle">
                      {row.note}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </Modal>
  );
}
