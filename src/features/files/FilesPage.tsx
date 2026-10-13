import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, SearchInput } from '@/components/ui';
import { ChevronDownIcon, PlusIcon } from '@/components/ui/icons';
import { folderById, type FileSystem } from '@/data/fileSystem';
import { useAppStore } from '@/data/store';
import { usePageTitle } from '@/lib/usePageTitle';
import FileCard from './FileCard';
import FilePreviewModal from './FilePreviewModal';
import FilesListView from './FilesListView';
import FilesSection from './FilesSection';
import FolderBreadcrumb from './FolderBreadcrumb';
import FolderCard from './FolderCard';
import { useFileSystem } from './useFileSystem';
import ViewToggle from './ViewToggle';
import ZoomControl from './ZoomControl';
import {
  FOLDER_PARAM,
  ROOT_LABEL,
  ZOOM,
  announcement,
  breadcrumbFor,
  contentsOf,
  currentFolderId,
  folderCardText,
  folderLink,
  listRows,
  previewOf,
  type FilesView,
} from './filesPageModel';

/**
 * /files: Files & Folders, laid out like the Figma frame (DMS--24, node 299:6140). A title with an
 * "Add New" button (drawn only), a search box and a list/grid switch, then the folders as cards and
 * the files as cards with a zoom, or one table in the list view. A folder opens in the same page
 * (?folder=...), with a breadcrumb above the title; the search looks through the whole tree.
 *
 * The loans are worked out from the applications (`src/data/fileRecords.ts`): every document of the
 * form is a file here, in the folder its application's status puts it in, and a folder that files were
 * moved into carries a "Moved" mark until it is opened. The stars (favourites) are kept in the store.
 */
