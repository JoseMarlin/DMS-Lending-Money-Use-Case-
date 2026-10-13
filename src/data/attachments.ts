/**
 * The supporting files that are attached to an application beside its 13 documents, as plain
 * functions (no React, no store). An attachment is a document with the DocType tag "Supporting
 * Document": there can be any number of them, each has a note that is optional, and it is filed in
 * the "05 Other" folder like any file of the application (filePaths.ts). Adding or removing one
 * writes an audit event. Only the person who attached a file, or the administrator, can remove it.
 */
import { maskAadhaarInText } from './aadhaar';
import { DOCX_MIME_TYPE, LIMITS } from './options';
import {
  SUPPORTING_DOCUMENT,
  type ApplicationDocument,
  type DemoUser,
  type DocumentMimeType,
  type HomeLoanApplication,
} from './types';
import { withEventIds, type WorkflowData } from './workflow';

/** What the dialog says when a file cannot be attached (section 7 asks the same of the documents, DOCX added). */
export const ATTACHMENT_ERROR = 'Attach a PDF, JPG, PNG or DOCX up to 5 MB';

/** The longest note, in characters. */
export const MAX_NOTE_LENGTH = 200;

const MIME_BY_EXTENSION: Record<string, DocumentMimeType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  docx: DOCX_MIME_TYPE,
};

/** A file as the browser gives it, or as a seed describes it. */
export interface ChosenFile {
  name: string;
  size: number;
  /** '' when the browser gave no type: the extension then says */
  type: string;
}

/** The allowed type of a file (PDF, JPG, PNG or DOCX), or null. */
export function attachmentMimeType(
  file: Pick<ChosenFile, 'name' | 'type'>,
): DocumentMimeType | null {
  const allowed = Object.values(MIME_BY_EXTENSION) as string[];
  if (file.type) return allowed.includes(file.type) ? (file.type as DocumentMimeType) : null;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? null;
}

/** The error for a file that cannot be attached (a wrong type, empty, or over 5 MB), or null. */
export function validateAttachmentFile(file: ChosenFile): string | null {
  if (!attachmentMimeType(file)) return ATTACHMENT_ERROR;
  if (file.size <= 0 || file.size > LIMITS.maxUploadBytes) return ATTACHMENT_ERROR;
  return null;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export const isAttachment = (doc: Pick<ApplicationDocument, 'docType'>): boolean =>
  doc.docType === SUPPORTING_DOCUMENT;

/** The documents of the form (one for each DocType), without the attachments. */
export const applicationDocuments = (documents: ApplicationDocument[]): ApplicationDocument[] =>
  documents.filter((doc) => !isAttachment(doc));

/** The attachments, oldest first. */
export const attachmentsOf = (documents: ApplicationDocument[]): ApplicationDocument[] =>
  documents
    .filter(isAttachment)
    .sort((a, b) => Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt));

