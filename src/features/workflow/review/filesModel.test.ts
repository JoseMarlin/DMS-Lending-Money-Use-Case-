import { SEED_APPLICATIONS } from '@/data/seed';
import { ApplicationStatus, type DocType, type HomeLoanApplication } from '@/data/types';
import { fileRows, folderLabelOf, sortFileRows, type FileRow } from './filesModel';

const apps = () => structuredClone(SEED_APPLICATIONS);
const byName = (name: string): HomeLoanApplication =>
  apps().find((a) => a.fullNameAsPerPan === name)!;

describe('folderLabelOf', () => {
  it('writes the last folder after an ellipsis, as the design does', () => {
    expect(
      folderLabelOf([
        'Loans',
        'Home Loan',
        'Belagavi Main Branch (demo)',
        'HL-2026-0001 Vijay',
        '01 KYC',
      ]),
    ).toBe('... / 01 KYC');
    expect(folderLabelOf(['02 Income'])).toBe('... / 02 Income');
  });

  it('gives a dash for no path', () => {
    expect(folderLabelOf([])).toBe('-');
  });
});

describe('fileRows of an application that waits for approval', () => {
  const shobha = byName('Shobha Gaonkar'); // waits at Level 2
  const rows = fileRows(shobha);

  it('has one row for each uploaded document, in the order of the upload', () => {
    expect(rows).toHaveLength(shobha.documents.length);
    expect(rows.map((r) => r.id)).toEqual(shobha.documents.map((d) => d.id));
    expect(rows[0].fileName).toBe('PAN_Card_Shobha_Gaonkar.pdf');
    expect(rows[0].docType).toBe('PAN Card');
  });

  it('writes the uploader and the time under the file name', () => {
    expect(rows[0].subline).toBe('Priya Kulkarni · 14 Sep 2026, 10:30 AM');
  });

  it('says where the file is now, in Pending Approval, with the status of the file', () => {
    expect(rows.every((r) => r.status === 'Pending approval')).toBe(true);
    expect(rows[0].folderPath).toBe(
      'Loans / Home Loan / Pending Approval / HL-2026-0002 Shobha Gaonkar / 01 KYC',
    );
    expect(rows[0].folderId).toBe(
      'Loans/Home Loan/Pending Approval/HL-2026-0002 Shobha Gaonkar/01 KYC',
    );
    expect(rows[0].folderLabel).toBe('... / 01 KYC');
  });

  it('puts each DocType in the folder of its group (section 10)', () => {
    const label = (docType: DocType) => rows.find((r) => r.docType === docType)?.folderLabel;
    expect(label('PAN Card')).toBe('... / 01 KYC');
    expect(label('Photograph')).toBe('... / 01 KYC');
    expect(label('Income Proof')).toBe('... / 02 Income');
    expect(label('Surety Documents')).toBe('... / 02 Income');
    expect(label('Sale or Gift Deed')).toBe('... / 03 Property');
    expect(label('Tax Paid Receipt')).toBe('... / 03 Property');
  });

  it('has no comments yet, and every file is on its first version', () => {
    expect(rows.every((r) => r.comment === '')).toBe(true);
    expect(rows.every((r) => r.version === 'v1.0')).toBe(true);
  });

  it('keeps the type of the file, for the icon', () => {
    const photo = rows.find((r) => r.docType === 'Photograph')!;
    expect(photo.mimeType).toBe('image/jpeg');
    expect(rows[0].mimeType).toBe('application/pdf');
  });
});

