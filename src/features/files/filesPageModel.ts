/**
 * What the Files & Folders screen shows, as plain functions so the rules can be tested: which
 * folder is open (it is kept in the address), the trail for the breadcrumb, what a folder or a
 * search gives, the rows of the list view, and what the preview needs to know about a file.
 */
import {
  FileStatus,
  ROOT_ID,
  filesIn,
  folderById,
  folderCountsLabel,
  folderPathLabel,
  folderStats,
  folderTrail,
  folderUpdatedLabel,
  isRoot,
  searchFileSystem,
  subfolders,
  type FileNode,
  type FileSystem,
  type FolderNode,
} from '@/data/fileSystem';
import { formatListDateTime } from '@/lib/format';
import { recordSheetPath } from '@/features/master/paths';
import type { PreviewFile } from './FilePreviewModal';

export const FILES_PATH = '/files';
/** The part of the address that says which folder is open: /files?folder=folder-3 */
export const FOLDER_PARAM = 'folder';
/** The name of the top of the tree, in the breadcrumb and in the Folder column */
export const ROOT_LABEL = 'Files & Folders';

export type FilesView = 'grid' | 'list';

/**
 * The size of the file cards is the narrowest a card may be, in pixels; the cards then share the
 * row. At the start six cards fit a 1366px screen, as in the design (168px each); the slider goes
 * from 75% to 150% of that.
 */
export const ZOOM = { min: 120, max: 240, step: 8, initial: 160 } as const;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return ZOOM.initial;
  return Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(value)));
}

/** The card size as a percentage of the design's, for the slider's spoken value. */
export function zoomPercent(zoom: number): number {
  return Math.round((zoom / ZOOM.initial) * 100);
}

/** Where a folder is opened. The top of the tree is the page itself. */
export function folderLink(folderId: string): string {
  return isRoot(folderId)
    ? FILES_PATH
    : `${FILES_PATH}?${FOLDER_PARAM}=${encodeURIComponent(folderId)}`;
}

/** The folder the address asks for: that folder if it exists, else the top of the tree. */
export function currentFolderId(fs: FileSystem, param: string | null): string {
  return param && folderById(fs, param) ? param : ROOT_ID;
}

export interface Crumb {
  label: string;
  to: string;
}

/** "Files & Folders > Loans > Home Loan": nothing at the top of the tree, where there is no trail. */
export function breadcrumbFor(fs: FileSystem, folderId: string): Crumb[] {
  const trail = folderTrail(fs, folderId);
  if (trail.length === 0) return [];
  return [
    { label: ROOT_LABEL, to: FILES_PATH },
    ...trail.map((folder) => ({ label: folder.name, to: folderLink(folder.id) })),
  ];
}

export interface FolderContents {
  /** a folder that is open, or the results of a search across the whole tree */
  mode: 'folder' | 'search';
  folders: FolderNode[];
  files: FileNode[];
}

/** A search looks through the whole tree; with nothing typed, the open folder is shown. */
export function contentsOf(fs: FileSystem, folderId: string, query: string): FolderContents {
  if (query.trim() !== '') return { mode: 'search', ...searchFileSystem(fs, query) };
  return { mode: 'folder', folders: subfolders(fs, folderId), files: filesIn(fs, folderId) };
}

/** "3 Folders, 7 files" and "Last updated 5 Secs ago", for a folder card or a list row. */
export function folderCardText(fs: FileSystem, folder: FolderNode, now: Date) {
  const stats = folderStats(fs, folder.id);
  return { counts: folderCountsLabel(stats), updated: folderUpdatedLabel(stats, now) };
}

/** What the Folder column says: the top, a folder at the top, or "... / 01 KYC" for one further down. */
export function folderCellLabel(fs: FileSystem, folderId: string): string {
  const trail = folderTrail(fs, folderId);
  if (trail.length === 0) return ROOT_LABEL;
  if (trail.length === 1) return trail[0].name;
  return `... / ${trail[trail.length - 1].name}`;
}

export interface ListRow {
  id: string;
  kind: 'folder' | 'file';
  name: string;
  /** file: "Priya Kulkarni · 9 Oct 2026, 6:23 PM"; folder: "2 Folders, 8 files · Last updated 5 Hours ago" */
  subline: string;
  docType: string;
  /** The folder it is in, short; and in full for the tooltip */
  folderLabel: string;
  folderPath: string;
  /** null for a folder: it has no status */
  status: FileStatus | null;
  folder?: FolderNode;
  file?: FileNode;
  /** A folder that files were moved into and nobody opened since */
  moved?: boolean;
}

/** The rows of the list view: the folders first, then the files, each in the order given. */
export function listRows(fs: FileSystem, contents: FolderContents, now: Date): ListRow[] {
  const folderRows = contents.folders.map<ListRow>((folder) => {
    const text = folderCardText(fs, folder, now);
    return {
      id: folder.id,
      kind: 'folder',
      name: folder.name,
      subline: [text.counts, text.updated].filter(Boolean).join(' · '),
      docType: '',
      folderLabel: folderCellLabel(fs, folder.parentId),
      folderPath: folderPathLabel(fs, folder.parentId) || ROOT_LABEL,
      status: null,
      folder,
    };
  });
  const fileRows = contents.files.map<ListRow>((file) => ({
    id: file.id,
    kind: 'file',
    name: file.name,
    subline: [file.uploadedBy, formatListDateTime(file.uploadedAt)].filter(Boolean).join(' · '),
    docType: file.docType ?? '',
    folderLabel: folderCellLabel(fs, file.folderId),
    folderPath: folderPathLabel(fs, file.folderId) || ROOT_LABEL,
    status: file.status,
    file,
  }));
  return [...folderRows, ...fileRows];
}

/** What the preview of a file needs: the file, its place, and the application it belongs to. */
export function previewOf(
  fs: FileSystem,
  file: FileNode,
  /** Whether the store has this application (and this applicant); without it the link is always given */
  recordExists?: (applicationId: string, applicantName: string | undefined) => boolean,
): PreviewFile {
  return {
    fileName: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    docType: file.docType ?? '',
    uploadedBy: file.uploadedBy,
    uploadedAt: file.uploadedAt,
    folderPath: folderPathLabel(fs, file.folderId) || ROOT_LABEL,
    applicationId: file.applicationId,
    applicantName: file.applicantName,
    status: file.status,
    recordHref:
      file.applicationId && (recordExists?.(file.applicationId, file.applicantName) ?? true)
        ? recordSheetPath(file.applicationId)
        : undefined,
  };
}

/** What a screen reader is told when the open folder or the search changes. */
export function announcement(fs: FileSystem, folderId: string, query: string): string {
  const text = query.trim();
  if (text !== '') {
    const { folders, files } = contentsOf(fs, folderId, query);
    const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    return `${count(folders.length, 'folder', 'folders')} and ${count(files.length, 'file', 'files')} match "${text}"`;
  }
  // what is in the folder itself, as on the screen (a folder card counts everything below it)
  const { folders, files } = contentsOf(fs, folderId, '');
  const name = folderById(fs, folderId)?.name ?? ROOT_LABEL;
  return `${name}: ${folderCountsLabel({ folders: folders.length, files: files.length })}`;
}