/** The id of the next attachment: the largest number in use plus one. */
export function nextAttachmentId(applicationId: string, documents: ApplicationDocument[]): string {
  const prefix = `${applicationId}-supporting-document-`;
  const last = documents.reduce((max, doc) => {
    if (!doc.id.startsWith(prefix)) return max;
    const n = Number(doc.id.slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${last + 1}`;
}

/** True when this person may remove this attachment: whoever attached it, and the administrator. */
export const canRemoveAttachment = (
  doc: Pick<ApplicationDocument, 'uploadedBy'>,
  user: Pick<DemoUser, 'name' | 'role'>,
): boolean => user.role === 'admin' || doc.uploadedBy === user.name;

// ---------------------------------------------------------------------------
// Adding and removing
// ---------------------------------------------------------------------------

export type AttachmentErrorCode =
  'not-found' | 'invalid-file' | 'note-too-long' | 'no-such-attachment' | 'not-allowed';

export type AttachmentOutcome =
  | {
      ok: true;
      data: WorkflowData;
      application: HomeLoanApplication;
      document: ApplicationDocument;
    }
  | { ok: false; code: AttachmentErrorCode; error: string };

const refuse = (code: AttachmentErrorCode, error: string): AttachmentOutcome => ({
  ok: false,
  code,
  error,
});

const replaceIn = (list: HomeLoanApplication[], next: HomeLoanApplication) =>
  list.map((a) => (a.applicationId === next.applicationId ? next : a));

/** The application, from the working list or else from the master records. */
function find(data: WorkflowData, applicationId: string): HomeLoanApplication | undefined {
  return (
    data.applications.find((a) => a.applicationId === applicationId) ??
    data.masterRecords.find((a) => a.applicationId === applicationId)
  );
}

/** Puts a changed application in the working list and, if it has one, in its master record. */
function put(
  data: WorkflowData,
  next: HomeLoanApplication,
): Pick<WorkflowData, 'applications' | 'masterRecords'> {
  const inApplications = data.applications.some((a) => a.applicationId === next.applicationId);
  return {
    applications: inApplications
      ? replaceIn(data.applications, next)
      : [...data.applications, next],
    masterRecords: data.masterRecords.some((a) => a.applicationId === next.applicationId)
      ? replaceIn(data.masterRecords, next)
      : data.masterRecords,
  };
}

export interface AddAttachmentInput {
  applicationId: string;
  file: ChosenFile & { previewUrl?: string };
  note?: string;
  user: DemoUser;
  now?: Date;
}

/**
 * Attaches a file to an application: a document tagged "Supporting Document" with the note, the
 * person and the time, and the event "Attachment added". Refused for a file that cannot be attached,
 * a note over 200 characters, or an application that is not there. The Aadhaar number is masked in
 * the file name and the note.
 */
export function addAttachment(data: WorkflowData, input: AddAttachmentInput): AttachmentOutcome {
  const { applicationId, file, user, now = new Date() } = input;
  const application = find(data, applicationId);
  if (!application) return refuse('not-found', `There is no application ${applicationId}`);
  const error = validateAttachmentFile(file);
  const mimeType = attachmentMimeType(file);
  if (error || !mimeType) return refuse('invalid-file', error ?? ATTACHMENT_ERROR);
  // the limit is that of what was typed: a number that is masked grows by two characters
  const typed = (input.note ?? '').trim();
  const note = maskAadhaarInText(typed);
  if (typed.length > MAX_NOTE_LENGTH) {
    return refuse('note-too-long', `A note can have at most ${MAX_NOTE_LENGTH} characters`);
  }
  const at = now.toISOString();
  const document: ApplicationDocument = {
    id: nextAttachmentId(applicationId, application.documents),
    docType: SUPPORTING_DOCUMENT,
    fileName: maskAadhaarInText(file.name.trim()),
    mimeType,
    sizeBytes: file.size,
    uploadedAt: at,
    uploadedBy: user.name,
    version: 'v1.0',
    ...(note ? { note } : {}),
    ...(file.previewUrl ? { previewUrl: file.previewUrl } : {}),
  };
  const next: HomeLoanApplication = {
    ...application,
    documents: [...application.documents, document],
    updatedAt: at,
  };
  const [event] = withEventIds(data.auditEvents, [
    {
      applicationId,
      event: 'Attachment added',
      user: user.name,
      at,
      comment: note,
      field: SUPPORTING_DOCUMENT,
      newValue: document.fileName,
    },
  ]);
  return {
    ok: true,
    data: { ...data, ...put(data, next), auditEvents: [...data.auditEvents, event] },
    application: next,
    document,
  };
}

export interface RemoveAttachmentInput {
  applicationId: string;
  documentId: string;
  user: DemoUser;
  now?: Date;
}

/** Removes an attachment (and writes "Attachment removed"): only by whoever attached it, or the administrator. */
export function removeAttachment(
  data: WorkflowData,
  input: RemoveAttachmentInput,
): AttachmentOutcome {
  const { applicationId, documentId, user, now = new Date() } = input;
  const application = find(data, applicationId);
  if (!application) return refuse('not-found', `There is no application ${applicationId}`);
  const document = application.documents.find((d) => d.id === documentId && isAttachment(d));
  if (!document) return refuse('no-such-attachment', 'This attachment is not there any more');
  if (!canRemoveAttachment(document, user)) {
    return refuse(
      'not-allowed',
      'Only the person who attached a file, or the administrator, can remove it',
    );
  }
  const at = now.toISOString();
  const next: HomeLoanApplication = {
    ...application,
    documents: application.documents.filter((d) => d.id !== documentId),
    updatedAt: at,
  };
  const [event] = withEventIds(data.auditEvents, [
    {
      applicationId,
      event: 'Attachment removed',
      user: user.name,
      at,
      field: SUPPORTING_DOCUMENT,
      oldValue: document.fileName,
    },
  ]);
  return {
    ok: true,
    data: { ...data, ...put(data, next), auditEvents: [...data.auditEvents, event] },
    application: next,
    document,
  };
}
