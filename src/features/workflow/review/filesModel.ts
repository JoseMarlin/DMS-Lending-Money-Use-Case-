/**
 * What the Files tab of the review screen lists: one row for each document of the application.
 * Plain functions, so the rules (where a file is now, the order) can be tested.
 */
import type { SortState } from '@/components/ui';
import { fileRecordsOfApplication } from '@/data/fileRecords';
import type { FileStatus } from '@/data/fileSystem';
import { folderIdOf, pathLabelOf } from '@/data/filePaths';
import type { DocType, HomeLoanApplication } from '@/data/types';
import { formatListDateTime } from '@/lib/format';

export interface FileRow {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docType: DocType | string;
  uploadedBy: string;
  /** ISO date and time of the upload */
  uploadedAt: string;
  /** "Priya Kulkarni · 9 Oct 2026, 6:23 PM", the line under the file name */
  subline: string;
  /** 'v1.0', then 'v1.1' when the file was replaced */
  version: string;
  /** Where the file stands: from the status of the application (Draft, Pending approval, Returned, Rejected, Filed) */
  status: FileStatus;
  /** The id of the folder the file is in now: the link into Files & Folders goes to it */
  folderId: string;
  /** Loans / Home Loan / Pending Approval / HL-2026-0001 Vijay Kulkarni / 01 KYC: where the file is now */
  folderPath: string;
  /** "... / 01 KYC": the last folder, as in the design ("... / Invoices") */
  folderLabel: string;
  /** What a reviewer wrote about the file; nothing yet ('-' is drawn). Documents have no comments in the data so far. */
  comment: string;
}

/** The last folder of a path, after an ellipsis: ['Loans', ..., '01 KYC'] -> "... / 01 KYC". */
export function folderLabelOf(path: string[]): string {
  const last = path.at(-1) ?? '';
  return last ? `... / ${last}` : '-';
}

/**
 * One row for each file of the application, in the order they were uploaded (the Sanction Summary of
 * an approved application last). The folder is where the file is now: it follows the status of the
 * application, the same answer as on Files & Folders (src/data/fileRecords.ts).
 */
export function fileRows(application: HomeLoanApplication): FileRow[] {
  return fileRecordsOfApplication(application).map((record) => ({
    id: record.id,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    docType: record.docType,
    uploadedBy: record.uploadedBy,
    uploadedAt: record.uploadedAt,
    subline: [record.uploadedBy, formatListDateTime(record.uploadedAt)].filter(Boolean).join(' · '),
    version: record.version,
    status: record.status,
    folderId: folderIdOf(record.path),
    folderPath: pathLabelOf(record.path),
    folderLabel: folderLabelOf(record.path),
    comment: '',
  }));
}

export type FileSortId = 'file' | 'folder' | 'docType' | 'comments';

const KEY: Record<FileSortId, (row: FileRow) => string> = {
  file: (row) => row.fileName,
  folder: (row) => row.folderLabel,
  docType: (row) => row.docType,
  comments: (row) => row.comment,
};

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * The rows in the order the column header asks for, or as uploaded when there is no sort. Equal
 * values keep their upload order, so the list does not jump about. Empty comments go to the end.
 */
export function sortFileRows(rows: FileRow[], sort: SortState | null): FileRow[] {
  if (!sort || !(sort.id in KEY)) return rows;
  const key = KEY[sort.id as FileSortId];
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = key(a.row);
      const y = key(b.row);
      if (sort.id === 'comments' && (x === '') !== (y === '')) return x === '' ? 1 : -1;
      return sign * collator.compare(x, y) || a.index - b.index;
    })
    .map(({ row }) => row);
}
