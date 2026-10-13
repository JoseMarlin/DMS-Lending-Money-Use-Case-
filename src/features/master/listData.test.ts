import { DEMO_USERS, SEED_APPLICATIONS } from '@/data/seed';
import { createBlankApplication } from '@/data/application';
import { ApplicationStatus, type HomeLoanApplication } from '@/data/types';
import {
  FILTERS,
  countByFilter,
  filterRecords,
  filterSubmissions,
  recordRows,
  recordsCsv,
  sortRecords,
  sortSubmissions,
  submissionsCsv,
  submissionsFor,
} from './listData';

const priya = DEMO_USERS.priya;

function app(patch: Partial<HomeLoanApplication>): HomeLoanApplication {
  return {
    ...createBlankApplication({
      applicationId: patch.applicationId ?? 'HL-2026-0100',
      branch: 'Belagavi Main Branch (demo)',
      createdBy: 'Priya Kulkarni',
      now: new Date('2026-09-01T10:00:00+05:30'),
    }),
    ...patch,
  };
}

describe('submissionsFor: who sees what', () => {
  it('shows a loan officer only what they made', () => {
    const rows = submissionsFor(priya, SEED_APPLICATIONS);
    expect(rows.map((r) => r.applicationId).sort()).toEqual([
      'HL-2026-0001',
      'HL-2026-0002',
      'HL-2026-0004',
      'HL-2026-0006',
      'HL-2026-0007',
    ]);
  });

  it('shows the administrator everything', () => {
    expect(submissionsFor(DEMO_USERS.admin, SEED_APPLICATIONS)).toHaveLength(
      SEED_APPLICATIONS.length,
    );
    expect(SEED_APPLICATIONS).toHaveLength(7);
  });

  it('shows an approver nothing: they review, they do not submit', () => {
    expect(submissionsFor(DEMO_USERS.mahesh, SEED_APPLICATIONS)).toEqual([]);
    expect(submissionsFor(DEMO_USERS.sunita, SEED_APPLICATIONS)).toEqual([]);
  });

  it('maps each status to its chip and takes the applicant name', () => {
    const rows = submissionsFor(priya, SEED_APPLICATIONS);
    const by = Object.fromEntries(rows.map((r) => [r.applicationId, r]));
    expect(by['HL-2026-0001']).toMatchObject({ name: 'Vijay Kulkarni', status: 'Approved' });
    expect(by['HL-2026-0002'].status).toBe('In-Progress');
    expect(by['HL-2026-0004'].status).toBe('Action Required');
    expect(by['HL-2026-0006']).toMatchObject({ name: 'Meera Joshi', status: 'Approved' });
  });

  it('shows the seed draft as a Draft row with its applicant name', () => {
    const rows = submissionsFor(priya, SEED_APPLICATIONS);
    expect(rows.find((r) => r.applicationId === 'HL-2026-0007')).toMatchObject({
      name: 'Prakash Naik',
      status: 'Draft',
    });
  });

  it('has one Action Required row to start with (the returned application)', () => {
    const counts = countByFilter(submissionsFor(priya, SEED_APPLICATIONS));
    expect(counts['action-required']).toBe(1);
  });

  it('shows a new application of the user at once, as In-Progress once submitted', () => {
    const submitted = app({
      applicationId: 'HL-2026-0008',
      status: ApplicationStatus.Submitted,
      fullNameAsPerPan: 'Ramesh Patil',
    });
    const rows = submissionsFor(priya, [...SEED_APPLICATIONS, submitted]);
    expect(rows.find((r) => r.applicationId === 'HL-2026-0008')?.status).toBe('In-Progress');
  });
});

describe('counts and filters', () => {
  const rows = submissionsFor(DEMO_USERS.admin, [
    ...SEED_APPLICATIONS,
    app({ applicationId: 'HL-2026-0008', status: ApplicationStatus.Draft }),
    app({ applicationId: 'HL-2026-0009', status: ApplicationStatus.KycDone }),
  ]);

  it('counts each chip, and "All" counts the drafts too', () => {
    expect(countByFilter(rows)).toEqual({
      all: 9,
      'in-progress': 2,
      approved: 2,
      rejected: 1,
      'action-required': 1,
    });
  });

  it('lists the chips in the order of the design, spelled as in the design', () => {
    expect(FILTERS.map((f) => f.label)).toEqual([
      'All',
      'InProgress',
      'Approved',
      'Rejected',
      'Action Required',
    ]);
  });

  it('filters by chip', () => {
    expect(filterSubmissions(rows, 'approved', '').map((r) => r.applicationId)).toEqual([
      'HL-2026-0001',
      'HL-2026-0006',
    ]);
    expect(filterSubmissions(rows, 'in-progress', '')).toHaveLength(2);
    expect(filterSubmissions(rows, 'all', '')).toHaveLength(9);
  });

  it('shows drafts only under All', () => {
    for (const key of ['in-progress', 'approved', 'rejected', 'action-required'] as const) {
      expect(filterSubmissions(rows, key, '').some((r) => r.status === 'Draft')).toBe(false);
    }
  });
});

