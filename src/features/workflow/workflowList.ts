/**
 * What the Workflow screen lists, worked out from the workflow data. Plain functions, so the rules
 * (what is in each tab, how a row reads, search and order) can be tested without a screen.
 *
 *   My Actions     the instances where it is this user's turn (pendingTasksFor)
 *   Completed      the instances this user has acted on (they decided, or they submitted it)
 *   All Workflows  every instance for the administrator; for everybody else the ones they are in
 */
import type { DemoUser, HomeLoanApplication, WorkflowInstance } from '@/data/types';
import { completedFor, instancesFor, pendingTasksFor, type WorkflowData } from '@/data/workflow';
import { formatListDateTime } from '@/lib/format';

export type WorkflowTab = 'my-actions' | 'completed' | 'all';

export const WORKFLOW_TABS: { id: WorkflowTab; label: string }[] = [
  { id: 'my-actions', label: 'My Actions' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All Workflows' },
];

export interface WorkflowRowData {
  instance: WorkflowInstance;
  /** The applicant's name; '' if the application cannot be found */
  applicantName: string;
  /** The KYC result of the application is Exception (both approvers get a badge for it) */
  kycException: boolean;
  /** What the button of the row says: "Review Request" when it is the user's turn, else "View" */
  action: 'Review Request' | 'View';
}

type Source = Pick<
  WorkflowData,
  'applications' | 'masterRecords' | 'workflowInstances' | 'notifications'
>;

function applicationOf(source: Source, id: string): HomeLoanApplication | undefined {
  return (
    source.applications.find((a) => a.applicationId === id) ??
    source.masterRecords.find((a) => a.applicationId === id)
  );
}

function rowOf(
  source: Source,
  instance: WorkflowInstance,
  action: WorkflowRowData['action'],
): WorkflowRowData {
  const application = applicationOf(source, instance.applicationId);
  return {
    instance,
    applicantName: application?.fullNameAsPerPan ?? '',
    kycException: application?.kycOverallResult === 'Exception',
    action,
  };
}

/** The rows of each tab for this user. */
export function rowsByTab(source: Source, user: DemoUser): Record<WorkflowTab, WorkflowRowData[]> {
  const waiting = new Set(pendingTasksFor(source, user).map((task) => task.id));
  const mine = source.workflowInstances.filter((i) => waiting.has(i.id));
  return {
    'my-actions': mine.map((i) => rowOf(source, i, 'Review Request')),
    completed: completedFor(source, user).map((i) => rowOf(source, i, 'View')),
    all: instancesFor(source, user).map((i) =>
      rowOf(source, i, waiting.has(i.id) ? 'Review Request' : 'View'),
    ),
  };
}

/** "My Actions (07)": the number has at least two digits, as in the design. */
export function tabLabel(name: string, count: number): string {
  return `${name} (${String(count).padStart(2, '0')})`;
}

/** "Form Submitted · Home Loan Application · Ramesh Patil" */
export function rowTitle(applicantName: string): string {
  return ['Form Submitted', 'Home Loan Application', applicantName.trim()]
    .filter(Boolean)
    .join(' · ');
}

/** "WI-23445213 · Home Loan Approval · Initiated by Priya Kulkarni · 9 Oct 2026, 5:09 PM" */
export function rowMeta(instance: WorkflowInstance): string {
  return [
    instance.id,
    instance.workflowName,
    `Initiated by ${instance.initiatedBy}`,
    formatListDateTime(instance.initiatedAt),
  ].join(' · ');
}

/** The rows that match the search: the applicant, the instance ID, the Application ID or who submitted. */
export function filterRows(rows: WorkflowRowData[], query: string): WorkflowRowData[] {
  const q = query.trim().toLowerCase();
  if (q === '') return rows;
  return rows.filter((row) =>
    [row.applicantName, row.instance.id, row.instance.applicationId, row.instance.initiatedBy].some(
      (text) => text.toLowerCase().includes(q),
    ),
  );
}

/** Newest submission first, or oldest first. Does not change the list it is given. */
export function sortRows(rows: WorkflowRowData[], newestFirst: boolean): WorkflowRowData[] {
  const sign = newestFirst ? -1 : 1;
  return [...rows].sort(
    (a, b) =>
      sign * (Date.parse(a.instance.initiatedAt) - Date.parse(b.instance.initiatedAt)) ||
      a.instance.id.localeCompare(b.instance.id),
  );
}

/** Where Review Request and View go: the review screen of the instance. */
export const reviewPath = (instanceId: string) =>
  `/workflow/review/${encodeURIComponent(instanceId)}`;
