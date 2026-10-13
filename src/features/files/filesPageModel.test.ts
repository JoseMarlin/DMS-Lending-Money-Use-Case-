import {
  FileStatus,
  ROOT_ID,
  type FileNode,
  type FileSystem,
  type FolderNode,
} from '@/data/fileSystem';
import { buildSampleFileSystem } from '@/data/sampleFiles';
import {
  FILES_PATH,
  ROOT_LABEL,
  ZOOM,
  announcement,
  breadcrumbFor,
  clampZoom,
  contentsOf,
  currentFolderId,
  folderCardText,
  folderCellLabel,
  folderLink,
  listRows,
  previewOf,
  zoomPercent,
} from './filesPageModel';

const NOW = new Date('2026-10-12T12:00:00Z');
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

const folder = (id: string, name: string, parentId: string, seconds = 99999): FolderNode => ({
  id,
  name,
  parentId,
  updatedAt: ago(seconds),
});
const file = (
  id: string,
  name: string,
  folderId: string,
  seconds: number,
  extra: Partial<FileNode> = {},
): FileNode => ({
  id,
  name,
  folderId,
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  uploadedBy: 'Priya Kulkarni',
  uploadedAt: ago(seconds),
  version: 'v1.0',
  status: FileStatus.Filed,
  ...extra,
});

/**
 *  Loans
 *    Home Loan
 *      HL-1 Ramesh Patil
 *        01 KYC   (PAN Card, 60 s ago)
 *  Archive        (empty)
 *  Guide.pdf at the top
 */
const FS: FileSystem = {
  folders: [
    folder('loans', 'Loans', ROOT_ID, 5000),
    folder('hl', 'Home Loan', 'loans', 5000),
    folder('app', 'HL-1 Ramesh Patil', 'hl', 4000),
    folder('kyc', '01 KYC', 'app', 3000),
    folder('arch', 'Archive', ROOT_ID, 200000),
  ],
  files: [
    file('f1', 'PAN_Card_Ramesh_Patil.pdf', 'kyc', 60, {
      docType: 'PAN Card',
      applicationId: 'HL-1',
      applicantName: 'Ramesh Patil',
      status: FileStatus.Draft,
    }),
    file('f2', 'Guide.pdf', ROOT_ID, 400),
  ],
};

describe('the size of the file cards', () => {
  it('starts at a size that fits six cards on the 1366px screen of the design', () => {
    // 1366 - 240 (sidebar) - 2 x 20 (sides) = 1086; six cards and five gaps of 16
    expect(6 * ZOOM.initial + 5 * 16).toBeLessThanOrEqual(1086);
    expect(7 * ZOOM.initial + 6 * 16).toBeGreaterThan(1086);
  });

  it('can be made smaller and larger, in whole steps from the start', () => {
    expect(ZOOM.min).toBeLessThan(ZOOM.initial);
    expect(ZOOM.max).toBeGreaterThan(ZOOM.initial);
    expect((ZOOM.initial - ZOOM.min) % ZOOM.step).toBe(0);
    expect((ZOOM.max - ZOOM.initial) % ZOOM.step).toBe(0);
  });

  it('is kept between the least and the most, and a wrong value is the start', () => {
    expect(clampZoom(10)).toBe(ZOOM.min);
    expect(clampZoom(1000)).toBe(ZOOM.max);
    expect(clampZoom(150.4)).toBe(150);
    expect(clampZoom(Number.NaN)).toBe(ZOOM.initial);
    expect(clampZoom(Infinity)).toBe(ZOOM.initial);
  });

  it('is spoken as a percentage of the start', () => {
    expect(zoomPercent(ZOOM.initial)).toBe(100);
    expect(zoomPercent(ZOOM.min)).toBe(75);
    expect(zoomPercent(ZOOM.max)).toBe(150);
  });
});

describe('folderLink and currentFolderId', () => {
  it('opens the top at /files and a folder with its id in the address', () => {
    expect(folderLink(ROOT_ID)).toBe(FILES_PATH);
    expect(folderLink('folder-3')).toBe('/files?folder=folder-3');
    expect(folderLink('a b&c')).toBe('/files?folder=a%20b%26c');
  });

  it('is the folder of the address when it exists, and the top when it does not or there is none', () => {
    expect(currentFolderId(FS, 'kyc')).toBe('kyc');
    expect(currentFolderId(FS, 'nowhere')).toBe(ROOT_ID);
    expect(currentFolderId(FS, '')).toBe(ROOT_ID);
    expect(currentFolderId(FS, null)).toBe(ROOT_ID);
    expect(currentFolderId(FS, ROOT_ID)).toBe(ROOT_ID);
  });
});

