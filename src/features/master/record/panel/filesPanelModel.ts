/**
 * What the Files and Attachments panel of the record sheet lists, as plain functions: one row for
 * each document of the form (a row that says "not uploaded" for one that is still missing), one row
 * for each supporting file that was attached, where each file is now (from the status of the
 * application: the same answer as Files & Folders), and what can be done with it.
 */
import { requiredDocTypes } from '@/data/application';
import { attachmentsOf, canRemoveAttachment, isAttachment } from '@/data/attachments';
import type { FileStatus } from '@/data/fileSystem';
import { documentFolderPath, fileStatusOf, folderIdOf, pathLabelOf } from '@/data/filePaths';
import { DOC_TYPES } from '@/data/options';
import type { ApplicationDocument, DemoUser, HomeLoanApplication } from '@/data/types';
import type { PreviewFile } from '@/features/files/FilePreviewModal';
import { formatListDateTime } from '@/lib/format';

/** Where a document is and what it is, for one row. */
export interface PlaceOfFile {
  folderId: string;
  /** Loans / Home Loan / Pending Approval / HL-2026-0002 Shobha Gaonkar / 01 KYC */
  folderPath: string;
  /** "... / 01 KYC": the last folder, as in the design */
  folderLabel: string;
}

export function placeOf(application: HomeLoanApplication, docType: string): PlaceOfFile {
  const path = documentFolderPath(application, docType);
  return {
    folderId: folderIdOf(path),
    folderPath: pathLabelOf(path),
    folderLabel: `... / ${path.at(-1) ?? ''}`,
  };
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** The id of the control of a document row that the cursor is put on after a Save that found it missing. */
export const documentControlId = (docType: string) => `record-doc-${slug(docType)}`;

// ---------------------------------------------------------------------------
// The documents of the form
// ---------------------------------------------------------------------------

export interface DocumentRow {
  /** The DocType */
  docType: string;
  /** Asked for by the form: it cannot be removed, and the save checks it is there */
  required: boolean;
  /** The file, or nothing when it has not been uploaded */
  doc?: ApplicationDocument;
  status: FileStatus | null;
  place: PlaceOfFile | null;
}

/**
 * One row for each DocType that the application asks for (in the order of the form), whether it is
 * uploaded or not, and then the documents that it has though it does not ask for them (the GST
 * certificate of an applicant who is no longer a business). The attachments are not here.
 */
export function documentRows(
  application: HomeLoanApplication,
  /** The record that the folders are those of (as saved, while the sheet edits a working copy) */
  saved: HomeLoanApplication = application,
): DocumentRow[] {
  const required = new Set<string>(requiredDocTypes(application.occupation));
  const documents = application.documents.filter((d) => !isAttachment(d));
  const status = fileStatusOf(application.status);
  const rowFor = (docType: string): DocumentRow => {
    const doc = documents.find((d) => d.docType === docType);
    return {
      docType,
      required: required.has(docType),
      doc,
      status: doc ? status : null,
      place: doc ? placeOf(saved, docType) : null,
    };
  };
  const asked = DOC_TYPES.filter((t) => required.has(t)).map(rowFor);
  const others = documents.filter((d) => !required.has(d.docType)).map((d) => rowFor(d.docType));
  return [...asked, ...others];
}

/** How many of the documents that the application asks for are uploaded. */
export function documentCounts(rows: DocumentRow[]): { uploaded: number; total: number } {
  const asked = rows.filter((r) => r.required);
  return { uploaded: asked.filter((r) => r.doc).length, total: asked.length };
}

// ---------------------------------------------------------------------------
// The attachments
// ---------------------------------------------------------------------------

export interface AttachmentRow {
  doc: ApplicationDocument;
  status: FileStatus;
  place: PlaceOfFile;
  /** Whoever attached it, and the administrator, can remove it */
  canRemove: boolean;
  /** "Priya Kulkarni · 19 Aug 2026, 11:00 AM" */
  subline: string;
}

export function attachmentRows(application: HomeLoanApplication, user: DemoUser): AttachmentRow[] {
  const status = fileStatusOf(application.status);
  return attachmentsOf(application.documents).map((doc) => ({
    doc,
    status,
    place: placeOf(application, doc.docType),
    canRemove: canRemoveAttachment(doc, user),
    subline: [doc.uploadedBy, formatListDateTime(doc.uploadedAt)].filter(Boolean).join(' · '),
  }));
}

// ---------------------------------------------------------------------------
// Preview and download
// ---------------------------------------------------------------------------

/** What the preview needs to know about a file of this application. */
export function previewOfDocument(
  application: HomeLoanApplication,
  doc: ApplicationDocument,
): PreviewFile {
  return {
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    docType: doc.docType,
    uploadedBy: doc.uploadedBy,
    uploadedAt: doc.uploadedAt,
    folderPath: placeOf(application, doc.docType).folderPath,
    applicationId: application.applicationId,
    applicantName: application.fullNameAsPerPan.trim(),
    status: fileStatusOf(application.status),
    note: doc.note,
  };
}

/** The text of the placeholder that a download gives (there is no real file in this demo). */
export function downloadPlaceholder(
  doc: Pick<ApplicationDocument, 'fileName' | 'docType'>,
): string {
  return [
    `Placeholder for ${doc.fileName}`,
    `DocType: ${doc.docType}`,
    '',
    'This is a demo: no real file is stored, so this text takes the place of the document.',
    '',
  ].join('\n');
}

/**
 * Gives the person a placeholder file to save, named as the file is. Nothing is sent anywhere: the
 * text is made in the page. Where the browser cannot make a link to it (a test), nothing happens.
 */
export function downloadMock(doc: Pick<ApplicationDocument, 'fileName' | 'docType'>): boolean {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(new Blob([downloadPlaceholder(doc)], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${doc.fileName}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
