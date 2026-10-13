import {
  FileStatus,
  ROOT_ID,
  filesIn,
  folderAndDescendantIds,
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
} from './fileSystem';

const NOW = new Date('2026-10-12T12:00:00Z');
const t = (secondsAgo: number) => new Date(NOW.getTime() - secondsAgo * 1000).toISOString();

const folder = (id: string, name: string, parentId: string, secondsAgo = 99999): FolderNode => ({
  id,
  name,
  parentId,
  updatedAt: t(secondsAgo),
});
const file = (
  id: string,
  name: string,
  folderId: string,
  secondsAgo: number,
  extra: Partial<FileNode> = {},
): FileNode => ({
  id,
  name,
  folderId,
  mimeType: 'application/pdf',
  sizeBytes: 1000,
  uploadedBy: 'Priya Kulkarni',
  uploadedAt: t(secondsAgo),
  version: 'v1.0',
  status: FileStatus.Filed,
  ...extra,
});

/**
 *  Loans
 *    Home Loan
 *      HL-1 Ramesh Patil
 *        01 KYC        (PAN Card file, 60 s ago)
 *        02 Income     (empty)
 *    Archive          (empty)
 *  root file: Guide.pdf
 */
const FS: FileSystem = {
  folders: [
    folder('loans', 'Loans', ROOT_ID, 5000),
    folder('hl', 'Home Loan', 'loans', 5000),
    folder('app', 'HL-1 Ramesh Patil', 'hl', 4000),
    folder('kyc', '01 KYC', 'app', 3000),
    folder('inc', '02 Income', 'app', 3000),
    folder('arch', 'Archive', ROOT_ID, 200000),
  ],
  files: [
    file('f1', 'PAN_Card_Ramesh_Patil.pdf', 'kyc', 60, {
      docType: 'PAN Card',
      applicationId: 'HL-1',
      applicantName: 'Ramesh Patil',
    }),
    file('f2', 'Aadhaar_Masked_Copy_Ramesh_Patil.pdf', 'kyc', 90, {
      docType: 'Aadhaar (Masked Copy)',
      applicationId: 'HL-1',
      applicantName: 'Ramesh Patil',
      status: FileStatus.PendingApproval,
    }),
    file('f3', 'Guide.pdf', ROOT_ID, 400),
  ],
};

describe('the top of the tree', () => {
  it('has an id of its own and is not a folder', () => {
    expect(isRoot(ROOT_ID)).toBe(true);
    expect(isRoot('loans')).toBe(false);
    expect(folderById(FS, ROOT_ID)).toBeUndefined();
  });
});

describe('subfolders and filesIn', () => {
  it('give what is directly in a folder, A to Z', () => {
    expect(subfolders(FS, ROOT_ID).map((f) => f.name)).toEqual(['Archive', 'Loans']);
    expect(subfolders(FS, 'app').map((f) => f.name)).toEqual(['01 KYC', '02 Income']);
    expect(filesIn(FS, 'kyc').map((f) => f.name)).toEqual([
      'Aadhaar_Masked_Copy_Ramesh_Patil.pdf',
      'PAN_Card_Ramesh_Patil.pdf',
    ]);
    expect(filesIn(FS, ROOT_ID).map((f) => f.name)).toEqual(['Guide.pdf']);
  });

  it('give nothing for an empty folder, an unknown folder or a folder that holds only folders', () => {
    expect(filesIn(FS, 'arch')).toEqual([]);
    expect(subfolders(FS, 'arch')).toEqual([]);
    expect(filesIn(FS, 'nowhere')).toEqual([]);
    expect(filesIn(FS, 'hl')).toEqual([]);
  });

  it('count numbers the way a person does (2 before 10)', () => {
    const fs: FileSystem = {
      folders: [
        folder('a', 'Folder 10', ROOT_ID),
        folder('b', 'Folder 2', ROOT_ID),
        folder('c', 'folder 1', ROOT_ID),
      ],
      files: [],
    };
    expect(subfolders(fs, ROOT_ID).map((f) => f.name)).toEqual([
      'folder 1',
      'Folder 2',
      'Folder 10',
    ]);
  });
});

describe('folderAndDescendantIds', () => {
  it('has the folder and everything below it, at any depth', () => {
    expect([...folderAndDescendantIds(FS, 'loans')].sort()).toEqual([
      'app',
      'hl',
      'inc',
      'kyc',
      'loans',
    ]);
    expect([...folderAndDescendantIds(FS, 'kyc')]).toEqual(['kyc']);
  });

  it('is safe when the tree has a loop', () => {
    const loop: FileSystem = { folders: [folder('a', 'A', 'b'), folder('b', 'B', 'a')], files: [] };
    expect([...folderAndDescendantIds(loop, 'a')].sort()).toEqual(['a', 'b']);
  });
});

describe('folderTrail and folderPathLabel', () => {
  it('lists the folders from the top down to this one', () => {
    expect(folderTrail(FS, 'kyc').map((f) => f.name)).toEqual([
      'Loans',
      'Home Loan',
      'HL-1 Ramesh Patil',
      '01 KYC',
    ]);
    expect(folderTrail(FS, 'loans').map((f) => f.name)).toEqual(['Loans']);
  });

  it('is empty for the top and for a folder that is not there', () => {
    expect(folderTrail(FS, ROOT_ID)).toEqual([]);
    expect(folderTrail(FS, 'nowhere')).toEqual([]);
  });

  it('stops at a loop instead of going round for ever', () => {
    const loop: FileSystem = { folders: [folder('a', 'A', 'b'), folder('b', 'B', 'a')], files: [] };
    expect(folderTrail(loop, 'a').length).toBeLessThanOrEqual(2);
  });

  it('writes the path in words', () => {
    expect(folderPathLabel(FS, 'kyc')).toBe('Loans / Home Loan / HL-1 Ramesh Patil / 01 KYC');
    expect(folderPathLabel(FS, ROOT_ID)).toBe('');
  });
});