describe('breadcrumbFor', () => {
  it('has nothing at the top', () => {
    expect(breadcrumbFor(FS, ROOT_ID)).toEqual([]);
  });

  it('goes from Files & Folders down to the open folder, each part with its address', () => {
    expect(breadcrumbFor(FS, 'hl')).toEqual([
      { label: 'Files & Folders', to: '/files' },
      { label: 'Loans', to: '/files?folder=loans' },
      { label: 'Home Loan', to: '/files?folder=hl' },
    ]);
  });

  it('has just the top and the folder for a folder at the top', () => {
    expect(breadcrumbFor(FS, 'arch').map((c) => c.label)).toEqual(['Files & Folders', 'Archive']);
  });
});

describe('contentsOf', () => {
  it('gives the folders and the files directly in the open folder, A to Z', () => {
    const top = contentsOf(FS, ROOT_ID, '');
    expect(top.mode).toBe('folder');
    expect(top.folders.map((f) => f.name)).toEqual(['Archive', 'Loans']);
    expect(top.files.map((f) => f.name)).toEqual(['Guide.pdf']);
    const inside = contentsOf(FS, 'kyc', '   ');
    expect(inside.mode).toBe('folder');
    expect(inside.folders).toEqual([]);
    expect(inside.files.map((f) => f.id)).toEqual(['f1']);
  });

  it('has nothing for an empty folder', () => {
    expect(contentsOf(FS, 'arch', '')).toMatchObject({ mode: 'folder', folders: [], files: [] });
  });

  it('looks through the whole tree when something is typed, wherever the open folder is', () => {
    const found = contentsOf(FS, 'arch', 'ramesh');
    expect(found.mode).toBe('search');
    expect(found.folders.map((f) => f.id)).toEqual(['app']);
    expect(found.files.map((f) => f.id)).toEqual(['f1']);
  });

  it('finds a file by its DocType, its application ID and the applicant name', () => {
    expect(contentsOf(FS, ROOT_ID, 'pan card').files.map((f) => f.id)).toEqual(['f1']);
    expect(contentsOf(FS, ROOT_ID, 'hl-1').files.map((f) => f.id)).toEqual(['f1']);
    expect(contentsOf(FS, ROOT_ID, 'Ramesh Patil').files.map((f) => f.id)).toEqual(['f1']);
  });

  it('says it is a search even when nothing matches', () => {
    expect(contentsOf(FS, ROOT_ID, 'zzz')).toEqual({ mode: 'search', folders: [], files: [] });
  });
});

describe('folderCardText', () => {
  it('counts what is inside at any depth, and says when it last changed', () => {
    const loans = FS.folders.find((f) => f.id === 'loans')!;
    expect(folderCardText(FS, loans, NOW)).toEqual({
      counts: '3 Folders, 1 file',
      updated: 'Last updated 1 Min ago',
    });
  });

  it('is 0 and 0 for an empty folder, and uses its own date', () => {
    const archive = FS.folders.find((f) => f.id === 'arch')!;
    expect(folderCardText(FS, archive, NOW)).toEqual({
      counts: '0 Folders, 0 files',
      updated: 'Last updated 2 Days ago',
    });
  });
});

describe('folderCellLabel', () => {
  it('names the top, a folder at the top, and a deeper one after an ellipsis', () => {
    expect(folderCellLabel(FS, ROOT_ID)).toBe(ROOT_LABEL);
    expect(folderCellLabel(FS, 'arch')).toBe('Archive');
    expect(folderCellLabel(FS, 'loans')).toBe('Loans');
    expect(folderCellLabel(FS, 'kyc')).toBe('... / 01 KYC');
  });
});

