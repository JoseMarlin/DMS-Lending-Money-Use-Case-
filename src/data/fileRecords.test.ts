import {
  FIRST_VERSION,
  buildFileSystem,
  fileRecordsOf,
  fileRecordsOfApplication,
  filesNoticeFor,
  liveApplications,
  movedFolderIds,
  nextVersion,
  pruneMovedFolders,
} from './fileRecords';
import { ROOT_ID, filesIn, folderStats, subfolders } from './fileSystem';
import { buildGeneralFileSystem } from './sampleFiles';
import { SEED_APPLICATIONS } from './seed';
import { ApplicationStatus, type HomeLoanApplication } from './types';

const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ, MEERA, PRAKASH] = SEED_APPLICATIONS;
const apps = () => structuredClone(SEED_APPLICATIONS);

describe('nextVersion', () => {
  it('counts the minor number up', () => {
    expect(nextVersion('v1.0')).toBe('v1.1');
    expect(nextVersion('v1.1')).toBe('v1.2');
    expect(nextVersion('v1.9')).toBe('v1.10');
    expect(nextVersion('v2.3')).toBe('v2.4');
  });

  it('takes a file with no version, or one that cannot be read, as the first', () => {
    expect(FIRST_VERSION).toBe('v1.0');
    expect(nextVersion(undefined)).toBe('v1.1');
    expect(nextVersion('')).toBe('v1.1');
    expect(nextVersion('final')).toBe('v1.1');
  });
});

describe('liveApplications', () => {
  const draft = (over: Partial<HomeLoanApplication> = {}): HomeLoanApplication => ({
    ...structuredClone(SAVITA),
    applicationId: 'HL-2026-0008',
    status: ApplicationStatus.Draft,
    updatedAt: '2026-10-12T10:00:00Z',
    ...over,
  });

  it('adds the draft in the form when it is not saved and has files', () => {
    const live = liveApplications(apps(), draft());
    expect(live).toHaveLength(SEED_APPLICATIONS.length + 1);
    expect(live.at(-1)?.applicationId).toBe('HL-2026-0008');
  });

  it('adds nothing for a blank draft: it has no files', () => {
    expect(liveApplications(apps(), draft({ documents: [] }))).toHaveLength(
      SEED_APPLICATIONS.length,
    );
  });

  it('lays the draft over its saved copy, when it is the newer', () => {
    const saved = { ...draft(), documents: [], updatedAt: '2026-10-12T09:00:00Z' };
    const live = liveApplications([...apps(), saved], draft());
    expect(live).toHaveLength(SEED_APPLICATIONS.length + 1);
    expect(live.at(-1)?.documents.length).toBeGreaterThan(0);
  });

  it('keeps the saved copy when it is the newer', () => {
    const saved = { ...draft(), documents: [], updatedAt: '2026-10-12T11:00:00Z' };
    const live = liveApplications([...apps(), saved], draft());
    expect(live.at(-1)?.documents).toEqual([]);
  });
});

