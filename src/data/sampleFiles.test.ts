import { DOC_TYPES } from './options';
import {
  FileStatus,
  ROOT_ID,
  filesIn,
  folderPathLabel,
  folderStats,
  folderTrail,
  subfolders,
  type FileSystem,
} from './fileSystem';
import { SAMPLE_FILE_SYSTEM, SANCTION_FOLDER, buildSampleFileSystem } from './sampleFiles';

const NOW = new Date('2026-10-12T12:00:00Z');
const fs: FileSystem = buildSampleFileSystem(NOW);
const folderNamed = (name: string) => fs.folders.find((f) => f.name === name)!;
const names = (list: { name: string }[]) => list.map((x) => x.name);

describe('the sample tree', () => {
  it('has unique ids, and every folder and file points at a folder that exists', () => {
    const folderIds = new Set(fs.folders.map((f) => f.id));
    expect(folderIds.size).toBe(fs.folders.length);
    expect(new Set(fs.files.map((f) => f.id)).size).toBe(fs.files.length);
    for (const folder of fs.folders)
      expect(folder.parentId === ROOT_ID || folderIds.has(folder.parentId)).toBe(true);
    for (const file of fs.files)
      expect(file.folderId === ROOT_ID || folderIds.has(file.folderId)).toBe(true);
  });

  it('is the same every time it is built for the same moment', () => {
    expect(buildSampleFileSystem(NOW)).toEqual(fs);
  });

  it('is built for the moment the app starts', () => {
    expect(SAMPLE_FILE_SYSTEM.files.length).toBe(fs.files.length);
  });

  it('has, at the top, the folders Loans, In Workflow, Policies & Circulars, Templates and Archive 2024', () => {
    expect(names(subfolders(fs, ROOT_ID))).toEqual([
      'Archive 2024',
      'In Workflow',
      'Loans',
      'Policies & Circulars',
      'Templates',
    ]);
  });

  it('has files at the top too', () => {
    expect(filesIn(fs, ROOT_ID).length).toBeGreaterThan(0);
  });
});

describe('Loans, in the structure of section 10', () => {
  it('goes Loans > Home Loan > {Branch} > {Application ID} {Applicant name}', () => {
    const loans = folderNamed('Loans');
    expect(names(subfolders(fs, loans.id))).toEqual(['Home Loan']);
    const homeLoan = subfolders(fs, loans.id)[0];
    expect(names(subfolders(fs, homeLoan.id))).toEqual([
      'Belagavi Main Branch (demo)',
      'Gokak Branch (demo)',
    ]);
    const belagavi = folderNamed('Belagavi Main Branch (demo)');
    expect(names(subfolders(fs, belagavi.id))).toEqual([
      'HL-2026-0001 Vijay Kulkarni',
      'HL-2026-0099 Meera Joshi',
    ]);
  });

  it('gives each application folder 01 KYC, 02 Income, 03 Property and 04 Sanction', () => {
    for (const application of fs.folders.filter(
      (f) => /^HL-2026-(0001|0099) /.test(f.name) && f.parentId !== folderNamed('In Workflow').id,
    )) {
      expect(names(subfolders(fs, application.id))).toEqual([
        '01 KYC',
        '02 Income',
        '03 Property',
        SANCTION_FOLDER,
      ]);
    }
  });

  it('puts each DocType in the folder of its group', () => {
    const vijay = folderNamed('HL-2026-0001 Vijay Kulkarni');
    const inFolder = (name: string) => {
      const sub = subfolders(fs, vijay.id).find((f) => f.name === name)!;
      return filesIn(fs, sub.id).map((f) => f.docType);
    };
    expect(inFolder('01 KYC')).toEqual(
      expect.arrayContaining(['PAN Card', 'Aadhaar (Masked Copy)', 'Photograph', 'Address Proof']),
    );
    expect(inFolder('02 Income')).toEqual(
      expect.arrayContaining(['Income Proof', 'Surety Documents']),
    );
    expect(inFolder('03 Property')).toHaveLength(6);
    expect(inFolder('03 Property')).toEqual(
      expect.arrayContaining(['Sale or Gift Deed', 'Tax Paid Receipt']),
    );
  });

  it('tags every application file with a DocType from section 10, the application and the applicant', () => {
    const tagged = fs.files.filter((f) => f.applicationId);
    expect(tagged.length).toBeGreaterThan(20);
    for (const file of tagged) {
      expect(DOC_TYPES as string[]).toContain(
        file.docType === 'Sanction Summary' ? DOC_TYPES[0] : file.docType,
      );
      expect(file.applicantName).toBeTruthy();
      expect(file.name).toContain(file.applicantName!.replace(/\s+/g, '_'));
    }
  });

  it('holds the optional Sanction Summary of the first application, and leaves the other 04 Sanction folders empty', () => {
    const sanctions = fs.folders.filter((f) => f.name === SANCTION_FOLDER);
    const counts = sanctions.map((f) => filesIn(fs, f.id).length).sort();
    expect(counts).toEqual([0, 0, 1]);
    const summary = fs.files.find((f) => f.docType === 'Sanction Summary')!;
    expect(summary.uploadedBy).toBe('System');
    expect(folderPathLabel(fs, summary.folderId)).toBe(
      'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 04 Sanction',
    );
  });

  it('has only Filed files under Loans', () => {
    const loans = folderNamed('Loans');
    const inside = fs.files.filter((f) => folderTrail(fs, f.folderId)[0]?.id === loans.id);
    expect(inside.length).toBeGreaterThan(20);
    expect(inside.every((f) => f.status === FileStatus.Filed)).toBe(true);
  });
});