describe('listRows', () => {
  const rows = listRows(FS, contentsOf(FS, ROOT_ID, ''), NOW);

  it('has the folders first, then the files', () => {
    expect(rows.map((r) => `${r.kind}:${r.name}`)).toEqual([
      'folder:Archive',
      'folder:Loans',
      'file:Guide.pdf',
    ]);
  });

  it('writes a folder row with its counts and time, and no DocType or status', () => {
    const loans = rows[1];
    expect(loans).toMatchObject({
      kind: 'folder',
      subline: '3 Folders, 1 file · Last updated 1 Min ago',
      docType: '',
      status: null,
      folderLabel: ROOT_LABEL,
    });
    expect(loans.folder?.id).toBe('loans');
  });

  it('writes a file row with the uploader and the date and time', () => {
    const inside = listRows(FS, contentsOf(FS, 'kyc', ''), NOW)[0];
    expect(inside).toMatchObject({
      kind: 'file',
      name: 'PAN_Card_Ramesh_Patil.pdf',
      docType: 'PAN Card',
      status: FileStatus.Draft,
      folderLabel: '... / 01 KYC',
      folderPath: 'Loans / Home Loan / HL-1 Ramesh Patil / 01 KYC',
    });
    expect(inside.subline).toMatch(
      /^Priya Kulkarni · \d{1,2} [A-Z][a-z]{2} 2026, \d{1,2}:\d{2} (AM|PM)$/,
    );
  });

  it('says where a file at the top is, in words', () => {
    expect(rows[2]).toMatchObject({ docType: '', folderLabel: ROOT_LABEL, folderPath: ROOT_LABEL });
  });

  it('is empty for an empty folder', () => {
    expect(listRows(FS, contentsOf(FS, 'arch', ''), NOW)).toEqual([]);
  });
});

describe('previewOf', () => {
  it('gives the file, where it is, and the application it belongs to', () => {
    expect(previewOf(FS, FS.files[0])).toEqual({
      fileName: 'PAN_Card_Ramesh_Patil.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      docType: 'PAN Card',
      uploadedBy: 'Priya Kulkarni',
      uploadedAt: FS.files[0].uploadedAt,
      folderPath: 'Loans / Home Loan / HL-1 Ramesh Patil / 01 KYC',
      applicationId: 'HL-1',
      applicantName: 'Ramesh Patil',
      status: FileStatus.Draft,
      recordHref: '/metadata/master/home-loan?record=HL-1',
    });
  });

  it('has no record to view for a file that belongs to no application', () => {
    const preview = previewOf(FS, FS.files[1]);
    expect(preview.recordHref).toBeUndefined();
    expect(preview.applicationId).toBeUndefined();
    expect(preview.docType).toBe('');
    expect(preview.folderPath).toBe(ROOT_LABEL);
  });

  it('leaves the link out when the store has no such application, or another person under that ID', () => {
    const file = FS.files[0];
    expect(previewOf(FS, file, () => false).recordHref).toBeUndefined();
    const seen: [string, string | undefined][] = [];
    const preview = previewOf(FS, file, (id, name) => {
      seen.push([id, name]);
      return true;
    });
    expect(seen).toEqual([['HL-1', 'Ramesh Patil']]);
    expect(preview.recordHref).toBe('/metadata/master/home-loan?record=HL-1');
  });

  it('opens the record sheet of every application file of the sample tree', () => {
    const sample = buildSampleFileSystem(NOW);
    const tagged = sample.files.filter((f) => f.applicationId);
    expect(tagged.length).toBeGreaterThan(20);
    for (const f of tagged) {
      expect(previewOf(sample, f).recordHref).toBe(
        `/metadata/master/home-loan?record=${f.applicationId}`,
      );
    }
  });
});

describe('announcement', () => {
  it('says which folder is open and what is in it', () => {
    // what is in the folder itself, as on the screen: not everything below it, as a folder card counts
    expect(announcement(FS, ROOT_ID, '')).toBe('Files & Folders: 2 Folders, 1 file');
    expect(announcement(FS, 'loans', '')).toBe('Loans: 1 Folder, 0 files');
    expect(announcement(FS, 'kyc', '')).toBe('01 KYC: 0 Folders, 1 file');
    expect(announcement(FS, 'arch', '')).toBe('Archive: 0 Folders, 0 files');
  });

  it('says how many folders and files a search found', () => {
    expect(announcement(FS, ROOT_ID, 'ramesh')).toBe('1 folder and 1 file match "ramesh"');
    expect(announcement(FS, ROOT_ID, ' kyc ')).toBe('1 folder and 0 files match "kyc"');
    expect(announcement(FS, ROOT_ID, 'zzz')).toBe('0 folders and 0 files match "zzz"');
  });
});
