import { useMemo } from 'react';
import {
  buildFileSystem,
  fileRecordsOf,
  liveApplications,
  type FileRecord,
} from '@/data/fileRecords';
import type { FileSystem } from '@/data/fileSystem';
import { GENERAL_FILE_SYSTEM } from '@/data/sampleFiles';
import { useAppStore } from '@/data/store';

/**
 * The file records of every application (the one in the form included), starred or not: one for
 * each document and the Sanction Summary of each approved application. They follow the store, so a
 * file uploaded, removed, replaced or moved by a status change is here at once.
 */
export function useFileRecords(): FileRecord[] {
  const applications = useAppStore((state) => state.applications);
  const draft = useAppStore((state) => state.draft);
  const favouriteFileIds = useAppStore((state) => state.favouriteFileIds);
  return useMemo(
    () => fileRecordsOf(liveApplications(applications, draft), favouriteFileIds),
    [applications, draft, favouriteFileIds],
  );
}

/** The folders and files of Files & Folders: the loans worked out from the records, and the bank's own folders. */
export function useFileSystem(): FileSystem {
  const records = useFileRecords();
  return useMemo(() => buildFileSystem(records, GENERAL_FILE_SYSTEM), [records]);
}
