/**
 * The files of the journey, as plain functions (no React, no store). Every document uploaded in
 * the form is one FileRecord; the records are worked out from the applications each time, so a file
 * is always where its application's status puts it:
 *
 *  - a document that is uploaded makes a record, and one that is removed in the form takes its record away;
 *  - a document that is replaced is the same record with the next version (v1.0, v1.1, ...);
 *  - the folder tree and the path of each file are worked out from the status (filePaths.ts), never stored;
 *  - a final approval adds the Sanction Summary PDF to the record's 04 Sanction folder.
 *
 * What is kept is only the documents on the applications (and, in the store, which files are starred
 * and which folders were moved and not opened yet). Nothing here is written anywhere.
 */
import {
  ROOT_ID,
  type FileNode,
  type FileStatus,
  type FileSystem,
  type FolderNode,
} from './fileSystem';
import {
  DRAFTS_FOLDER,
  HOME_LOAN_FOLDER,
  LOANS_FOLDER,
  PENDING_FOLDER,
  REJECTED_FOLDER,
  SANCTION_DOC_TYPE,
  applicationFolderPath,
  documentFolderPath,
  fileStatusOf,
  folderIdOf,
  folderIdsAlong,
  pathLabelOf,
  statusFolderOf,
} from './filePaths';
import {
  ApplicationStatus,
  type ApplicationDocument,
  type DocumentMimeType,
  type HomeLoanApplication,
} from './types';

