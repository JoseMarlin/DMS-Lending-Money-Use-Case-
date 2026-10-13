/**
 * What the review screen says, worked out from the workflow data. Plain functions, so the rules
 * (who can act, what each step of the Progress panel shows, which rows the Record Details tab has)
 * can be tested without a screen.
 */
import type { BadgeTone } from '@/components/ui';
import {
  KycResult,
  WorkflowInstanceStatus,
  WorkflowNodeStatus,
  type DemoUser,
  type HomeLoanApplication,
  type WorkflowInstance,
  type WorkflowNode,
} from '@/data/types';
import { pendingTasksFor, type WorkflowData, type WorkflowErrorCode } from '@/data/workflow';
import { formatListDateTime, formatShortDate } from '@/lib/format';
import { buildReviewGroups } from '@/features/home-loan/review/reviewRows';
import { STEP1_SECTIONS } from '@/features/home-loan/form/step1Schema';

type Source = Pick<
  WorkflowData,
  'applications' | 'masterRecords' | 'workflowInstances' | 'notifications'
>;

/** The application of an instance: in the working list, or (once approved) the master record. */
export function applicationOfInstance(
  source: Pick<Source, 'applications' | 'masterRecords'>,
  instance: WorkflowInstance,
): HomeLoanApplication | undefined {
  return (
    source.applications.find((a) => a.applicationId === instance.applicationId) ??
    source.masterRecords.find((a) => a.applicationId === instance.applicationId)
  );
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

/** "Form Submitted · Home Loan Application : Ramesh Patil" */
export function headerTitle(applicantName: string): string {
  return ['Form Submitted · Home Loan Application', applicantName.trim()]
    .filter(Boolean)
    .join(' : ');
}

// ---------------------------------------------------------------------------
// Take Action
// ---------------------------------------------------------------------------

/**
 * The sentence behind a disabled Take Action: why this user has no action on the instance.
 * `block` is what `actionBlock` (the store's own check) answered.
 */
export function blockMessage(
  block: { code: WorkflowErrorCode; error: string },
  instance: WorkflowInstance,
): string {
  const current = instance.nodes.find((n) => n.index === instance.currentNodeIndex);
  switch (block.code) {
    case 'not-active':
      return `This request is ${instance.status.toLowerCase()}, so nothing is waiting for action.`;
    case 'not-pending':
      return 'Nothing is waiting for action on this request.';
    case 'own-instance':
      return 'You submitted this request, so you cannot act on it.';
    case 'wrong-role':
      return current
        ? `Waiting for ${current.assignee} (${current.name.replace(/^Level \d: /, '')}). You have no action on this request.`
        : 'You have no action on this request.';
    case 'same-approver':
      return 'You approved Level 1, so a different person has to decide at Level 2.';
    default:
      return 'You have no action on this request.';
  }
}

// ---------------------------------------------------------------------------
// The Progress panel
// ---------------------------------------------------------------------------

export type StepState = 'done' | 'current' | 'upcoming';
export type StepTone = 'success' | 'warning' | 'error';

export interface ProgressStep {
  index: number;
  name: string;
  /** current: the step in play (a blue circle); done: it has been passed or decided; upcoming: not reached */
  state: StepState;
  /** "Mahesh Joshi · 9 Oct 2026, 6:23 PM" once someone has acted; before that only who it waits for */
  who: string;
  /** The two parts of `who`, so that the screen can keep the time together on one line */
  actor: string;
  when: string;
  chip: { label: string; tone: StepTone } | null;
  comment: string;
}

function chipOf(node: WorkflowNode, yourTurn: boolean): ProgressStep['chip'] {
  switch (node.status) {
    case WorkflowNodeStatus.Done:
      return node.index === 1
        ? { label: 'Submitted', tone: 'success' }
        : { label: 'Completed', tone: 'success' };
    case WorkflowNodeStatus.Approved:
      return { label: 'Approved', tone: 'success' };
    case WorkflowNodeStatus.Rejected:
      return { label: 'Rejected', tone: 'error' };
    case WorkflowNodeStatus.Returned:
      return { label: 'Returned', tone: 'warning' };
    case WorkflowNodeStatus.Pending:
      return yourTurn
        ? { label: 'Your approval required', tone: 'error' }
        : { label: 'Waiting for approval', tone: 'warning' };
    default:
      return null;
  }
}

/**
 * One entry per node of the instance. `yourTurn` is whether the person looking has the action
 * (so the current step says "Your approval required" to them and "Waiting for approval" to
 * everybody else).
 */
export function progressSteps(instance: WorkflowInstance, yourTurn: boolean): ProgressStep[] {
  return instance.nodes.map((node) => {
    const acted = node.actedBy !== '';
    const actor = acted ? node.actedBy : node.assignee;
    const when = acted ? formatListDateTime(node.actedAt) : '';
    const current =
      instance.status === WorkflowInstanceStatus.InProgress &&
      node.status === WorkflowNodeStatus.Pending;
    return {
      index: node.index,
      name: node.name,
      state: current ? 'current' : node.status === WorkflowNodeStatus.Waiting ? 'upcoming' : 'done',
      who: acted ? [actor, when].filter(Boolean).join(' \u00b7 ') : actor,
      actor,
      when,
      chip: chipOf(node, yourTurn),
      comment: node.comment,
    };
  });
}

// ---------------------------------------------------------------------------
// The Submission panel (the user's pending submissions)
// ---------------------------------------------------------------------------

export interface SubmissionItem {
  /** The instance id: what a click opens */
  id: string;
  applicantName: string;
  applicationId: string;
  /** "Pending" for everything in this list */
  status: 'Pending';
  /** The day it reached the user, as "25 Jun, 26" */
  date: string;
}

/** The submissions waiting for this user, oldest first, narrowed by the search text. */
export function submissionItems(source: Source, user: DemoUser, query: string): SubmissionItem[] {
  const q = query.trim().toLowerCase();
  return pendingTasksFor(source, user)
    .map((task) => ({
      id: task.id,
      applicantName: task.applicantName,
      applicationId: task.applicationId,
      status: 'Pending' as const,
      date: formatShortDate(task.receivedAt),
    }))
    .filter(
      (item) =>
        q === '' ||
        [item.applicantName, item.id, item.applicationId].some((text) =>
          text.toLowerCase().includes(q),
        ),
    );
}

// ---------------------------------------------------------------------------
// Record Details
// ---------------------------------------------------------------------------

export interface DetailRow {
  label: string;
  value: string;
}

export interface DetailSection {
  id: string;
  title: string;
  rows: DetailRow[];
}

/** The title the review screen gives a form section ("Property and security" is "Property" here). */
const SECTION_TITLE: Record<string, string> = { property: 'Property' };

/**
 * The application as label and value rows, grouped like the form: Application, Applicant,
 * Identity, Property, Co-applicant (when there is one), Sureties and Consent. Built from the
 * form's own schema, so the labels are the form's labels and the Aadhaar is the masked value.
 */
export function detailSections(application: HomeLoanApplication): DetailSection[] {
  const groups = buildReviewGroups(STEP1_SECTIONS, application)
    // the form always has the Co-applicant section (a toggle), the review has it only when there is one
    .filter((group) => group.id !== 'co-applicant' || application.addCoApplicant)
    .map((group): DetailSection => ({
      id: group.id,
      title: SECTION_TITLE[group.id] ?? group.title,
      rows: group.rows.map((row) => ({ label: row.label, value: row.value })),
    }));
  const consent: DetailSection = {
    id: 'consent',
    title: 'Consent',
    rows: [
      { label: 'Consent Given', value: application.consentGiven ? 'Yes' : 'No' },
      {
        label: 'Consent Time',
        value: formatListDateTime(application.consentTime) || '—',
      },
    ],
  };
  return [...groups, consent];
}

export interface KycBlock {
  result: string;
  tone: BadgeTone;
  /** Name Match Percent, then the PAN, Aadhaar and GST statuses */
  rows: DetailRow[];
  /** The loan officer's remark for an Exception, '' otherwise */
  remark: string;
}

const KYC_TONE: Record<string, BadgeTone> = {
  [KycResult.Pass]: 'success',
  [KycResult.Exception]: 'warning',
  [KycResult.Fail]: 'error',
};

/** The KYC result of the application, for the block under the details. */
export function kycBlock(application: HomeLoanApplication): KycBlock {
  const result = application.kycOverallResult;
  return {
    result: result || 'Not checked',
    tone: KYC_TONE[result] ?? 'neutral',
    rows: [
      {
        label: 'Name Match Percent',
        value: application.nameMatchPercent === null ? '—' : `${application.nameMatchPercent}%`,
      },
      { label: 'PAN Status', value: application.panStatus },
      { label: 'Aadhaar Status', value: application.aadhaarStatus },
      { label: 'GST Status', value: application.gstStatus },
    ],
    remark: result === KycResult.Exception ? application.kycExceptionRemark.trim() : '',
  };
}

export interface LevelOneDecision {
  decision: string;
  by: string;
  at: string;
  comment: string;
}

/**
 * What the Credit approver sees as a read-only "Level 1 decision" row: the Branch Manager's decision
 * and comment. Only for the Credit approver, and only once Level 1 has approved.
 */
export function levelOneDecision(
  instance: WorkflowInstance,
  user: DemoUser,
): LevelOneDecision | null {
  if (user.role !== 'creditApprover') return null;
  const node = instance.nodes.find((n) => n.index === 2);
  if (!node || node.status !== WorkflowNodeStatus.Approved) return null;
  return {
    decision: node.status,
    by: node.actedBy,
    at: formatListDateTime(node.actedAt),
    comment: node.comment,
  };
}
