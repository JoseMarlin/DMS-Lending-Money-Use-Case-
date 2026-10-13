/**
 * Checks on data read back from localStorage. A saved copy can be old, edited by hand or damaged;
 * each of these says whether one saved item has every field of the right kind, so a bad item is
 * dropped instead of breaking a screen. (Applications are checked in the store, which also masks
 * the Aadhaar.)
 */
import {
  WorkflowInstanceStatus,
  WorkflowNodeStatus,
  type AppNotification,
  type AuditEvent,
  type AuditEventName,
  type RecordComment,
  type WorkflowInstance,
  type WorkflowNode,
} from './types';
import { DEMO_USERS } from './users';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

/** True for text that is a date and time (or just a date). */
const isMoment = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

const NODE_STATUSES: string[] = Object.values(WorkflowNodeStatus);
const INSTANCE_STATUSES: string[] = Object.values(WorkflowInstanceStatus);
const ROLES = ['loanOfficer', 'branchManager', 'creditApprover', 'admin', 'system'];

const EVENT_NAMES: AuditEventName[] = [
  'Application created',
  'Field changed',
  'Document uploaded',
  'Consent given',
  'KYC check run',
  'KYC result set',
  'Submitted',
  'Workflow started',
  'Level 1 decision',
  'Returned',
  'Resubmitted',
  'Level 2 decision',
  'Record created',
  'Files stored',
  'Rejected',
  'Comment added',
  'Document replaced',
  'Document removed',
  'Attachment added',
  'Attachment removed',
];

function isNode(value: unknown): value is WorkflowNode {
  return (
    isRecord(value) &&
    Number.isInteger(value.index) &&
    isText(value.name) &&
    isText(value.role) &&
    ROLES.includes(value.role) &&
    isText(value.assignee) &&
    isText(value.status) &&
    NODE_STATUSES.includes(value.status) &&
    isText(value.actedBy) &&
    isText(value.actedAt) &&
    isText(value.comment)
  );
}

export function isWorkflowInstance(value: unknown): value is WorkflowInstance {
  if (!isRecord(value)) return false;
  const nodes = value.nodes;
  return (
    isText(value.id) &&
    /^WI-\d+$/.test(value.id) &&
    value.workflowName === 'Home Loan Approval' &&
    isText(value.applicationId) &&
    isText(value.initiatedBy) &&
    isMoment(value.initiatedAt) &&
    isText(value.status) &&
    INSTANCE_STATUSES.includes(value.status) &&
    Number.isInteger(value.currentNodeIndex) &&
    Array.isArray(nodes) &&
    nodes.length === 4 &&
    nodes.every(isNode) &&
    nodes.every((node, i) => (node as WorkflowNode).index === i + 1) &&
    (value.currentNodeIndex as number) >= 1 &&
    (value.currentNodeIndex as number) <= 4
  );
}

export function isAuditEvent(value: unknown): value is AuditEvent {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.applicationId) &&
    isText(value.event) &&
    (EVENT_NAMES as string[]).includes(value.event) &&
    isText(value.user) &&
    isMoment(value.at) &&
    isText(value.comment) &&
    isText(value.field) &&
    isText(value.oldValue) &&
    isText(value.newValue) &&
    isText(value.reference)
  );
}

export function isRecordComment(value: unknown): value is RecordComment {
  return (
    isRecord(value) &&
    isText(value.id) &&
    /^CM-\d+$/.test(value.id) &&
    isText(value.applicationId) &&
    isText(value.author) &&
    isText(value.authorRole) &&
    isText(value.text) &&
    isMoment(value.at)
  );
}

export function isNotification(value: unknown): value is AppNotification {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.userId) &&
    Object.hasOwn(DEMO_USERS, value.userId) &&
    isText(value.applicationId) &&
    isText(value.instanceId) &&
    isText(value.message) &&
    isMoment(value.at) &&
    typeof value.read === 'boolean'
  );
}

/** Keeps the first item of each id, so a repeated id (a damaged copy) is dropped. */
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return items.filter((item, index) => items.findIndex((other) => other.id === item.id) === index);
}
