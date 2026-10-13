import { FileStatus } from './fileSystem';
import {
  GROUP_FOLDER,
  SANCTION_DOC_TYPE,
  SANCTION_FOLDER,
  applicationFolderName,
  applicationFolderPath,
  documentFolderPath,
  fileStatusOf,
  folderIdOf,
  folderIdsAlong,
  pathLabelOf,
  statusFolderOf,
  subfolderOf,
} from './filePaths';
import { DOC_TYPES } from './options';
import { ApplicationStatus } from './types';

const app = (over: Record<string, unknown> = {}) => ({
  applicationId: 'HL-2026-0001',
  fullNameAsPerPan: 'Vijay Kulkarni',
  branch: 'Belagavi Main Branch (demo)',
  status: ApplicationStatus.Draft as ApplicationStatus,
  ...over,
});

describe('the subfolder of a DocType', () => {
  it.each([
    ['PAN Card', '01 KYC'],
    ['Aadhaar (Masked Copy)', '01 KYC'],
    ['Photograph', '01 KYC'],
    ['Address Proof', '01 KYC'],
    ['Income Proof', '02 Income'],
    ['GST Certificate or Business Licence', '02 Income'],
    ['Surety Documents', '02 Income'],
    ['Sale or Gift Deed', '03 Property'],
    ['Records of Rights', '03 Property'],
    ['Encumbrance Certificate', '03 Property'],
    ['Building Permission', '03 Property'],
    ['Valuation Certificate', '03 Property'],
    ['Tax Paid Receipt', '03 Property'],
    ['Sanction Summary', '04 Sanction'],
  ])('puts %s in %s', (docType, folder) => {
    expect(subfolderOf(docType)).toBe(folder);
  });

  it('knows every DocType of the form, and puts an unknown one in 01 KYC', () => {
    for (const docType of DOC_TYPES) {
      expect(Object.values(GROUP_FOLDER)).toContain(subfolderOf(docType));
    }
    expect(subfolderOf('Something else')).toBe('01 KYC');
    expect(SANCTION_FOLDER).toBe('04 Sanction');
    expect(SANCTION_DOC_TYPE).toBe('Sanction Summary');
  });
});

describe('where an application is, by its status', () => {
  it.each([
    [ApplicationStatus.Draft, 'Drafts', 'Draft'],
    [ApplicationStatus.KycDone, 'Drafts', 'Draft'],
    [ApplicationStatus.Submitted, 'Pending Approval', 'Pending approval'],
    [ApplicationStatus.InLevel1, 'Pending Approval', 'Pending approval'],
    [ApplicationStatus.InLevel2, 'Pending Approval', 'Pending approval'],
    [ApplicationStatus.Returned, 'Pending Approval', 'Returned'],
    [ApplicationStatus.Rejected, 'Rejected', 'Rejected'],
    [ApplicationStatus.Approved, 'Belagavi Main Branch (demo)', 'Filed'],
  ])('%s is in %s, and its files are %s', (status, folder, fileStatus) => {
    expect(statusFolderOf(app({ status }))).toBe(folder);
    expect(fileStatusOf(status)).toBe(fileStatus);
  });

  it('covers every status, with the file statuses of the screen', () => {
    for (const status of Object.values(ApplicationStatus)) {
      expect(Object.values(FileStatus)).toContain(fileStatusOf(status));
    }
  });

  it('puts an approved application with no branch in a folder that says so', () => {
    expect(statusFolderOf(app({ status: ApplicationStatus.Approved, branch: '  ' }))).toBe(
      'No branch',
    );
  });
});

describe('the folder of an application', () => {
  it('is "{Application ID} {Name}"', () => {
    expect(applicationFolderName(app())).toBe('HL-2026-0001 Vijay Kulkarni');
    expect(applicationFolderName(app({ fullNameAsPerPan: '  Vijay Kulkarni ' }))).toBe(
      'HL-2026-0001 Vijay Kulkarni',
    );
  });

  it('is "Draft {Application ID}" for a draft that has no name yet', () => {
    expect(applicationFolderName(app({ fullNameAsPerPan: '' }))).toBe('Draft HL-2026-0001');
    expect(
      applicationFolderName(app({ fullNameAsPerPan: '  ', status: ApplicationStatus.KycDone })),
    ).toBe('Draft HL-2026-0001');
  });

  it('is only the Application ID for another status with no name', () => {
    expect(
      applicationFolderName(app({ fullNameAsPerPan: '', status: ApplicationStatus.InLevel1 })),
    ).toBe('HL-2026-0001');
  });
});

describe('the path of a file', () => {
  it('goes Loans / Home Loan / {where} / {application} / {subfolder}', () => {
    expect(documentFolderPath(app(), 'PAN Card')).toEqual([
      'Loans',
      'Home Loan',
      'Drafts',
      'HL-2026-0001 Vijay Kulkarni',
      '01 KYC',
    ]);
    expect(
      documentFolderPath(app({ status: ApplicationStatus.Approved }), 'Sale or Gift Deed'),
    ).toEqual([
      'Loans',
      'Home Loan',
      'Belagavi Main Branch (demo)',
      'HL-2026-0001 Vijay Kulkarni',
      '03 Property',
    ]);
    expect(applicationFolderPath(app({ status: ApplicationStatus.Rejected }))).toEqual([
      'Loans',
      'Home Loan',
      'Rejected',
      'HL-2026-0001 Vijay Kulkarni',
    ]);
  });

  it('has an id that is the path, a label with the slashes spaced, and the ids along the way', () => {
    const path = documentFolderPath(app(), 'Income Proof');
    expect(folderIdOf(path)).toBe('Loans/Home Loan/Drafts/HL-2026-0001 Vijay Kulkarni/02 Income');
    expect(pathLabelOf(path)).toBe(
      'Loans / Home Loan / Drafts / HL-2026-0001 Vijay Kulkarni / 02 Income',
    );
    expect(folderIdsAlong(path)).toEqual([
      'Loans',
      'Loans/Home Loan',
      'Loans/Home Loan/Drafts',
      'Loans/Home Loan/Drafts/HL-2026-0001 Vijay Kulkarni',
      'Loans/Home Loan/Drafts/HL-2026-0001 Vijay Kulkarni/02 Income',
    ]);
  });
});