describe('fileRecordsOf', () => {
  it('has one record for each document, with where it is and what it is', () => {
    const records = fileRecordsOf([SHOBHA]);
    expect(records).toHaveLength(SHOBHA.documents.length);
    const pan = records[0];
    expect(pan).toMatchObject({
      id: SHOBHA.documents[0].id,
      fileName: 'PAN_Card_Shobha_Gaonkar.pdf',
      docType: 'PAN Card',
      applicationId: 'HL-2026-0002',
      applicantName: 'Shobha Gaonkar',
      uploadedBy: 'Priya Kulkarni',
      version: 'v1.0',
      favourite: false,
      status: 'Pending approval',
    });
    expect(pan.path).toEqual([
      'Loans',
      'Home Loan',
      'Pending Approval',
      'HL-2026-0002 Shobha Gaonkar',
      '01 KYC',
    ]);
  });

  it('adds the Sanction Summary of an approved application, after its documents, in 04 Sanction', () => {
    const records = fileRecordsOf([VIJAY]);
    expect(records).toHaveLength(VIJAY.documents.length + 1);
    const summary = records.at(-1)!;
    expect(summary).toMatchObject({
      id: 'HL-2026-0001-sanction-summary',
      fileName: 'Sanction_Summary_Vijay_Kulkarni.pdf',
      docType: 'Sanction Summary',
      uploadedBy: 'System',
      mimeType: 'application/pdf',
      status: 'Filed',
    });
    expect(summary.path.at(-1)).toBe('04 Sanction');
    // a moment after the approval
    expect(Date.parse(summary.uploadedAt)).toBe(Date.parse(VIJAY.level2Time) + 1000);
  });

  it('adds the Sanction Summary of each approved application, Meera Joshi (0006) as well as Vijay Kulkarni', () => {
    const records = fileRecordsOf([MEERA]);
    expect(records).toHaveLength(MEERA.documents.length + 1);
    expect(records.at(-1)).toMatchObject({
      id: 'HL-2026-0006-sanction-summary',
      fileName: 'Sanction_Summary_Meera_Joshi.pdf',
      docType: 'Sanction Summary',
      status: 'Filed',
    });
    expect(records.at(-1)!.path).toEqual([
      'Loans',
      'Home Loan',
      'Belagavi Main Branch (demo)',
      'HL-2026-0006 Meera Joshi',
      '04 Sanction',
    ]);
  });

  it('adds no Sanction Summary until the final approval', () => {
    for (const app of [SHOBHA, MANJUNATH, SAVITA, BASAVARAJ, PRAKASH]) {
      expect(fileRecordsOf([app]).some((r) => r.docType === 'Sanction Summary')).toBe(false);
    }
  });

  it('puts the supporting attachments in 05 Other, tagged Supporting Document', () => {
    const records = fileRecordsOf([VIJAY]);
    const attachments = records.filter((r) => r.docType === 'Supporting Document');
    expect(attachments.map((r) => r.fileName)).toEqual([
      'Salary_Slip_Aug.pdf',
      'Electricity_Bill.pdf',
    ]);
    for (const record of attachments) {
      expect(record).toMatchObject({
        applicationId: 'HL-2026-0001',
        uploadedBy: 'Priya Kulkarni',
        version: 'v1.0',
        status: 'Filed',
      });
      expect(record.path.at(-1)).toBe('05 Other');
    }
    // one record for each document of the application, the attachments included: 12 + 2 (+ the summary)
    expect(records).toHaveLength(12 + 2 + 1);
  });

  it('marks the starred ones, by their id, and the Sanction Summary too', () => {
    const records = fileRecordsOf(
      [VIJAY],
      [VIJAY.documents[1].id, 'HL-2026-0001-sanction-summary', 'something-else'],
    );
    expect(records.filter((r) => r.favourite).map((r) => r.id)).toEqual([
      VIJAY.documents[1].id,
      'HL-2026-0001-sanction-summary',
    ]);
  });

  it('puts each record where its application is, for every status', () => {
    const folder = (a: HomeLoanApplication) => fileRecordsOf([a])[0].path[2];
    expect(folder(VIJAY)).toBe('Belagavi Main Branch (demo)');
    expect(folder(SHOBHA)).toBe('Pending Approval');
    expect(folder(MANJUNATH)).toBe('Pending Approval');
    expect(folder(SAVITA)).toBe('Pending Approval');
    expect(folder(BASAVARAJ)).toBe('Rejected');
    expect(folder(MEERA)).toBe('Belagavi Main Branch (demo)');
    expect(folder(PRAKASH)).toBe('Drafts');
    expect(folder({ ...SAVITA, status: ApplicationStatus.Draft })).toBe('Drafts');
  });

  it('is the same records for one application as for a list of it', () => {
    expect(fileRecordsOfApplication(VIJAY)).toEqual(fileRecordsOf([VIJAY]));
  });

  it('keeps the version of a document that was replaced, and the id', () => {
    const replaced = structuredClone(SHOBHA);
    replaced.documents[0] = { ...replaced.documents[0], version: 'v1.1', fileName: 'PAN_new.pdf' };
    const [pan] = fileRecordsOf([replaced]);
    expect(pan).toMatchObject({
      id: SHOBHA.documents[0].id,
      version: 'v1.1',
      fileName: 'PAN_new.pdf',
    });
  });
});