describe('search', () => {
  const rows = submissionsFor(DEMO_USERS.admin, SEED_APPLICATIONS);

  it('matches the name, in any case', () => {
    expect(filterSubmissions(rows, 'all', 'vijay').map((r) => r.name)).toEqual(['Vijay Kulkarni']);
    expect(filterSubmissions(rows, 'all', 'PATIL').map((r) => r.name)).toEqual(['Savita Patil']);
  });

  it('matches the Application ID', () => {
    expect(filterSubmissions(rows, 'all', 'HL-2026-0003').map((r) => r.name)).toEqual([
      'Manjunath Hiremath',
    ]);
    expect(filterSubmissions(rows, 'all', 'hl-2026-0003')).toHaveLength(1);
  });

  it('ignores spaces at the ends and an empty search matches all', () => {
    expect(filterSubmissions(rows, 'all', '  vijay ')).toHaveLength(1);
    expect(filterSubmissions(rows, 'all', '   ')).toHaveLength(SEED_APPLICATIONS.length);
  });

  it('matches nothing for a text that is nowhere', () => {
    expect(filterSubmissions(rows, 'all', 'zzz')).toEqual([]);
  });

  it('does not search the PAN, the mobile or anything else that is not shown', () => {
    expect(filterSubmissions(rows, 'all', 'ABCPK2101L')).toEqual([]);
    expect(filterSubmissions(rows, 'all', '9876500201')).toEqual([]);
  });

  it('works together with a chip', () => {
    expect(filterSubmissions(rows, 'approved', 'savita')).toEqual([]);
    expect(filterSubmissions(rows, 'action-required', 'savita')).toHaveLength(1);
  });
});

describe('sorting submissions', () => {
  const rows = submissionsFor(DEMO_USERS.admin, [
    ...SEED_APPLICATIONS,
    app({ applicationId: 'HL-2026-0008', fullNameAsPerPan: '' }),
  ]);
  const ids = (list: typeof rows) => list.map((r) => r.applicationId);

  it('sorts by name A to Z and Z to A, with a nameless draft always last', () => {
    expect(sortSubmissions(rows, 'name', 'asc').map((r) => r.name)).toEqual([
      'Basavaraj Kadam',
      'Manjunath Hiremath',
      'Meera Joshi',
      'Prakash Naik',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
      '',
    ]);
    expect(sortSubmissions(rows, 'name', 'desc').map((r) => r.name)).toEqual([
      'Vijay Kulkarni',
      'Shobha Gaonkar',
      'Savita Patil',
      'Prakash Naik',
      'Meera Joshi',
      'Manjunath Hiremath',
      'Basavaraj Kadam',
      '',
    ]);
  });

  it('sorts by date, newest first or oldest first', () => {
    const newest = sortSubmissions(rows, 'createdAt', 'desc');
    expect(newest[0].applicationId).toBe('HL-2026-0007'); // 10 Oct, the seed draft
    expect(ids(newest).at(-1)).toBe('HL-2026-0001'); // 18 Aug
    expect(ids(sortSubmissions(rows, 'createdAt', 'asc'))).toEqual(ids(newest).reverse());
  });

  it('does not change the list it is given', () => {
    const copy = [...rows];
    sortSubmissions(rows, 'name', 'asc');
    expect(rows).toEqual(copy);
  });

  it('sorts names without caring about case', () => {
    const mixed = [
      { applicationId: 'a', name: 'bravo', status: 'Draft' as const, createdAt: '' },
      { applicationId: 'b', name: 'Alpha', status: 'Draft' as const, createdAt: '' },
      { applicationId: 'c', name: 'charlie', status: 'Draft' as const, createdAt: '' },
    ];
    expect(sortSubmissions(mixed, 'name', 'asc').map((r) => r.name)).toEqual([
      'Alpha',
      'bravo',
      'charlie',
    ]);
  });
});