describe('fileRows of an approved application', () => {
  const vijay = byName('Vijay Kulkarni');
  const rows = fileRows(vijay);

  it('has the 12 documents and the 2 attachments, filed in the folder of the branch, and the Sanction Summary after them', () => {
    expect(vijay.documents).toHaveLength(14); // 12 DocTypes of the form + 2 Supporting Documents
    expect(rows).toHaveLength(vijay.documents.length + 1);
    expect(rows.every((r) => r.status === 'Filed')).toBe(true);
    expect(rows[0].folderPath).toBe(
      'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 01 KYC',
    );
    expect(rows[0].folderLabel).toBe('... / 01 KYC');
    const summary = rows.at(-1)!;
    expect(summary.fileName).toBe('Sanction_Summary_Vijay_Kulkarni.pdf');
    expect(summary.docType).toBe('Sanction Summary');
    expect(summary.folderLabel).toBe('... / 04 Sanction');
    expect(summary.uploadedBy).toBe('System');
  });

  it('files the attachments (Supporting Documents) in 05 Other, before the Sanction Summary', () => {
    const attachments = rows.filter((r) => r.docType === 'Supporting Document');
    expect(attachments.map((r) => r.fileName)).toEqual([
      'Salary_Slip_Aug.pdf',
      'Electricity_Bill.pdf',
    ]);
    for (const row of attachments) {
      expect(row.folderLabel).toBe('... / 05 Other');
      expect(row.folderPath).toBe(
        'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 05 Other',
      );
      expect(row.status).toBe('Filed');
    }
    expect(rows.slice(-3, -1).map((r) => r.docType)).toEqual([
      'Supporting Document',
      'Supporting Document',
    ]);
  });

  it('follows the application, not the filing data written at the approval', () => {
    // the branch of the record was edited later: the files are where the record is now
    const moved = { ...vijay, branch: 'Gokak Branch (demo)' };
    const row = fileRows(moved)[0];
    expect(row.folderPath).toBe(
      'Loans / Home Loan / Gokak Branch (demo) / HL-2026-0001 Vijay Kulkarni / 01 KYC',
    );
    // the filing data that the approval wrote is still there, for the trail
    expect(moved.documents[0].filing?.folderPath).toContain('Belagavi Main Branch (demo)');
  });

  it('has only the Sanction Summary for an application with no documents', () => {
    expect(fileRows({ ...vijay, documents: [] }).map((r) => r.docType)).toEqual([
      'Sanction Summary',
    ]);
    expect(fileRows({ ...byName('Shobha Gaonkar'), documents: [] })).toEqual([]);
  });
});

describe('fileRows of a rejected, returned or draft application', () => {
  it('puts the files of a rejected application in Rejected', () => {
    const rejected = byName('Basavaraj Kadam'); // rejected at Level 2
    const rows = fileRows(rejected);
    expect(rows).toHaveLength(rejected.documents.length);
    for (const row of rows) {
      expect(row.status).toBe('Rejected');
      expect(row.folderPath).toMatch(
        /^Loans \/ Home Loan \/ Rejected \/ HL-2026-0005 Basavaraj Kadam \/ 0\d /,
      );
    }
  });

  it('keeps the files of a returned application in Pending Approval, as Returned (it can be resubmitted)', () => {
    const rows = fileRows(byName('Savita Patil'));
    expect(rows.every((r) => r.status === 'Returned')).toBe(true);
    expect(
      rows.every((r) => r.folderPath.startsWith('Loans / Home Loan / Pending Approval / ')),
    ).toBe(true);
  });

  it('puts the files of a draft in Drafts, with "Draft {ID}" until a name is entered', () => {
    const draft = {
      ...byName('Savita Patil'),
      status: ApplicationStatus.Draft,
      fullNameAsPerPan: '',
    };
    const rows = fileRows(draft);
    expect(rows.every((r) => r.status === 'Draft')).toBe(true);
    expect(rows[0].folderPath).toBe('Loans / Home Loan / Drafts / Draft HL-2026-0004 / 01 KYC');
  });

  it('moves with the status: the same files, a new folder', () => {
    const app = byName('Manjunath Hiremath'); // at Level 1
    expect(fileRows(app)[0].folderPath).toContain('/ Pending Approval /');
    expect(fileRows({ ...app, status: ApplicationStatus.Rejected })[0].folderPath).toContain(
      '/ Rejected /',
    );
    expect(fileRows({ ...app, status: ApplicationStatus.Approved })[0].folderPath).toContain(
      '/ Gokak Branch (demo) /',
    );
  });
});

