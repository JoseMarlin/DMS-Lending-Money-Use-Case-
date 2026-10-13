/**
 * Where an application's files are, as the Files & Folders screen shows them. Nothing about a
 * folder is stored: the place of a file is worked out from the status of its application and from a
 * few of its fields, every time, so a file goes to its new folder the moment the status changes
 * (PROJECT_OVERVIEW.md section 10, and the journey of Files & Folders):
 *
 *   Draft, KYC Done                          Loans / Home Loan / Drafts / {Application ID} {Name} / {subfolder}
 *   Submitted, In Level 1, In Level 2,
 *   Returned                                 Loans / Home Loan / Pending Approval / ...
 *   Rejected                                 Loans / Home Loan / Rejected / ...
 *   Approved                                 Loans / Home Loan / {Branch} / ...
 *
 * The subfolder follows the DocType: 01 KYC, 02 Income, 03 Property, and 04 Sanction for the
 * Sanction Summary. A draft that has no name yet is called "Draft {Application ID}".
 *
 * This file knows only paths and statuses (no React, no store), so that the workflow, the Files &
 * Folders screen and the review screen all use the same answer.
 */
import { FileStatus } from './fileSystem';
import { DOC_TYPE_GROUPS } from './options';
import {
  ApplicationStatus,
  SUPPORTING_DOCUMENT,
  type DocType,
  type DocTypeGroup,
  type HomeLoanApplication,
} from './types';

/** The folder every Home Loan file is stored under (section 10). */
export const FOLDER_ROOT = 'Loans/Home Loan';
export const LOANS_FOLDER = 'Loans';
export const HOME_LOAN_FOLDER = 'Home Loan';

/** The folders for files that have not been approved. */
export const DRAFTS_FOLDER = 'Drafts';
export const PENDING_FOLDER = 'Pending Approval';
export const REJECTED_FOLDER = 'Rejected';

/** The sub-folder of each DocType group (section 10). */
export const GROUP_FOLDER: Record<DocTypeGroup, string> = {
  KYC: '01 KYC',
  Income: '02 Income',
  Property: '03 Property',
};

/** The sub-folder of the Sanction Summary PDF, which a final approval adds (section 10). */
export const SANCTION_FOLDER = '04 Sanction';
/** The DocType tag of that PDF. It is not a form DocType: it is made by the approval. */
export const SANCTION_DOC_TYPE = 'Sanction Summary';

/** The sub-folder of the supporting files that are attached to an application beside its documents. */
export const OTHER_FOLDER = '05 Other';

/** What a branch folder is called when the application has no branch. */
const NO_BRANCH = 'No branch';

const GROUP_OF = new Map<string, DocTypeGroup>(
  Object.entries(DOC_TYPE_GROUPS).flatMap(([group, types]) =>
    types.map((type): [string, DocTypeGroup] => [type, group as DocTypeGroup]),
  ),
);

/** The sub-folder of a DocType: its group's, 04 Sanction for the Sanction Summary, 01 KYC for any other. */
export function subfolderOf(docType: DocType | string): string {
  if (docType === SANCTION_DOC_TYPE) return SANCTION_FOLDER;
  if (docType === SUPPORTING_DOCUMENT) return OTHER_FOLDER;
  const group = GROUP_OF.get(docType);
  return GROUP_FOLDER[group ?? 'KYC'];
}

/** Where a file stands, from the status of its application. Only Approved is final (Filed). */
export function fileStatusOf(status: ApplicationStatus): FileStatus {
  switch (status) {
    case ApplicationStatus.Draft:
    case ApplicationStatus.KycDone:
      return FileStatus.Draft;
    case ApplicationStatus.Submitted:
    case ApplicationStatus.InLevel1:
    case ApplicationStatus.InLevel2:
      return FileStatus.PendingApproval;
    case ApplicationStatus.Returned:
      return FileStatus.Returned;
    case ApplicationStatus.Rejected:
      return FileStatus.Rejected;
    case ApplicationStatus.Approved:
      return FileStatus.Filed;
  }
}

/**
 * The folder, under Home Loan, that the files of an application are in: Drafts, Pending Approval,
 * Rejected, or its branch once approved. A move from one of these to another is what the screen
 * marks "Moved". (A return and a resubmission stay in Pending Approval, so they do not move.)
 */
export function statusFolderOf(
  application: Pick<HomeLoanApplication, 'status' | 'branch'>,
): string {
  switch (application.status) {
    case ApplicationStatus.Draft:
    case ApplicationStatus.KycDone:
      return DRAFTS_FOLDER;
    case ApplicationStatus.Rejected:
      return REJECTED_FOLDER;
    case ApplicationStatus.Approved:
      return application.branch.trim() || NO_BRANCH;
    default:
      return PENDING_FOLDER;
  }
}

/** "HL-2026-0001 Vijay Kulkarni", or "Draft HL-2026-0006" for a draft that has no name yet. */
export function applicationFolderName(
  application: Pick<HomeLoanApplication, 'applicationId' | 'fullNameAsPerPan' | 'status'>,
): string {
  const name = application.fullNameAsPerPan.trim();
  if (name) return `${application.applicationId} ${name}`;
  const draft =
    application.status === ApplicationStatus.Draft ||
    application.status === ApplicationStatus.KycDone;
  return draft ? `Draft ${application.applicationId}` : application.applicationId;
}

/** The folders from Loans down to the folder of the application. */
export function applicationFolderPath(
  application: Pick<
    HomeLoanApplication,
    'applicationId' | 'fullNameAsPerPan' | 'status' | 'branch'
  >,
): string[] {
  return [
    LOANS_FOLDER,
    HOME_LOAN_FOLDER,
    statusFolderOf(application),
    applicationFolderName(application),
  ];
}

/** The folders from Loans down to the subfolder of one document. */
export function documentFolderPath(
  application: Parameters<typeof applicationFolderPath>[0],
  docType: DocType | string,
): string[] {
  return [...applicationFolderPath(application), subfolderOf(docType)];
}

/** The id of a folder: its path. It is stable, so an address with ?folder= keeps pointing at it. */
export const folderIdOf = (path: string[]): string => path.join('/');

/** "Loans / Home Loan / Pending Approval": a path in words. */
export const pathLabelOf = (path: string[]): string => path.join(' / ');

/** The folder ids from Loans down to a folder, the folder included. */
export function folderIdsAlong(path: string[]): string[] {
  return path.map((_, index) => folderIdOf(path.slice(0, index + 1)));
}