export default function FilesPage({
  fileSystem: given,
  now,
}: {
  /** The tree to show. The one worked out from the applications unless a test gives another. */
  fileSystem?: FileSystem;
  /** What "ago" counts from. The moment the page opened unless a test gives another. */
  now?: Date;
}) {
  usePageTitle(ROOT_LABEL);
  const derived = useFileSystem();
  const fileSystem = given ?? derived;
  const [params] = useSearchParams();
  const [openedAt] = useState(() => new Date());
  const clock = now ?? openedAt;

  const folderId = currentFolderId(fileSystem, params.get(FOLDER_PARAM));
  const [query, setQuery] = useState('');
  const [view, setView] = useState<FilesView>('grid');
  const [zoom, setZoom] = useState<number>(ZOOM.initial);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const favouriteFileIds = useAppStore((state) => state.favouriteFileIds);
  const applications = useAppStore((state) => state.applications);
  const masterRecords = useAppStore((state) => state.masterRecords);
  const toggleFavouriteFile = useAppStore((state) => state.toggleFavouriteFile);
  const movedFolders = useAppStore((state) => state.movedFolders);
  const clearMovedFolder = useAppStore((state) => state.clearMovedFolder);

  // a folder that is opened has been seen: its "Moved" mark goes
  useEffect(() => {
    if (movedFolders.includes(folderId)) clearMovedFolder(folderId);
  }, [folderId, movedFolders, clearMovedFolder]);
  const isMoved = (id: string) => movedFolders.includes(id) && id !== folderId;

  // Opening another folder moves the cursor to its contents, so a keyboard user is not left on a
  // card that has gone, and a screen reader says where it is
  const regionRef = useRef<HTMLElement>(null);
  const shownFolder = useRef(folderId);
  useEffect(() => {
    if (shownFolder.current !== folderId) {
      shownFolder.current = folderId;
      regionRef.current?.focus();
    }
  }, [folderId]);

  const contents = contentsOf(fileSystem, folderId, query);
  const searching = contents.mode === 'search';
  const isEmpty = contents.folders.length === 0 && contents.files.length === 0;
  const crumbs = breadcrumbFor(fileSystem, folderId);
  const folderName = folderById(fileSystem, folderId)?.name ?? ROOT_LABEL;
  const previewFile = previewId
    ? fileSystem.files.find((file) => file.id === previewId)
    : undefined;
  const isFavourite = (fileId: string) => favouriteFileIds.includes(fileId);
  // "View record" is for an application that is in the store, with the same applicant (the sample tree
  // has applications of its own, and a new application may be given the same ID)
  const recordExists = (applicationId: string, applicantName: string | undefined) =>
    [...masterRecords, ...applications].some(
      (a) =>
        a.applicationId === applicationId &&
        (applicantName === undefined || a.fullNameAsPerPan.trim() === applicantName.trim()),
    );
  // the button or link that was used goes away with the results: the cursor goes to the contents
  const clearSearch = () => {
    if (query === '') return;
    setQuery('');
    regionRef.current?.focus();
  };

  const emptyState = searching ? (
    <EmptyState
      bordered={false}
      title={`No results for “${query.trim()}”`}
      action={
        <Button variant="outline" onClick={clearSearch}>
          Clear search
        </Button>
      }
    >
      Check the spelling, or search by file name, DocType, application ID or applicant name.
    </EmptyState>
  ) : (
    <EmptyState bordered={false} title="This folder is empty">
      Files and folders added here will appear in this place.
    </EmptyState>
  );

  return (
    <div className="px-5 pt-5 pb-10">
      {crumbs.length > 0 ? <FolderBreadcrumb crumbs={crumbs} onNavigate={clearSearch} /> : null}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] leading-7 font-semibold text-ink">{ROOT_LABEL}</h1>
        {/* "Add New" and its arrow are only drawn: nothing is added in this demo */}
        <Button className="pr-4! pl-2.5!">
          <span className="flex items-center">
            <PlusIcon size={24} />
            <span className="ml-[9px] text-[16px] leading-6">Add New</span>
            <span
              aria-hidden
              className="ml-1.5 flex items-center border-l border-white/30 pl-[5px]"
            >
              <ChevronDownIcon size={16} />
            </span>
          </span>
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <SearchInput
          size="md"
          label="Search File & Folders"
          value={query}
          onChange={setQuery}
          className="max-w-[302px]"
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <p role="status" className="sr-only">
        {announcement(fileSystem, folderId, query)}
      </p>

      <section
        ref={regionRef}
        tabIndex={-1}
        aria-label={`Contents of ${searching ? 'the search' : folderName}`}
        className="mt-3.5 outline-none"
      >
        {searching && !isEmpty ? (
          <p className="mb-3 text-body-m text-subtle">
            Results for “{query.trim()}” in all folders
          </p>
        ) : null}

        {isEmpty ? (
          emptyState
        ) : view === 'list' ? (
          <FilesListView
            rows={listRows(fileSystem, contents, clock).map((row) =>
              row.folder ? { ...row, moved: isMoved(row.id) } : row,
            )}
            onOpenFolder={clearSearch}
            onPreview={setPreviewId}
            isFavourite={isFavourite}
            onToggleFavourite={toggleFavouriteFile}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {contents.folders.length > 0 ? (
              <FilesSection title="Folders">
                <ul
                  className="grid gap-4"
                  // four columns on a wide screen, fewer when a card would be narrower than 248px
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(max(248px, calc((100% - 3rem) / 4)), 1fr))',
                  }}
                >
                  {contents.folders.map((folder) => {
                    const text = folderCardText(fileSystem, folder, clock);
                    return (
                      <li key={folder.id} className="min-w-0">
                        <FolderCard
                          name={folder.name}
                          to={folderLink(folder.id)}
                          counts={text.counts}
                          updated={text.updated}
                          moved={isMoved(folder.id)}
                          location={
                            searching
                              ? (folderById(fileSystem, folder.parentId)?.name ?? ROOT_LABEL)
                              : undefined
                          }
                          onOpen={clearSearch}
                        />
                      </li>
                    );
                  })}
                </ul>
              </FilesSection>
            ) : null}

            <FilesSection title="Files" actions={<ZoomControl value={zoom} onChange={setZoom} />}>
              {contents.files.length > 0 ? (
                <ul
                  className="grid gap-x-4 gap-y-5"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${zoom}px, 1fr))` }}
                >
                  {contents.files.map((file) => (
                    <li key={file.id} className="min-w-0">
                      <FileCard
                        file={file}
                        iconSize={Math.round(zoom * 0.36)}
                        favourite={isFavourite(file.id)}
                        onToggleFavourite={() => toggleFavouriteFile(file.id)}
                        onOpen={() => setPreviewId(file.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-m text-subtle">
                  {searching ? 'No files match your search.' : 'There are no files in this folder.'}
                </p>
              )}
            </FilesSection>
          </div>
        )}
      </section>

      <FilePreviewModal
        file={previewFile ? previewOf(fileSystem, previewFile, recordExists) : null}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
}