describe('the files that are still in the workflow', () => {
  const workflow = folderNamed('In Workflow');

  it('have one folder for each application, with a status that is not final', () => {
    const status = (name: string) =>
      new Set(filesIn(fs, folderNamed(name).id).map((f) => f.status));
    expect(subfolders(fs, workflow.id)).toHaveLength(4);
    expect(status('HL-2026-0002 Shobha Gaonkar')).toEqual(new Set([FileStatus.PendingApproval]));
    expect(status('HL-2026-0004 Savita Patil')).toEqual(new Set([FileStatus.Returned]));
    expect(status('HL-2026-0005 Basavaraj Kadam')).toEqual(new Set([FileStatus.Rejected]));
    expect(status('HL-2026-0010 Anita Desai')).toEqual(new Set([FileStatus.Draft]));
  });

  it('cover every status that gets a badge', () => {
    const used = new Set(fs.files.map((f) => f.status));
    for (const status of Object.values(FileStatus)) expect(used.has(status)).toBe(true);
  });
});

describe('the empty folder and the times', () => {
  it('has a folder with nothing in it', () => {
    const archive = folderNamed('Archive 2024');
    expect(folderStats(fs, archive.id)).toMatchObject({ folders: 0, files: 0 });
  });

  it('has something changed seconds or minutes ago and something months ago', () => {
    const ages = fs.files.map((f) => NOW.getTime() - Date.parse(f.uploadedAt));
    expect(Math.min(...ages)).toBeLessThan(5 * 60 * 1000);
    expect(Math.max(...ages)).toBeGreaterThan(30 * 86400 * 1000);
  });

  it('never has a date in the future', () => {
    for (const file of fs.files)
      expect(Date.parse(file.uploadedAt)).toBeLessThanOrEqual(NOW.getTime());
    for (const folder of fs.folders)
      expect(Date.parse(folder.updatedAt)).toBeLessThanOrEqual(NOW.getTime());
  });
});

describe('file details', () => {
  it('give each file a version, a size and a type that can be previewed', () => {
    for (const file of fs.files) {
      expect(file.version).toMatch(/^v\d+\.\d+$/);
      expect(file.sizeBytes).toBeGreaterThan(0);
      expect(['application/pdf', 'image/jpeg', 'image/png']).toContain(file.mimeType);
    }
  });

  it('has a picture or two among the PDFs', () => {
    expect(fs.files.some((f) => f.mimeType === 'image/jpeg')).toBe(true);
    expect(fs.files.some((f) => f.mimeType === 'image/png')).toBe(true);
  });

  it('never has an Aadhaar number in a name', () => {
    for (const file of fs.files) expect(file.name).not.toMatch(/\d{4}[\s_.-]?\d{4}[\s_.-]?\d{4}/);
    for (const folder of fs.folders) expect(folder.name).not.toMatch(/\d{12}/);
  });
});
