/**
 * A generic model of folders and files, for the Files & Folders screen: a tree of folders, files
 * that sit in a folder, and plain functions to walk it (the contents of a folder, its counts, the
 * trail to it, a search of the whole tree). It knows nothing of the workflow: a file only carries
 * a status, and the screens draw it. The tree of the loans is worked out from the applications in
 * `fileRecords.ts`; `sampleFiles.ts` has the bank's own folders and a ready-made tree for tests.
 */
import { formatRelativeTime } from '@/lib/format';
import type { DocumentMimeType } from './types';

/** Where a file stands. Only Filed is a final place: the others get a badge on the thumbnail. */
export const FileStatus = {
  Filed: 'Filed',
  Draft: 'Draft',
  PendingApproval: 'Pending approval',
  Returned: 'Returned',
  Rejected: 'Rejected',
} as const;
export type FileStatus = (typeof FileStatus)[keyof typeof FileStatus];

/** The id of the top of the tree. It is not a folder you can see: its folders are on the first screen. */
export const ROOT_ID = 'root';

export interface FolderNode {
  id: string;
  name: string;
  /** ROOT_ID for a folder at the top */
  parentId: string;
  /** ISO date and time the folder was made or changed */
  updatedAt: string;
}

export interface FileNode {
  id: string;
  name: string;
  /** The folder it is in (ROOT_ID for a file at the top) */
  folderId: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
  uploadedBy: string;
  /** ISO date and time */
  uploadedAt: string;
  /** For example 'v1.0' */
  version: string;
  status: FileStatus;
  /** The DocType tag, when it has one (the name of the DocType) */
  docType?: string;
  /** The application it belongs to, when it belongs to one */
  applicationId?: string;
  applicantName?: string;
}

export interface FileSystem {
  folders: FolderNode[];
  files: FileNode[];
}

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true });

export const isRoot = (folderId: string): boolean => folderId === ROOT_ID;

export function folderById(fs: FileSystem, id: string): FolderNode | undefined {
  return fs.folders.find((folder) => folder.id === id);
}

/** The folders directly inside a folder, A to Z. */
export function subfolders(fs: FileSystem, parentId: string): FolderNode[] {
  return fs.folders.filter((folder) => folder.parentId === parentId).sort(byName);
}

/** The files directly inside a folder, A to Z. */
export function filesIn(fs: FileSystem, folderId: string): FileNode[] {
  return fs.files.filter((file) => file.folderId === folderId).sort(byName);
}

/** The ids of a folder and of every folder below it. */
export function folderAndDescendantIds(fs: FileSystem, id: string): Set<string> {
  const found = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of fs.folders) {
      if (!found.has(folder.id) && found.has(folder.parentId)) {
        found.add(folder.id);
        grew = true;
      }
    }
  }
  return found;
}

/** The folders from the top down to this one, ending with it. Empty for the top. */
export function folderTrail(fs: FileSystem, id: string): FolderNode[] {
  const trail: FolderNode[] = [];
  const seen = new Set<string>();
  let current = folderById(fs, id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    current = folderById(fs, current.parentId);
  }
  return trail;
}

/** 'Loans / Home Loan / 01 KYC': where a folder is, in words. */
export function folderPathLabel(fs: FileSystem, id: string): string {
  return folderTrail(fs, id)
    .map((folder) => folder.name)
    .join(' / ');
}

export interface FolderStats {
  /** Folders below it, at any depth */
  folders: number;
  /** Files in it and below it, at any depth */
  files: number;
  /** The latest change inside: the folder itself, a folder below it, or a file. ISO. */
  updatedAt: string;
}

/** What a folder holds, counted down through everything below it. */
export function folderStats(fs: FileSystem, id: string): FolderStats {
  const ids = folderAndDescendantIds(fs, id);
  const inside = fs.files.filter((file) => ids.has(file.folderId));
  const times = [
    ...fs.folders.filter((folder) => ids.has(folder.id)).map((folder) => folder.updatedAt),
    ...inside.map((file) => file.uploadedAt),
  ]
    .map((iso) => Date.parse(iso))
    .filter((time) => !Number.isNaN(time));
  return {
    folders: ids.size - 1,
    files: inside.length,
    updatedAt: times.length > 0 ? new Date(Math.max(...times)).toISOString() : '',
  };
}

/** "3 Folders, 7 files" as the design writes it (the singular is not used there). */
export function folderCountsLabel(stats: Pick<FolderStats, 'folders' | 'files'>): string {
  return `${stats.folders} ${stats.folders === 1 ? 'Folder' : 'Folders'}, ${stats.files} ${stats.files === 1 ? 'file' : 'files'}`;
}

/** "Last updated 5 Secs ago", or nothing when the folder has no date. */
export function folderUpdatedLabel(
  stats: Pick<FolderStats, 'updatedAt'>,
  now: Date = new Date(),
): string {
  const when = formatRelativeTime(stats.updatedAt, now);
  return when ? `Last updated ${when}` : '';
}

/** True when every word of the search is somewhere in the text (the words are in any order). */
const hasAllWords = (text: string, words: string[]) => {
  const lower = text.toLowerCase();
  return words.every((word) => lower.includes(word));
};

/**
 * A search across the whole tree. A folder matches by its name; a file by its name, its DocType, its
 * application ID or the applicant's name. The text is split into words and every word must be in
 * the name (or in one of the other fields): "sale deed" finds Sale_Deed_Vijay.pdf. The case does not
 * matter; an empty search matches nothing (the screens show the folder instead).
 */
export function searchFileSystem(
  fs: FileSystem,
  text: string,
): { folders: FolderNode[]; files: FileNode[] } {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { folders: [], files: [] };
  return {
    folders: fs.folders.filter((folder) => hasAllWords(folder.name, words)).sort(byName),
    files: fs.files
      .filter((file) =>
        // the words may be spread over the fields: "vijay pan" is the PAN card of Vijay
        hasAllWords(
          [file.name, file.docType, file.applicationId, file.applicantName]
            .filter(Boolean)
            .join(' '),
          words,
        ),
      )
      .sort(byName),
  };
}
