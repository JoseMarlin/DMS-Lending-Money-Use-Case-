/**
 * What the Home Loan master list shows, worked out from the store. Plain functions, no React, so
 * the rules (who sees what, how rows are counted, searched, sorted and exported) can be tested.
 */
import { listStatusOf, type ListStatus } from '@/data/listStatus';
import type { DemoUser, HomeLoanApplication } from '@/data/types';
import { toCsv } from '@/lib/csv';
import { formatListDate, formatListDateTime } from '@/lib/format';

// ---------------------------------------------------------------------------
// My Submissions
// ---------------------------------------------------------------------------

export interface SubmissionRow {
  applicationId: string;
  /** The applicant's name, '' while a draft has none yet */
  name: string;
  status: ListStatus;
  /** ISO date and time */
  createdAt: string;
}

/**
 * The applications that belong in My Submissions for this user: a loan officer sees the ones they
 * made, the administrator sees all of them, an approver sees none (they review, they do not submit).
 */
export function submissionsFor(
  user: DemoUser,
  applications: HomeLoanApplication[],
): SubmissionRow[] {
  const mine =
    user.role === 'admin'
      ? applications
      : user.role === 'loanOfficer'
        ? applications.filter((a) => a.createdBy === user.name)
        : [];
  return mine.map((a) => ({
    applicationId: a.applicationId,
    name: a.fullNameAsPerPan,
    status: listStatusOf(a.status),
    createdAt: a.createdAt,
  }));
}

export type FilterKey = 'all' | 'in-progress' | 'approved' | 'rejected' | 'action-required';

/** The chips above the table, in order. "All" has no status. The label is spelled as in the design. */
export const FILTERS: { key: FilterKey; label: string; status: ListStatus | null }[] = [
  { key: 'all', label: 'All', status: null },
  { key: 'in-progress', label: 'InProgress', status: 'In-Progress' },
  { key: 'approved', label: 'Approved', status: 'Approved' },
  { key: 'rejected', label: 'Rejected', status: 'Rejected' },
  { key: 'action-required', label: 'Action Required', status: 'Action Required' },
];

/** How many rows each chip stands for. Drafts are only in "All". */
export function countByFilter(rows: SubmissionRow[]): Record<FilterKey, number> {
  const counts = {} as Record<FilterKey, number>;
  for (const filter of FILTERS) {
    counts[filter.key] = filter.status
      ? rows.filter((r) => r.status === filter.status).length
      : rows.length;
  }
  return counts;
}

/** True when the text is in the name or the Application ID (any case, spaces at the ends ignored). */
function matches(query: string, ...fields: string[]): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || fields.some((field) => field.toLowerCase().includes(q));
}

export function filterSubmissions(
  rows: SubmissionRow[],
  filter: FilterKey,
  query: string,
): SubmissionRow[] {
  const status = FILTERS.find((f) => f.key === filter)?.status ?? null;
  return rows.filter(
    (row) =>
      (status === null || row.status === status) && matches(query, row.name, row.applicationId),
  );
}

export type SortDirection = 'asc' | 'desc';

function sortBy<T>(
  rows: T[],
  value: (row: T) => string | number,
  direction: SortDirection,
  tieBreak: (row: T) => string,
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    const order =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'en', { sensitivity: 'base' });
    return order !== 0 ? order * sign : tieBreak(a).localeCompare(tieBreak(b));
  });
}

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

export function sortSubmissions(
  rows: SubmissionRow[],
  id: string,
  direction: SortDirection,
): SubmissionRow[] {
  const tie = (r: SubmissionRow) => r.applicationId;
  if (id === 'name') {
    // a draft without a name goes to the end, whichever way the names run
    const named = rows.filter((r) => r.name.trim() !== '');
    const unnamed = rows.filter((r) => r.name.trim() === '');
    return [
      ...sortBy(named, (r) => r.name, direction, tie),
      ...sortBy(unnamed, () => 0, 'asc', tie),
    ];
  }
  return sortBy(rows, (r) => time(r.createdAt), direction, tie);
}

export function submissionsCsv(rows: SubmissionRow[]): string {
  return toCsv([
    ['Application ID', 'Name', 'Status', 'Created On'],
    ...rows.map((r) => [r.applicationId, r.name, r.status, formatListDateTime(r.createdAt)]),
  ]);
}

// ---------------------------------------------------------------------------
// All Records
// ---------------------------------------------------------------------------

export interface RecordRow {
  applicationId: string;
  applicantName: string;
  loanPurpose: string;
  sanctionedAmount: number | null;
  branch: string;
  /** ISO date or date and time of the final approval */
  approvedOn: string;
}

/** The master records, as rows. A record is created at the final approval, so it has the Level 2 time. */
export function recordRows(records: HomeLoanApplication[]): RecordRow[] {
  return records.map((r) => ({
    applicationId: r.applicationId,
    applicantName: r.fullNameAsPerPan,
    loanPurpose: r.loanPurpose,
    sanctionedAmount: r.sanctionedAmount,
    branch: r.branch,
    approvedOn: r.level2Time || r.sanctionDate,
  }));
}

export function filterRecords(rows: RecordRow[], query: string): RecordRow[] {
  return rows.filter((row) => matches(query, row.applicantName, row.applicationId));
}

export function sortRecords(rows: RecordRow[], id: string, direction: SortDirection): RecordRow[] {
  const tie = (r: RecordRow) => r.applicationId;
  switch (id) {
    case 'applicationId':
      return sortBy(rows, (r) => r.applicationId, direction, tie);
    case 'applicantName':
      return sortBy(rows, (r) => r.applicantName, direction, tie);
    case 'sanctionedAmount':
      return sortBy(rows, (r) => r.sanctionedAmount ?? 0, direction, tie);
    default:
      return sortBy(rows, (r) => time(r.approvedOn), direction, tie);
  }
}

export function recordsCsv(rows: RecordRow[]): string {
  return toCsv([
    [
      'Application ID',
      'Applicant Name',
      'Loan Purpose',
      'Sanctioned Amount',
      'Branch',
      'Approved On',
    ],
    ...rows.map((r) => [
      r.applicationId,
      r.applicantName,
      r.loanPurpose,
      r.sanctionedAmount,
      r.branch,
      formatListDate(r.approvedOn),
    ]),
  ]);
}