/** One file of an application, with where it is. The place is worked out, not stored. */
export interface FileRecord {
  /** Stable: the same for a file and for its next version */
  id: string;
  fileName: string;
  /** The DocType tag ('Sanction Summary' for the PDF that an approval adds) */
  docType: string;
  applicationId: string;
  applicantName: string;
  uploadedBy: string;
  /** ISO date and time */
  uploadedAt: string;
  /** 'v1.0', then 'v1.1' when the file is replaced */
  version: string;
  sizeBytes: number;
  mimeType: DocumentMimeType;
  /** Starred on the Files & Folders screen */
  favourite: boolean;
  /** Draft, Pending approval, Returned, Rejected, or Filed (Approved): from the application */
  status: FileStatus;
  /** The folders from Loans down to the one the file is in */
  path: string[];
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/** The version of a file that has none written (an upload, or a file of the seed). */
export const FIRST_VERSION = 'v1.0';

/** 'v1.0' -> 'v1.1', 'v1.9' -> 'v1.10'. A version that cannot be read is taken as the first. */
export function nextVersion(version: string | undefined): string {
  const match = /^v(\d+)\.(\d+)$/.exec(version ?? '');
  const [major, minor] = match ? [Number(match[1]), Number(match[2])] : [1, 0];
  return `v${major}.${minor + 1}`;
}

// ---------------------------------------------------------------------------
// The applications that have files
// ---------------------------------------------------------------------------

const time = (iso: string): number => {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * The applications as they are now: the saved ones, with the one in the form laid over its saved
 * copy (the newer of the two when both are there), and added when it is not saved yet, so that a
 * file uploaded in the form is on Files & Folders at once. A blank draft has no files and adds nothing.
 */
export function liveApplications(
  applications: HomeLoanApplication[],
  draft: HomeLoanApplication,
): HomeLoanApplication[] {
  const saved = applications.some((a) => a.applicationId === draft.applicationId);
  if (!saved) return draft.documents.length > 0 ? [...applications, draft] : applications;
  return applications.map((a) =>
    a.applicationId === draft.applicationId && time(draft.updatedAt) >= time(a.updatedAt)
      ? draft
      : a,
  );
}

// ---------------------------------------------------------------------------
// The records
// ---------------------------------------------------------------------------

const SANCTION_SUMMARY_SIZE = 91_136;

const underscored = (text: string) => text.trim().replace(/\s+/g, '_');

/** The Sanction Summary of an approved application: made by the approval, not uploaded. */
function sanctionSummaryOf(application: HomeLoanApplication, favourite: boolean): FileRecord {
  const name = underscored(application.fullNameAsPerPan) || application.applicationId;
  return {
    id: `${application.applicationId}-sanction-summary`,
    fileName: `Sanction_Summary_${name}.pdf`,
    docType: SANCTION_DOC_TYPE,
    applicationId: application.applicationId,
    applicantName: application.fullNameAsPerPan.trim(),
    uploadedBy: 'System',
    // a moment after the approval, which is when the record is made
    uploadedAt: new Date(
      time(application.level2Time || application.updatedAt) + 1000,
    ).toISOString(),
    version: FIRST_VERSION,
    sizeBytes: SANCTION_SUMMARY_SIZE,
    mimeType: 'application/pdf',
    favourite,
    status: fileStatusOf(application.status),
    path: documentFolderPath(application, SANCTION_DOC_TYPE),
  };
}

function recordOf(
  application: HomeLoanApplication,
  doc: ApplicationDocument,
  favourite: boolean,
): FileRecord {
  return {
    id: doc.id,
    fileName: doc.fileName,
    docType: doc.docType,
    applicationId: application.applicationId,
    applicantName: application.fullNameAsPerPan.trim(),
    uploadedBy: doc.uploadedBy,
    uploadedAt: doc.uploadedAt,
    version: doc.version || FIRST_VERSION,
    sizeBytes: doc.sizeBytes,
    mimeType: doc.mimeType,
    favourite,
    status: fileStatusOf(application.status),
    path: documentFolderPath(application, doc.docType),
  };
}

/**
 * The file records of some applications: one for each document, in the order they were uploaded,
 * and the Sanction Summary of each approved application after its documents.
 */
export function fileRecordsOf(
  applications: HomeLoanApplication[],
  favouriteIds: readonly string[] = [],
): FileRecord[] {
  const starred = new Set(favouriteIds);
  return applications.flatMap((application) => [
    ...application.documents.map((doc) => recordOf(application, doc, starred.has(doc.id))),
    ...(application.status === ApplicationStatus.Approved
      ? [
          sanctionSummaryOf(
            application,
            starred.has(`${application.applicationId}-sanction-summary`),
          ),
        ]
      : []),
  ]);
}

/** The records of one application. */
export const fileRecordsOfApplication = (
  application: HomeLoanApplication,
  favouriteIds: readonly string[] = [],
): FileRecord[] => fileRecordsOf([application], favouriteIds);

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

/**
 * The folders and files for Files & Folders, from the records: the structure of section 10 is always
 * there (Loans, Home Loan, Drafts, Pending Approval, Rejected), a folder for each branch with an
 * approved application and for each application, and its subfolders. The folder id is its path.
 * `general` is whatever else the screen shows beside the loans (policies, templates...).
 */
export function buildFileSystem(records: FileRecord[], general?: FileSystem): FileSystem {
  const folders = new Map<string, FolderNode>();
  const addFolders = (path: string[]) => {
    path.forEach((name, index) => {
      const id = folderIdOf(path.slice(0, index + 1));
      if (folders.has(id)) return;
      folders.set(id, {
        id,
        name,
        parentId: index === 0 ? ROOT_ID : folderIdOf(path.slice(0, index)),
        updatedAt: '', // the time of a folder comes from the files in it
      });
    });
  };
  for (const status of [DRAFTS_FOLDER, PENDING_FOLDER, REJECTED_FOLDER]) {
    addFolders([LOANS_FOLDER, HOME_LOAN_FOLDER, status]);
  }
  records.forEach((record) => addFolders(record.path));

  const files: FileNode[] = records.map((record) => ({
    id: record.id,
    name: record.fileName,
    folderId: folderIdOf(record.path),
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    uploadedBy: record.uploadedBy,
    uploadedAt: record.uploadedAt,
    version: record.version,
    status: record.status,
    docType: record.docType,
    applicationId: record.applicationId,
    applicantName: record.applicantName,
  }));

  return {
    folders: [...folders.values(), ...(general?.folders ?? [])],
    files: [...files, ...(general?.files ?? [])],
  };
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/**
 * The folders that a change of status moved files into: for each application whose files went from
 * one of Drafts, Pending Approval, Rejected or its branch to another, the new folder of the
 * application and the folders above it (so that a "Moved" mark can be followed down from the top).
 * A return, a resubmission and a rename are not moves.
 */
export function movedFolderIds(
  before: HomeLoanApplication[],
  after: HomeLoanApplication[],
): string[] {
  const moved = new Set<string>();
  for (const next of after) {
    const previous = before.find((a) => a.applicationId === next.applicationId);
    if (!previous || next.documents.length === 0) continue;
    if (statusFolderOf(previous) === statusFolderOf(next)) continue;
    folderIdsAlong(applicationFolderPath(next)).forEach((id) => moved.add(id));
  }
  return [...moved];
}

/** An application folder is Loans / Home Loan / {place} / {application}: four folders down. */
const APPLICATION_FOLDER_DEPTH = 4;

/**
 * The "Moved" marks that still mean something: a mark on a folder that is no longer in the tree (the
 * files moved on, or the application was renamed) goes, and so does a mark on a folder above an
 * application folder (Loans, Home Loan, Pending Approval...) when no marked application folder is
 * left below it. So the trail of marks from the top is followed down by opening the folders one by
 * one, and an application folder that is opened through a link takes the trail above it with it.
 */
export function pruneMovedFolders(
  ids: readonly string[],
  applications: HomeLoanApplication[],
): string[] {
  const inTree = new Set(buildFileSystem(fileRecordsOf(applications)).folders.map((f) => f.id));
  const depth = (id: string) => id.split('/').length;
  // from the deepest folder up: a folder above an application folder stays only if a mark that stays is below it
  const deepestFirst = [...new Set(ids)]
    .filter((id) => inTree.has(id))
    .sort((a, b) => depth(b) - depth(a));
  const kept: string[] = [];
  for (const id of deepestFirst) {
    if (depth(id) >= APPLICATION_FOLDER_DEPTH || kept.some((other) => other.startsWith(`${id}/`))) {
      kept.push(id);
    }
  }
  // in the order they were given
  return ids.filter((id, index) => kept.includes(id) && ids.indexOf(id) === index);
}

// ---------------------------------------------------------------------------
// What a final approval or a rejection says about the files
// ---------------------------------------------------------------------------

export interface FilesNotice {
  /** "Files stored in Loans / Home Loan / {Branch} / {Application ID}" or "Files held in Rejected" */
  message: string;
  /** The folder "Open folder" goes to */
  folderId: string;
}

/** The sentence for the toast after a decision that moved the files, or null for one that did not. */
export function filesNoticeFor(application: HomeLoanApplication): FilesNotice | null {
  if (application.documents.length === 0) return null;
  const folder = folderIdOf(applicationFolderPath(application));
  if (application.status === ApplicationStatus.Approved) {
    return {
      message: `Files stored in ${pathLabelOf([
        LOANS_FOLDER,
        HOME_LOAN_FOLDER,
        statusFolderOf(application),
        application.applicationId,
      ])}`,
      folderId: folder,
    };
  }
  if (application.status === ApplicationStatus.Rejected) {
    return { message: `Files held in ${REJECTED_FOLDER}`, folderId: folder };
  }
  return null;
}