describe('folderStats', () => {
  it('counts the folders and the files below, at any depth', () => {
    expect(folderStats(FS, 'loans')).toMatchObject({ folders: 4, files: 2 });
    expect(folderStats(FS, 'app')).toMatchObject({ folders: 2, files: 2 });
    expect(folderStats(FS, 'kyc')).toMatchObject({ folders: 0, files: 2 });
  });

  it('is 0 and 0 for an empty folder, with the date of the folder itself', () => {
    expect(folderStats(FS, 'arch')).toEqual({ folders: 0, files: 0, updatedAt: t(200000) });
    expect(folderStats(FS, 'inc')).toMatchObject({ folders: 0, files: 0 });
  });

  it('takes the latest change inside as the last update', () => {
    // the newest thing under Loans is the PAN Card file, 60 seconds ago
    expect(folderStats(FS, 'loans').updatedAt).toBe(t(60));
    expect(folderStats(FS, 'kyc').updatedAt).toBe(t(60));
    // a folder with no files takes its own date, or the newest folder below it
    expect(folderStats(FS, 'inc').updatedAt).toBe(t(3000));
  });

  it('is empty-dated for a folder that does not exist', () => {
    expect(folderStats(FS, 'nowhere')).toMatchObject({ folders: 0, files: 0 });
  });
});

describe('the words on a folder card', () => {
  it('writes the counts as in the design, and the singular for one', () => {
    expect(folderCountsLabel({ folders: 0, files: 0 })).toBe('0 Folders, 0 files');
    expect(folderCountsLabel({ folders: 4, files: 12 })).toBe('4 Folders, 12 files');
    expect(folderCountsLabel({ folders: 1, files: 1 })).toBe('1 Folder, 1 file');
  });

  it('writes the last update as a time ago, or nothing without a date', () => {
    expect(folderUpdatedLabel({ updatedAt: t(5) }, NOW)).toBe('Last updated 5 Secs ago');
    expect(folderUpdatedLabel({ updatedAt: t(3 * 3600) }, NOW)).toBe('Last updated 3 Hours ago');
    expect(folderUpdatedLabel({ updatedAt: '' }, NOW)).toBe('');
  });
});

describe('searchFileSystem', () => {
  it('finds a file by its name, in any folder, in any case', () => {
    expect(searchFileSystem(FS, 'pan_card').files.map((f) => f.id)).toEqual(['f1']);
    expect(searchFileSystem(FS, 'GUIDE').files.map((f) => f.id)).toEqual(['f3']);
  });

  it('finds a file by its DocType, its application ID and the applicant name', () => {
    expect(searchFileSystem(FS, 'aadhaar (masked').files.map((f) => f.id)).toEqual(['f2']);
    expect(searchFileSystem(FS, 'hl-1').files.map((f) => f.id)).toEqual(['f2', 'f1']); // A to Z by name
    expect(
      searchFileSystem(FS, 'ramesh patil')
        .files.map((f) => f.id)
        .sort(),
    ).toEqual(['f1', 'f2']);
    expect(searchFileSystem(FS, 'patil').files).toHaveLength(2);
  });

  it('finds a file by several words, in any order, though its name has underscores', () => {
    expect(searchFileSystem(FS, 'pan card').files.map((f) => f.id)).toEqual(['f1']);
    expect(searchFileSystem(FS, 'ramesh pan').files.map((f) => f.id)).toEqual(['f1']);
    expect(searchFileSystem(FS, 'patil ramesh').files).toHaveLength(2);
    // every word has to be there
    expect(searchFileSystem(FS, 'pan zzzz')).toEqual({ folders: [], files: [] });
  });

  it('finds a folder by several words of its name', () => {
    expect(searchFileSystem(FS, 'ramesh hl-1').folders.map((f) => f.id)).toEqual(['app']);
    expect(searchFileSystem(FS, 'home loan').folders.map((f) => f.id)).toEqual(['hl']);
  });

  it('finds a folder by its name, anywhere in the tree', () => {
    expect(searchFileSystem(FS, 'kyc').folders.map((f) => f.id)).toEqual(['kyc']);
    expect(searchFileSystem(FS, 'ramesh').folders.map((f) => f.id)).toEqual(['app']);
    expect(searchFileSystem(FS, 'HL-1').folders.map((f) => f.id)).toEqual(['app']);
  });

  it('does not match on something that is not searched: the uploader, the status, the size', () => {
    expect(searchFileSystem(FS, 'Priya')).toEqual({ folders: [], files: [] });
    expect(searchFileSystem(FS, 'Pending approval')).toEqual({ folders: [], files: [] });
    expect(searchFileSystem(FS, '1000')).toEqual({ folders: [], files: [] });
  });

  it('ignores spaces at the ends, and an empty search matches nothing', () => {
    expect(searchFileSystem(FS, '  guide  ').files).toHaveLength(1);
    expect(searchFileSystem(FS, '')).toEqual({ folders: [], files: [] });
    expect(searchFileSystem(FS, '   ')).toEqual({ folders: [], files: [] });
  });

  it('finds nothing for a text that is nowhere', () => {
    expect(searchFileSystem(FS, 'zzzz')).toEqual({ folders: [], files: [] });
  });
});