describe('buildFileSystem', () => {
  const fs = buildFileSystem(fileRecordsOf(apps()));

  it('always has Loans, Home Loan, Drafts, Pending Approval and Rejected', () => {
    const empty = buildFileSystem([]);
    expect(subfolders(empty, ROOT_ID).map((f) => f.name)).toEqual(['Loans']);
    expect(subfolders(empty, 'Loans').map((f) => f.name)).toEqual(['Home Loan']);
    expect(subfolders(empty, 'Loans/Home Loan').map((f) => f.name)).toEqual([
      'Drafts',
      'Pending Approval',
      'Rejected',
    ]);
    expect(empty.files).toEqual([]);
  });

  it('has a folder for the branch of each approved application, and for each application below its place', () => {
    expect(subfolders(fs, 'Loans/Home Loan').map((f) => f.name)).toEqual([
      'Belagavi Main Branch (demo)',
      'Drafts',
      'Pending Approval',
      'Rejected',
    ]);
    expect(subfolders(fs, 'Loans/Home Loan/Pending Approval').map((f) => f.name)).toEqual([
      'HL-2026-0002 Shobha Gaonkar',
      'HL-2026-0003 Manjunath Hiremath',
      'HL-2026-0004 Savita Patil',
    ]);
    expect(subfolders(fs, 'Loans/Home Loan/Rejected').map((f) => f.name)).toEqual([
      'HL-2026-0005 Basavaraj Kadam',
    ]);
    // the approved ones are below their branch, the draft (Prakash Naik, 0007) below Drafts
    expect(
      subfolders(fs, 'Loans/Home Loan/Belagavi Main Branch (demo)').map((f) => f.name),
    ).toEqual(['HL-2026-0001 Vijay Kulkarni', 'HL-2026-0006 Meera Joshi']);
    expect(subfolders(fs, 'Loans/Home Loan/Drafts').map((f) => f.name)).toEqual([
      'HL-2026-0007 Prakash Naik',
    ]);
  });

  it('gives a folder its path as its id, and the id of the folder above as its parent', () => {
    const kyc = fs.folders.find(
      (f) => f.id === 'Loans/Home Loan/Rejected/HL-2026-0005 Basavaraj Kadam/01 KYC',
    )!;
    expect(kyc.name).toBe('01 KYC');
    expect(kyc.parentId).toBe('Loans/Home Loan/Rejected/HL-2026-0005 Basavaraj Kadam');
    expect(fs.folders.find((f) => f.id === 'Loans')?.parentId).toBe(ROOT_ID);
    expect(new Set(fs.folders.map((f) => f.id)).size).toBe(fs.folders.length);
  });

  it('has the subfolders that have files, 04 Sanction only for an approved application, and 05 Other for the attachments', () => {
    const vijay = 'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0001 Vijay Kulkarni';
    expect(subfolders(fs, vijay).map((f) => f.name)).toEqual([
      '01 KYC',
      '02 Income',
      '03 Property',
      '04 Sanction',
      '05 Other',
    ]);
    expect(filesIn(fs, `${vijay}/04 Sanction`).map((f) => f.name)).toEqual([
      'Sanction_Summary_Vijay_Kulkarni.pdf',
    ]);
    // (a folder lists its files by name)
    expect(filesIn(fs, `${vijay}/05 Other`).map((f) => f.name)).toEqual([
      'Electricity_Bill.pdf',
      'Salary_Slip_Aug.pdf',
    ]);
    const shobha = 'Loans/Home Loan/Pending Approval/HL-2026-0002 Shobha Gaonkar';
    expect(subfolders(fs, shobha).map((f) => f.name)).not.toContain('04 Sanction');
    expect(subfolders(fs, shobha).map((f) => f.name)).toContain('05 Other');
    // the draft has uploaded three files and one attachment, so it has no Property or Sanction folder
    const prakash = 'Loans/Home Loan/Drafts/HL-2026-0007 Prakash Naik';
    expect(subfolders(fs, prakash).map((f) => f.name)).toEqual(['01 KYC', '05 Other']);
  });

  it('counts the files of a folder from the files in it, and every file is in a folder that exists', () => {
    const total = fileRecordsOf(apps()).length;
    expect(fs.files).toHaveLength(total);
    expect(folderStats(fs, 'Loans').files).toBe(total);
    expect(folderStats(fs, 'Loans/Home Loan/Rejected').files).toBe(BASAVARAJ.documents.length);
    const ids = new Set(fs.folders.map((f) => f.id));
    expect(fs.files.every((f) => ids.has(f.folderId))).toBe(true);
  });

  it('gives each file the status of its application, its version and the DocType and application it belongs to', () => {
    const file = fs.files.find((f) => f.id === SAVITA.documents[0].id)!;
    expect(file).toMatchObject({
      status: 'Returned',
      version: 'v1.0',
      docType: 'PAN Card',
      applicationId: 'HL-2026-0004',
      applicantName: 'Savita Patil',
    });
  });

  it('adds the general folders and files beside the loans, with ids of their own', () => {
    const general = buildGeneralFileSystem(new Date('2026-10-12T10:00:00Z'));
    const withGeneral = buildFileSystem(fileRecordsOf(apps()), general);
    expect(subfolders(withGeneral, ROOT_ID).map((f) => f.name)).toEqual([
      'Archive 2024',
      'Loans',
      'Policies & Circulars',
      'Templates',
    ]);
    expect(filesIn(withGeneral, ROOT_ID).map((f) => f.name)).toEqual([
      'Branch_Directory.pdf',
      'Document_Naming_Guide.pdf',
    ]);
    const ids = [...withGeneral.folders.map((f) => f.id), ...withGeneral.files.map((f) => f.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('movedFolderIds', () => {
  const draft = (): HomeLoanApplication => ({
    ...structuredClone(SAVITA),
    applicationId: 'HL-2026-0008',
    status: ApplicationStatus.Draft,
  });
  const as = (a: HomeLoanApplication, status: ApplicationStatus) => ({ ...a, status });

  it('marks the new folder of the application, and the folders above it, after a submit', () => {
    const before = [draft()];
    const after = [as(draft(), ApplicationStatus.InLevel1)];
    expect(movedFolderIds(before, after)).toEqual([
      'Loans',
      'Loans/Home Loan',
      'Loans/Home Loan/Pending Approval',
      'Loans/Home Loan/Pending Approval/HL-2026-0008 Savita Patil',
    ]);
  });

  it('marks the branch folder after a final approval, and Rejected after a rejection', () => {
    const pending = as(draft(), ApplicationStatus.InLevel2);
    expect(movedFolderIds([pending], [as(pending, ApplicationStatus.Approved)])).toContain(
      'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0008 Savita Patil',
    );
    expect(movedFolderIds([pending], [as(pending, ApplicationStatus.Rejected)])).toContain(
      'Loans/Home Loan/Rejected/HL-2026-0008 Savita Patil',
    );
  });

  it('does not mark a return, a resubmission, a rename or a move that did not happen', () => {
    const pending = as(draft(), ApplicationStatus.InLevel1);
    expect(movedFolderIds([pending], [as(pending, ApplicationStatus.Returned)])).toEqual([]);
    expect(
      movedFolderIds(
        [as(pending, ApplicationStatus.Returned)],
        [as(pending, ApplicationStatus.InLevel1)],
      ),
    ).toEqual([]);
    expect(movedFolderIds([draft()], [{ ...draft(), fullNameAsPerPan: 'Savita K Patil' }])).toEqual(
      [],
    );
    expect(movedFolderIds([pending], [pending])).toEqual([]);
  });

  it('marks nothing for an application that is new, or that has no files', () => {
    expect(movedFolderIds([], [as(draft(), ApplicationStatus.InLevel1)])).toEqual([]);
    expect(
      movedFolderIds(
        [{ ...draft(), documents: [] }],
        [{ ...as(draft(), ApplicationStatus.InLevel1), documents: [] }],
      ),
    ).toEqual([]);
  });

  it('marks the branch folder again when the branch of an approved record is changed', () => {
    const approved = as(draft(), ApplicationStatus.Approved);
    expect(movedFolderIds([approved], [{ ...approved, branch: 'Gokak Branch (demo)' }])).toContain(
      'Loans/Home Loan/Gokak Branch (demo)/HL-2026-0008 Savita Patil',
    );
  });
});

describe('pruneMovedFolders', () => {
  const live = apps();
  const vijay = 'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0001 Vijay Kulkarni';
  const shobha = 'Loans/Home Loan/Pending Approval/HL-2026-0002 Shobha Gaonkar';

  it('keeps the marks of application folders that are there, and the trail above a marked one', () => {
    const ids = ['Loans', 'Loans/Home Loan', 'Loans/Home Loan/Pending Approval', shobha];
    expect(pruneMovedFolders(ids, live)).toEqual(ids);
  });

  it('drops a mark on a folder that is not in the tree (a folder that was left, or a name that changed)', () => {
    expect(
      pruneMovedFolders([shobha, 'Loans/Home Loan/Pending Approval/HL-2026-0002 Old Name'], live),
    ).toEqual([shobha]);
  });

  it('drops the folders above an application folder when no marked one is left below them', () => {
    expect(
      pruneMovedFolders(['Loans', 'Loans/Home Loan', 'Loans/Home Loan/Rejected'], live),
    ).toEqual([]);
    // Pending Approval goes, Loans and Home Loan stay because a marked folder is below them
    expect(
      pruneMovedFolders(
        ['Loans', 'Loans/Home Loan', 'Loans/Home Loan/Pending Approval', vijay],
        live,
      ),
    ).toEqual(['Loans', 'Loans/Home Loan', vijay]);
  });

  it('keeps the order it was given, and a mark once', () => {
    expect(pruneMovedFolders([vijay, shobha, vijay], live)).toEqual([vijay, shobha]);
    expect(pruneMovedFolders([], live)).toEqual([]);
  });
});

describe('filesNoticeFor', () => {
  it('says where the files were stored after a final approval, with the folder to open', () => {
    expect(filesNoticeFor(VIJAY)).toEqual({
      message: 'Files stored in Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001',
      folderId: 'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0001 Vijay Kulkarni',
    });
  });

  it('says the files are held in Rejected after a rejection', () => {
    expect(filesNoticeFor(BASAVARAJ)).toEqual({
      message: 'Files held in Rejected',
      folderId: 'Loans/Home Loan/Rejected/HL-2026-0005 Basavaraj Kadam',
    });
  });

  it('has nothing to say for a decision that moved nothing, or an application with no files', () => {
    expect(filesNoticeFor(SHOBHA)).toBeNull();
    expect(filesNoticeFor(SAVITA)).toBeNull();
    expect(filesNoticeFor({ ...VIJAY, documents: [] })).toBeNull();
  });
});