describe('sortFileRows', () => {
  const rows = fileRows(byName('Shobha Gaonkar'));
  const names = (list: FileRow[]) => list.map((r) => r.fileName);

  it('gives the rows as uploaded when there is no sort, or an unknown column', () => {
    expect(sortFileRows(rows, null)).toBe(rows);
    expect(sortFileRows(rows, { id: 'actions', dir: 'asc' })).toBe(rows);
  });

  it('sorts names with numbers the way a person counts, whatever the case', () => {
    const list = ['File_10.pdf', 'file_1.pdf', 'File_2.pdf'].map((fileName, i) => ({
      ...rows[0],
      id: String(i),
      fileName,
    }));
    expect(names(sortFileRows(list, { id: 'file', dir: 'asc' }))).toEqual([
      'file_1.pdf',
      'File_2.pdf',
      'File_10.pdf',
    ]);
    expect(names(sortFileRows(list, { id: 'file', dir: 'desc' }))).toEqual([
      'File_10.pdf',
      'File_2.pdf',
      'file_1.pdf',
    ]);
  });

  it('sorts by file name, up and down', () => {
    const asc = names(sortFileRows(rows, { id: 'file', dir: 'asc' }));
    expect(asc).toEqual([...names(rows)].sort((a, b) => a.localeCompare(b)));
    expect(names(sortFileRows(rows, { id: 'file', dir: 'desc' }))).toEqual([...asc].reverse());
  });

  it('sorts by DocType, and equal values keep the order of the upload', () => {
    const list = [
      { ...rows[0], id: 'a', docType: 'PAN Card' as const, fileName: '1.pdf' },
      { ...rows[0], id: 'b', docType: 'Photograph' as const, fileName: '2.pdf' },
      { ...rows[0], id: 'c', docType: 'PAN Card' as const, fileName: '3.pdf' },
    ];
    expect(sortFileRows(list, { id: 'docType', dir: 'asc' }).map((r) => r.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(sortFileRows(list, { id: 'docType', dir: 'desc' }).map((r) => r.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('sorts by folder: 01 KYC before 02 Income before 03 Property before 05 Other (the attachments)', () => {
    const labels = sortFileRows(rows, { id: 'folder', dir: 'asc' }).map((r) => r.folderLabel);
    expect(labels).toEqual([...labels].sort());
    expect(labels[0]).toBe('... / 01 KYC');
    expect(labels.at(-1)).toBe('... / 05 Other');
    expect(new Set(labels)).toEqual(
      new Set(['... / 01 KYC', '... / 02 Income', '... / 03 Property', '... / 05 Other']),
    );
    expect(sortFileRows(rows, { id: 'folder', dir: 'desc' })[0].folderLabel).toBe('... / 05 Other');
    expect(sortFileRows(rows, { id: 'folder', dir: 'desc' }).at(-1)?.folderLabel).toBe(
      '... / 01 KYC',
    );
  });

  it('keeps the files without a comment at the end, whichever way it runs', () => {
    const list = [
      { ...rows[0], id: 'a', comment: '' },
      { ...rows[0], id: 'b', comment: 'Approved' },
      { ...rows[0], id: 'c', comment: '' },
      { ...rows[0], id: 'd', comment: 'Blurred' },
    ];
    expect(sortFileRows(list, { id: 'comments', dir: 'asc' }).map((r) => r.id)).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
    expect(sortFileRows(list, { id: 'comments', dir: 'desc' }).map((r) => r.id)).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
  });

  it('does not change the list it is given', () => {
    const copy = [...rows];
    sortFileRows(rows, { id: 'file', dir: 'desc' });
    expect(rows).toEqual(copy);
  });
});

describe('every seeded application', () => {
  it('shows each one where its status puts it', () => {
    const states = Object.fromEntries(
      apps().map((a) => [a.fullNameAsPerPan, new Set(fileRows(a).map((r) => r.status))]),
    );
    expect(states['Vijay Kulkarni']).toEqual(new Set(['Filed']));
    expect(states['Shobha Gaonkar']).toEqual(new Set(['Pending approval'])); // at Level 2
    expect(states['Manjunath Hiremath']).toEqual(new Set(['Pending approval'])); // at Level 1
    expect(states['Savita Patil']).toEqual(new Set(['Returned']));
    expect(states['Basavaraj Kadam']).toEqual(new Set(['Rejected']));
    expect(states['Meera Joshi']).toEqual(new Set(['Filed']));
    expect(states['Prakash Naik']).toEqual(new Set(['Draft']));
  });

  it('has the attachments among the files of each one, in 05 Other', () => {
    for (const app of apps()) {
      const attachments = app.documents.filter((d) => d.docType === 'Supporting Document');
      expect(attachments.length).toBeGreaterThan(0);
      const rows = fileRows(app).filter((r) => r.docType === 'Supporting Document');
      expect(rows.map((r) => r.id)).toEqual(attachments.map((d) => d.id));
      expect(rows.every((r) => r.folderLabel === '... / 05 Other')).toBe(true);
    }
  });
});