describe('the CSV of My Submissions', () => {
  const rows = submissionsFor(DEMO_USERS.admin, SEED_APPLICATIONS);

  it('has a header and one line for each row', () => {
    const lines = submissionsCsv(rows).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Application ID,Name,Status,Created On');
    expect(lines).toHaveLength(SEED_APPLICATIONS.length + 1);
    // the date has a comma, so it is in quotes
    expect(lines).toContain('HL-2026-0001,Vijay Kulkarni,Approved,"18 Aug 2026, 10:00 AM"');
  });

  it('never contains a PAN or an Aadhaar (not even the masked one)', () => {
    const csv = submissionsCsv(rows);
    for (const a of SEED_APPLICATIONS) {
      expect(csv).not.toContain(a.pan);
      expect(csv).not.toContain(a.aadhaar);
    }
    expect(csv).not.toMatch(/XXXX XXXX|Aadhaar|PAN/);
  });

  it('writes only the rows it is given', () => {
    const one = filterSubmissions(rows, 'approved', '');
    // the header and the two approved applications
    expect(submissionsCsv(one).trimEnd().split('\r\n')).toHaveLength(3);
  });
});

describe('All Records', () => {
  const approved = app({
    applicationId: 'HL-2026-0001',
    fullNameAsPerPan: 'Vijay Kulkarni',
    loanPurpose: 'Construction of house',
    sanctionedAmount: 2_000_000,
    branch: 'Belagavi Main Branch (demo)',
    level2Time: '2026-08-26T15:00:00+05:30',
    sanctionDate: '2026-08-26',
    status: ApplicationStatus.Approved,
  });
  const second = app({
    applicationId: 'HL-2026-0009',
    fullNameAsPerPan: 'Anita Desai',
    loanPurpose: 'Purchase of flat',
    sanctionedAmount: 1_200_000,
    branch: 'Gokak Branch (demo)',
    level2Time: '2026-10-08T15:00:00+05:30',
    sanctionDate: '2026-10-08',
    status: ApplicationStatus.Approved,
  });
  const rows = recordRows([approved, second]);

  it('is empty when there are no master records', () => {
    expect(recordRows([])).toEqual([]);
  });

  it('turns a record into the columns of the table', () => {
    expect(rows[0]).toEqual({
      applicationId: 'HL-2026-0001',
      applicantName: 'Vijay Kulkarni',
      loanPurpose: 'Construction of house',
      sanctionedAmount: 2_000_000,
      branch: 'Belagavi Main Branch (demo)',
      approvedOn: '2026-08-26T15:00:00+05:30',
    });
  });

  it('uses the sanction date when there is no Level 2 time', () => {
    const [row] = recordRows([app({ level2Time: '', sanctionDate: '2026-08-26' })]);
    expect(row.approvedOn).toBe('2026-08-26');
  });

  it('searches the name and the Application ID', () => {
    expect(filterRecords(rows, 'anita')).toHaveLength(1);
    expect(filterRecords(rows, 'HL-2026-0001')).toHaveLength(1);
    expect(filterRecords(rows, 'zzz')).toEqual([]);
  });

  it('sorts by amount, date, name and ID', () => {
    const ids = (list: typeof rows) => list.map((r) => r.applicationId);
    expect(ids(sortRecords(rows, 'sanctionedAmount', 'desc'))).toEqual([
      'HL-2026-0001',
      'HL-2026-0009',
    ]);
    expect(ids(sortRecords(rows, 'approvedOn', 'desc'))).toEqual(['HL-2026-0009', 'HL-2026-0001']);
    expect(sortRecords(rows, 'applicantName', 'asc').map((r) => r.applicantName)).toEqual([
      'Anita Desai',
      'Vijay Kulkarni',
    ]);
    expect(ids(sortRecords(rows, 'applicationId', 'desc'))).toEqual([
      'HL-2026-0009',
      'HL-2026-0001',
    ]);
  });

  it('writes a CSV with the amount as a plain number and no PAN or Aadhaar', () => {
    const csv = recordsCsv(rows);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Application ID,Applicant Name,Loan Purpose,Sanctioned Amount,Branch,Approved On',
    );
    expect(lines[1]).toBe(
      'HL-2026-0001,Vijay Kulkarni,Construction of house,2000000,Belagavi Main Branch (demo),26 Aug 2026',
    );
    expect(csv).not.toMatch(/ABCP|XXXX XXXX/);
  });
});
