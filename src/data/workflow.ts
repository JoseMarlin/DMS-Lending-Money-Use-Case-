/**
 * The workflow "Home Loan Approval" (PROJECT_OVERVIEW.md sections 4, 9, 10 and 11) as plain
 * functions. Nothing here knows about React or the store: each function takes the data, and gives
 * back the new data (or the reason it refused). The store calls them, and the tests call them.
 *
 * The four nodes of every instance:
 *   1 Initiator                  Done when the loan officer submits
 *   2 Level 1: Branch Manager    Approve, Return or Reject
 *   3 Level 2: Credit Approver   Approve (with the sanctioned amount and date), Return or Reject
 *   4 Record creation and filing Runs by itself after the Level 2 approval
 *
 * Rules enforced here, whatever the screen does:
 *   - only the person the node is assigned to (by role) can act, and only while it is their turn
 *   - the loan officer who submitted can never act on their own instance
 *   - the Level 1 and the Level 2 approver must be different people
 *   - Reject and Return need a comment
 *   - the sanctioned amount cannot be more than the Eligible Amount
 *   - a rejection creates no master record and files nothing; a final approval creates the record
 *     and records where each file belongs (filing data), without moving any file
 */
import { maskAadhaarInText } from './aadhaar';
import { sanitizeApplication } from './application';
import { FOLDER_ROOT, GROUP_FOLDER, subfolderOf } from './filePaths';
import { can } from './roles';
import {
  ApplicationStatus,
  WorkflowInstanceStatus,
  WorkflowNodeStatus,
  type AppNotification,
  type ApprovalTask,
  type AuditEvent,
  type DemoUser,
  SUPPORTING_DOCUMENT,
  type DocType,
  type SupportingDocument,
  type HomeLoanApplication,
  type UserRole,
  type WorkflowInstance,
  type WorkflowNode,
} from './types';
import { DEMO_USERS } from './users';

export const WORKFLOW_NAME = 'Home Loan Approval' as const;

export const NODE_NAMES = {
  initiator: 'Initiator',
  level1: 'Level 1: Branch Manager',
  level2: 'Level 2: Credit Approver',
  filing: 'Record creation and filing',
} as const;

// where files are kept is worked out in filePaths.ts; these are the names the workflow always used
export { FOLDER_ROOT, GROUP_FOLDER };

/** Where the first instance numbers start, so that the ids look like WI-23445213. */
const FIRST_INSTANCE_NUMBER = 23445213;

// ---------------------------------------------------------------------------
// The data these functions work on, and what they answer
// ---------------------------------------------------------------------------

export interface WorkflowData {
  applications: HomeLoanApplication[];
  masterRecords: HomeLoanApplication[];
  workflowInstances: WorkflowInstance[];
  auditEvents: AuditEvent[];
  notifications: AppNotification[];
}

export type WorkflowErrorCode =
  | 'kyc-blocked'
  | 'not-allowed'
  | 'already-submitted'
  | 'not-found'
  | 'not-active'
  | 'not-pending'
  | 'own-instance'
  | 'wrong-role'
  | 'same-approver'
  | 'comment-required'
  | 'invalid-sanction-amount'
  | 'sanction-over-eligible'
  | 'invalid-sanction-date'
  | 'not-returned';

export type WorkflowOutcome =
  | {
      ok: true;
      data: WorkflowData;
      instance: WorkflowInstance;
      /** A sentence for the success message ("Approved and sent to Level 2") */
      message: string;
    }
  | { ok: false; code: WorkflowErrorCode; error: string };

const refuse = (code: WorkflowErrorCode, error: string): WorkflowOutcome => ({
  ok: false,
  code,
  error,
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const holderOf = (role: UserRole): DemoUser | undefined =>
  Object.values(DEMO_USERS).find((user) => user.role === role);

const userByName = (name: string): DemoUser | undefined =>
  Object.values(DEMO_USERS).find((user) => user.name === name);

/** Next id of a kind: the largest number in use plus one ('AE-00041' gives 'AE-00042'). */
function counter(existing: string[], prefix: string, width: number, first = 1) {
  let last = existing.reduce((max, id) => {
    const n = Number(id.startsWith(prefix) ? id.slice(prefix.length) : NaN);
    return Number.isFinite(n) && n > max ? n : max;
  }, first - 1);
  return () => `${prefix}${String(++last).padStart(width, '0')}`;
}

export function nextInstanceId(instances: WorkflowInstance[]): string {
  return counter(
    instances.map((i) => i.id),
    'WI-',
    8,
    FIRST_INSTANCE_NUMBER,
  )();
}

const isoOf = (date: Date) => date.toISOString();
/** 1 for the Level 1 node (index 2) and 2 for the Level 2 node (index 3). */
export const levelOfNode = (index: number): 1 | 2 => (index === 2 ? 1 : 2);

const later = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

/** The latest of the times the application itself records: created, consent given, a file uploaded. */
function lastRecordedAt(app: HomeLoanApplication): number {
  return Math.max(
    Date.parse(app.createdAt) || 0,
    Date.parse(app.consentTime) || 0,
    ...app.documents.map((doc) => Date.parse(doc.uploadedAt) || 0),
  );
}

/**
 * When the checks of a draft that was never submitted ran, for its trail: the day on the record at
 * 10:40, but never before the application was created, a file uploaded or the consent given (a
 * draft made this afternoon would otherwise show its checks before it existed).
 */
export function draftKycTime(app: HomeLoanApplication): string {
  const day = app.kycCheckedOn || app.createdAt.slice(0, 10);
  const wanted = Date.parse(`${day}T10:40:00+05:30`) || 0;
  return new Date(Math.max(wanted, lastRecordedAt(app) + 30_000)).toISOString();
}

/**
 * When the KYC checks ran, for the trail: about 90 seconds before the submission, but never before
 * the application was created, a file uploaded or the consent given (a form filled in less than
 * 90 seconds would otherwise show the checks first), and never after the submission itself.
 */
function kycTimeFor(app: HomeLoanApplication, submittedAt: Date): Date {
  const recorded = lastRecordedAt(app);
  const wanted = later(submittedAt, -90).getTime();
  return new Date(Math.min(Math.max(wanted, recorded), submittedAt.getTime()));
}

type EventInput = Pick<AuditEvent, 'applicationId' | 'event' | 'user' | 'at'> &
  Partial<Pick<AuditEvent, 'comment' | 'field' | 'oldValue' | 'newValue' | 'reference'>>;

/** Gives each event its id and fills what was not given. */
export function withEventIds(existing: AuditEvent[], events: EventInput[]): AuditEvent[] {
  const next = counter(
    existing.map((e) => e.id),
    'AE-',
    5,
  );
  // whoever writes an event, a full Aadhaar number typed into a text of it is masked on the way in
  return events.map((e) => {
    const event = {
      id: next(),
      comment: '',
      field: '',
      oldValue: '',
      newValue: '',
      reference: '',
      ...e,
    };
    return {
      ...event,
      comment: maskAadhaarInText(event.comment),
      oldValue: maskAadhaarInText(event.oldValue),
      newValue: maskAadhaarInText(event.newValue),
    };
  });
}

function notification(
  data: WorkflowData,
  to: string,
  applicationId: string,
  instanceId: string,
  message: string,
  at: string,
): AppNotification[] {
  const person = userByName(to);
  if (!person) return []; // someone who is not one of the demo users cannot be shown a message
  const next = counter(
    data.notifications.map((n) => n.id),
    'NT-',
    5,
  );
  return [{ id: next(), userId: person.id, applicationId, instanceId, message, at, read: false }];
}

const replaceInstance = (list: WorkflowInstance[], next: WorkflowInstance) =>
  list.map((i) => (i.id === next.id ? next : i));

const upsertApplication = (list: HomeLoanApplication[], next: HomeLoanApplication) =>
  list.some((a) => a.applicationId === next.applicationId)
    ? list.map((a) => (a.applicationId === next.applicationId ? next : a))
    : [...list, next];

const applicationOf = (data: Pick<WorkflowData, 'applications' | 'masterRecords'>, id: string) =>
  data.applications.find((a) => a.applicationId === id) ??
  data.masterRecords.find((a) => a.applicationId === id);

// ---------------------------------------------------------------------------
// Filing (section 10)
// ---------------------------------------------------------------------------

/**
 * 'Loans/Home Loan/{Branch}/{Application ID} {Applicant name}': where an approved application's files
 * are filed. (The Files & Folders screen works out the place of a file from the status, in filePaths.ts;
 * this is what the filing data of a document records at the approval.)
 */
export function applicationFolder(app: HomeLoanApplication): string {
  const name = app.fullNameAsPerPan.trim();
  return `${FOLDER_ROOT}/${app.branch}/${app.applicationId}${name ? ` ${name}` : ''}`;
}

/** The folder of one document: the application folder and the sub-folder of its DocType group. */
export function folderPathFor(
  app: HomeLoanApplication,
  docType: DocType | SupportingDocument,
): string {
  return `${applicationFolder(app)}/${subfolderOf(docType)}`;
}

/** Puts the filing data (DocType tag, folder path) on each document. Moves nothing. */
export function fileDocuments(app: HomeLoanApplication, storedAt: string): HomeLoanApplication {
  return {
    ...app,
    documents: app.documents.map((doc) => ({
      ...doc,
      filing: {
        docTypeTag: doc.docType,
        folderPath: folderPathFor(app, doc.docType),
        storedAt,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// The events of a new application, before the workflow (section 11)
// ---------------------------------------------------------------------------

/** Mock reference IDs for the KYC checks. The Aadhaar one is stored on the application already. */
function kycReferences(app: HomeLoanApplication) {
  const tail = app.applicationId.replace(/\D/g, '').slice(-6) || '000000';
  return {
    pan: `MOCK-PAN-${tail}`,
    aadhaar: app.aadhaarReference || `MOCK-AAD-${tail}`,
    gst: `MOCK-GST-${tail}`,
  };
}

const DOCUMENT_EVENTS: readonly AuditEvent['event'][] = [
  'Document uploaded',
  'Document replaced',
  'Document removed',
];

/**
 * The events of `drawn` that the trail does not have yet. What is logged while the application is a
 * draft (an attachment added, a document uploaded, replaced or removed, the consent ticked in the
 * record sheet) is the truth from that moment, so the line that the form would draw for it is left
 * out: each thing is told once. A file that was replaced or removed in the sheet had been uploaded
 * before, and that is no longer on the application, so its first upload is drawn from the logged
 * event (the old file name), a minute after the application was created.
 */
export function withoutLoggedEvents(drawn: EventInput[], logged: AuditEvent[]): EventInput[] {
  const kept = drawn.filter((e) => {
    const mine = logged.filter((l) => l.applicationId === e.applicationId);
    switch (e.event) {
      case 'Attachment added':
        return !mine.some((l) => l.event === 'Attachment added' && l.newValue === e.newValue);
      case 'Document uploaded':
        return !mine.some((l) => DOCUMENT_EVENTS.includes(l.event) && l.field === e.field);
      case 'Consent given':
        return !mine.some((l) => l.event === 'Field changed' && l.field === 'Consent');
      default:
        return true;
    }
  });
  const created = drawn.find((e) => e.event === 'Application created');
  if (!created) return kept;
  const earlier: EventInput[] = [];
  const fields = new Set(
    logged
      .filter((l) => l.applicationId === created.applicationId && DOCUMENT_EVENTS.includes(l.event))
      .map((l) => l.field),
  );
  for (const field of fields) {
    const first = logged
      .filter(
        (l) =>
          l.applicationId === created.applicationId &&
          l.field === field &&
          DOCUMENT_EVENTS.includes(l.event),
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
    if (first.event === 'Document uploaded' || !first.oldValue) continue;
    const firstAt = Date.parse(first.at) || 0;
    const after = (Date.parse(created.at) || 0) + 60_000;
    earlier.push({
      applicationId: created.applicationId,
      event: 'Document uploaded',
      user: created.user,
      at: new Date(after < firstAt ? after : firstAt - 1000).toISOString(),
      field,
      newValue: first.oldValue,
    });
  }
  return [...kept, ...earlier];
}

/**
 * The trail of an application up to its submission: created, each document, the consent, each KYC
 * check and the KYC result. The form does not record these as they happen, so they are drawn from
 * what the application holds. `kycAt` is when the checks ran (the date alone is on the record).
 */
export function formAuditEvents(app: HomeLoanApplication, kycAt: string): EventInput[] {
  const officer = app.createdBy;
  const refs = kycReferences(app);
  const events: EventInput[] = [
    {
      applicationId: app.applicationId,
      event: 'Application created',
      user: officer,
      at: app.createdAt,
      newValue: app.applicationId,
    },
    ...app.documents.map((doc): EventInput =>
      doc.docType === SUPPORTING_DOCUMENT
        ? {
            applicationId: app.applicationId,
            event: 'Attachment added',
            user: doc.uploadedBy || officer,
            at: doc.uploadedAt || app.createdAt,
            comment: doc.note ?? '',
            field: SUPPORTING_DOCUMENT,
            newValue: doc.fileName,
          }
        : {
            applicationId: app.applicationId,
            event: 'Document uploaded',
            user: doc.uploadedBy || officer,
            at: doc.uploadedAt || app.createdAt,
            field: doc.docType,
            newValue: doc.fileName,
          },
    ),
  ];
  if (app.consentGiven && app.consentTime) {
    events.push({
      applicationId: app.applicationId,
      event: 'Consent given',
      user: officer,
      at: app.consentTime,
    });
  }
  if (app.kycOverallResult) {
    const check = (source: string, status: string, reference: string): EventInput => ({
      applicationId: app.applicationId,
      event: 'KYC check run',
      user: 'System',
      at: kycAt,
      field: source,
      newValue: status,
      reference,
    });
    events.push(
      check('PAN', app.panStatus, refs.pan),
      check('Aadhaar', app.aadhaarStatus, refs.aadhaar),
    );
    if (app.gstStatus !== 'Not applicable') events.push(check('GST', app.gstStatus, refs.gst));
    events.push({
      applicationId: app.applicationId,
      event: 'KYC result set',
      user: 'System',
      at: kycAt,
      field: 'KYC Overall Result',
      newValue: app.kycOverallResult,
      comment: app.kycExceptionRemark,
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Starting: the form is submitted
// ---------------------------------------------------------------------------

/** The four nodes of a new instance: the Initiator done, Level 1 waiting for its person, the rest not reached. */
export function createNodes(
  initiator: { name: string; role: UserRole },
  at: string,
): WorkflowNode[] {
  const level1 = holderOf('branchManager');
  const level2 = holderOf('creditApprover');
  return [
    {
      index: 1,
      name: NODE_NAMES.initiator,
      role: initiator.role,
      assignee: initiator.name,
      status: WorkflowNodeStatus.Done,
      actedBy: initiator.name,
      actedAt: at,
      comment: '',
    },
    {
      index: 2,
      name: NODE_NAMES.level1,
      role: 'branchManager',
      assignee: level1?.name ?? 'Branch Manager',
      status: WorkflowNodeStatus.Pending,
      actedBy: '',
      actedAt: '',
      comment: '',
    },
    {
      index: 3,
      name: NODE_NAMES.level2,
      role: 'creditApprover',
      assignee: level2?.name ?? 'Credit approver',
      status: WorkflowNodeStatus.Waiting,
      actedBy: '',
      actedAt: '',
      comment: '',
    },
    {
      index: 4,
      name: NODE_NAMES.filing,
      role: 'system',
      assignee: 'System',
      status: WorkflowNodeStatus.Waiting,
      actedBy: '',
      actedAt: '',
      comment: '',
    },
  ];
}

/**
 * Submit: the application goes into the workflow. The instance is created, the application becomes
 * "In Level 1", node 2 is assigned to the Branch Manager, and the trail gets the form's events and
 * "Submitted" and "Workflow started". Submitting is refused while the KYC result is Fail or missing,
 * or an Exception has no remark (section 7: "Resolve the KYC result before submitting").
 */
export function submitToWorkflow(
  data: WorkflowData,
  application: HomeLoanApplication,
  initiator: DemoUser,
  now: Date = new Date(),
): WorkflowOutcome {
  if (!can(initiator.role, 'createApplication')) {
    return refuse(
      'not-allowed',
      'Only a loan officer or the administrator can submit an application',
    );
  }
  const result = application.kycOverallResult;
  const exceptionWithoutRemark =
    result === 'Exception' && application.kycExceptionRemark.trim() === '';
  if (result === '' || result === 'Fail' || exceptionWithoutRemark) {
    return refuse('kyc-blocked', 'Resolve the KYC result before submitting');
  }
  if (data.workflowInstances.some((i) => i.applicationId === application.applicationId)) {
    return refuse(
      'already-submitted',
      `Application ${application.applicationId} was already submitted`,
    );
  }

  const at = isoOf(now);
  const saved = sanitizeApplication({
    ...application,
    status: ApplicationStatus.InLevel1,
    updatedAt: at,
  });
  const instance: WorkflowInstance = {
    id: nextInstanceId(data.workflowInstances),
    workflowName: WORKFLOW_NAME,
    applicationId: saved.applicationId,
    initiatedBy: initiator.name,
    initiatedAt: at,
    status: WorkflowInstanceStatus.InProgress,
    currentNodeIndex: 2,
    nodes: createNodes(initiator, at),
  };
  const events = withEventIds(data.auditEvents, [
    // the events that were written while the application was a draft (an attachment added in the sheet) are not written twice
    ...withoutLoggedEvents(formAuditEvents(saved, isoOf(kycTimeFor(saved, now))), data.auditEvents),
    {
      applicationId: saved.applicationId,
      event: 'Submitted',
      user: initiator.name,
      at,
      newValue: ApplicationStatus.InLevel1,
    },
    {
      applicationId: saved.applicationId,
      event: 'Workflow started',
      user: 'System',
      at: isoOf(later(now, 1)),
      reference: instance.id,
      newValue: WORKFLOW_NAME,
    },
  ]);

  return {
    ok: true,
    data: {
      ...data,
      applications: upsertApplication(data.applications, saved),
      workflowInstances: [...data.workflowInstances, instance],
      auditEvents: [...data.auditEvents, ...events],
    },
    instance,
    message: `Application ${saved.applicationId} submitted for approval`,
  };
}

// ---------------------------------------------------------------------------
// Acting: approve, reject, return
// ---------------------------------------------------------------------------

interface Turn {
  instance: WorkflowInstance;
  node: WorkflowNode;
  application: HomeLoanApplication;
  /** 1 for the Branch Manager's node, 2 for the Credit approver's */
  level: 1 | 2;
}

type Refusal = Extract<WorkflowOutcome, { ok: false }>;

/** Checks that this user may act on this instance now. Gives the turn, or the reason not. */
function turnOf(
  data: WorkflowData,
  instanceId: string,
  user: DemoUser,
): { ok: true; turn: Turn } | Refusal {
  const no = (code: WorkflowErrorCode, error: string): Refusal => ({ ok: false, code, error });

  const instance = data.workflowInstances.find((i) => i.id === instanceId);
  if (!instance) return no('not-found', `There is no workflow instance ${instanceId}`);
  if (instance.status !== WorkflowInstanceStatus.InProgress) {
    return no(
      'not-active',
      `${instance.id} is ${instance.status.toLowerCase()}: nothing is waiting`,
    );
  }
  const node = instance.nodes.find((n) => n.index === instance.currentNodeIndex);
  if (
    !node ||
    node.status !== WorkflowNodeStatus.Pending ||
    (node.index !== 2 && node.index !== 3)
  ) {
    return no('not-pending', `${instance.id} is not waiting for anyone to act`);
  }
  const application = applicationOf(data, instance.applicationId);
  if (!application) return no('not-found', `There is no application ${instance.applicationId}`);

  // the person who submitted can never decide on their own application
  if (user.name === instance.initiatedBy || user.name === application.createdBy) {
    return no('own-instance', 'You cannot act on an application you submitted');
  }
  if (node.role !== user.role) {
    return no('wrong-role', `This step is for the ${node.name.replace(/^Level \d: /, '')}`);
  }
  const level = levelOfNode(node.index);
  if (level === 2) {
    const levelOne = instance.nodes.find((n) => n.index === 2);
    if (levelOne && levelOne.actedBy === user.name) {
      return no(
        'same-approver',
        'The Level 2 approver must be a different person from the Level 1 approver',
      );
    }
  }
  return { ok: true, turn: { instance, node, application, level } };
}

/**
 * Why this user cannot act on the instance now, or null when it is their turn. The review screen
 * uses it to switch Take Action off and say why; it is the same check that approve, reject and
 * return make, so the button and the store never disagree.
 */
export function actionBlock(
  data: WorkflowData,
  instanceId: string,
  user: DemoUser,
): { code: WorkflowErrorCode; error: string } | null {
  const checked = turnOf(data, instanceId, user);
  return checked.ok ? null : { code: checked.code, error: checked.error };
}

/** The application with the level's decision written on it (section 6.8). */
function withDecision(
  app: HomeLoanApplication,
  level: 1 | 2,
  decision: 'Approved' | 'Returned' | 'Rejected',
  user: DemoUser,
  comment: string,
  at: string,
): HomeLoanApplication {
  return level === 1
    ? {
        ...app,
        level1Approver: user.name,
        level1Decision: decision,
        level1Remarks: comment,
        level1Time: at,
      }
    : {
        ...app,
        level2Approver: user.name,
        level2Decision: decision,
        level2Remarks: comment,
        level2Time: at,
      };
}

const setNode = (nodes: WorkflowNode[], index: number, patch: Partial<WorkflowNode>) =>
  nodes.map((n) => (n.index === index ? { ...n, ...patch } : n));

export interface ApproveExtra {
  /** Level 2 only: required, at most the Eligible Amount */
  sanctionedAmount?: number;
  /** Level 2 only: required, an ISO date */
  sanctionDate?: string;
}

const MONEY = (n: number) => n.toLocaleString('en-IN');

/**
 * Approve. At Level 1 the application moves to Level 2. At Level 2 the node 4 step runs by itself:
 * the master record is created (status Approved), each file gets its DocType tag and folder path,
 * and the instance is Completed.
 */
export function approve(
  data: WorkflowData,
  instanceId: string,
  user: DemoUser,
  comment: string,
  extra: ApproveExtra = {},
  now: Date = new Date(),
): WorkflowOutcome {
  const checked = turnOf(data, instanceId, user);
  if (!checked.ok) return checked;
  const { instance, application, level } = checked.turn;
  // a typed Aadhaar number must not reach the Progress panel or the trail in full
  const text = maskAadhaarInText(comment.trim());
  const at = isoOf(now);

  if (level === 1) {
    const nodes = setNode(
      setNode(instance.nodes, 2, {
        status: WorkflowNodeStatus.Approved,
        actedBy: user.name,
        actedAt: at,
        comment: text,
      }),
      3,
      { status: WorkflowNodeStatus.Pending },
    );
    const next: WorkflowInstance = { ...instance, currentNodeIndex: 3, nodes };
    const app = sanitizeApplication({
      ...withDecision(application, 1, 'Approved', user, text, at),
      status: ApplicationStatus.InLevel2,
      updatedAt: at,
    });
    const events = withEventIds(data.auditEvents, [
      {
        applicationId: app.applicationId,
        event: 'Level 1 decision',
        user: user.name,
        at,
        comment: text,
        field: 'Level 1 Decision',
        newValue: 'Approved',
      },
    ]);
    return {
      ok: true,
      data: {
        ...data,
        applications: upsertApplication(data.applications, app),
        workflowInstances: replaceInstance(data.workflowInstances, next),
        auditEvents: [...data.auditEvents, ...events],
      },
      instance: next,
      message: 'Approved and sent to Level 2',
    };
  }

  // Level 2: the sanction
  const amount = extra.sanctionedAmount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return refuse('invalid-sanction-amount', 'Enter the sanctioned amount');
  }
  const eligible = application.eligibleAmount;
  if (eligible === null || amount > eligible) {
    return refuse(
      'sanction-over-eligible',
      eligible === null
        ? 'There is no Eligible Amount to sanction against'
        : `The sanctioned amount cannot be more than the Eligible Amount, ${MONEY(eligible)}`,
    );
  }
  const date = extra.sanctionDate ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return refuse('invalid-sanction-date', 'Enter the sanction date');
  }

  const systemAt = isoOf(later(now, 1));
  const nodes = setNode(
    setNode(instance.nodes, 3, {
      status: WorkflowNodeStatus.Approved,
      actedBy: user.name,
      actedAt: at,
      comment: text,
    }),
    4,
    { status: WorkflowNodeStatus.Done, actedBy: 'System', actedAt: systemAt },
  );
  const next: WorkflowInstance = {
    ...instance,
    status: WorkflowInstanceStatus.Completed,
    currentNodeIndex: 4,
    nodes,
  };
  // node 4: the record is created and the files are given their tag and folder
  const decided: HomeLoanApplication = {
    ...withDecision(application, 2, 'Approved', user, text, at),
    sanctionedAmount: amount,
    sanctionDate: date,
    status: ApplicationStatus.Approved,
    updatedAt: systemAt,
  };
  const filed = sanitizeApplication(fileDocuments(decided, systemAt));
  const events = withEventIds(data.auditEvents, [
    {
      applicationId: filed.applicationId,
      event: 'Level 2 decision',
      user: user.name,
      at,
      comment: text,
      field: 'Level 2 Decision',
      newValue: 'Approved',
    },
    {
      applicationId: filed.applicationId,
      event: 'Level 2 decision',
      user: user.name,
      at,
      comment: '',
      field: 'Sanctioned Amount',
      oldValue:
        application.loanAmountRequested === null ? '' : String(application.loanAmountRequested),
      newValue: String(amount),
    },
    {
      applicationId: filed.applicationId,
      event: 'Record created',
      user: 'System',
      at: systemAt,
      field: 'Status',
      newValue: ApplicationStatus.Approved,
      reference: filed.applicationId,
    },
    {
      applicationId: filed.applicationId,
      event: 'Files stored',
      user: 'System',
      at: systemAt,
      field: `${filed.documents.length} ${filed.documents.length === 1 ? 'file' : 'files'}`,
      newValue: applicationFolder(filed),
    },
  ]);
  const withNotes = {
    ...data,
    notifications: [
      ...data.notifications,
      ...notification(
        data,
        instance.initiatedBy,
        filed.applicationId,
        instance.id,
        `Application ${filed.applicationId} was approved and its record was created.`,
        systemAt,
      ),
    ],
  };
  return {
    ok: true,
    data: {
      ...withNotes,
      applications: upsertApplication(data.applications, filed),
      masterRecords: upsertApplication(data.masterRecords, filed),
      workflowInstances: replaceInstance(data.workflowInstances, next),
      auditEvents: [...data.auditEvents, ...events],
    },
    instance: next,
    message: 'Application approved and record created',
  };
}

/** The comment of a Reject or a Return: required. */
const needComment = (text: string, what: string): WorkflowOutcome | null =>
  text.trim() === '' ? refuse('comment-required', `Enter a comment to ${what}`) : null;

function stop(
  data: WorkflowData,
  instanceId: string,
  user: DemoUser,
  comment: string,
  now: Date,
  kind: 'Rejected' | 'Returned',
): WorkflowOutcome {
  const checked = turnOf(data, instanceId, user);
  if (!checked.ok) return checked; // who may act is checked first, so a wrong person is told so
  const missing = needComment(comment, kind === 'Rejected' ? 'reject' : 'return the application');
  if (missing) return missing;
  const { instance, node, application, level } = checked.turn;
  // a typed Aadhaar number must not reach the Progress panel or the trail in full
  const text = maskAadhaarInText(comment.trim());
  const at = isoOf(now);

  const nodes = setNode(instance.nodes, node.index, {
    status: kind === 'Rejected' ? WorkflowNodeStatus.Rejected : WorkflowNodeStatus.Returned,
    actedBy: user.name,
    actedAt: at,
    comment: text,
  });
  const next: WorkflowInstance = {
    ...instance,
    status: kind === 'Rejected' ? WorkflowInstanceStatus.Rejected : WorkflowInstanceStatus.Returned,
    nodes,
  };
  const app = sanitizeApplication({
    ...withDecision(application, level, kind, user, text, at),
    status: kind === 'Rejected' ? ApplicationStatus.Rejected : ApplicationStatus.Returned,
    updatedAt: at,
  });
  const events = withEventIds(data.auditEvents, [
    {
      applicationId: app.applicationId,
      event: level === 1 ? 'Level 1 decision' : 'Level 2 decision',
      user: user.name,
      at,
      comment: text,
      field: level === 1 ? 'Level 1 Decision' : 'Level 2 Decision',
      newValue: kind,
    },
    {
      applicationId: app.applicationId,
      event: kind === 'Rejected' ? 'Rejected' : 'Returned',
      user: user.name,
      at,
      comment: text,
      field: 'Status',
      oldValue: application.status,
      newValue: app.status,
    },
  ]);
  const verb = kind === 'Rejected' ? 'rejected' : 'returned for correction';
  return {
    ok: true,
    data: {
      ...data,
      applications: upsertApplication(data.applications, app),
      workflowInstances: replaceInstance(data.workflowInstances, next),
      auditEvents: [...data.auditEvents, ...events],
      notifications: [
        ...data.notifications,
        ...notification(
          data,
          instance.initiatedBy,
          app.applicationId,
          instance.id,
          `Application ${app.applicationId} was ${verb}. Reason: ${text}`,
          at,
        ),
      ],
    },
    instance: next,
    message: kind === 'Rejected' ? 'Application rejected' : 'Returned to loan officer',
  };
}

/** Reject: a comment is required. The application is Rejected; no record is made and no file is filed. */
export function reject(
  data: WorkflowData,
  instanceId: string,
  user: DemoUser,
  comment: string,
  now: Date = new Date(),
): WorkflowOutcome {
  return stop(data, instanceId, user, comment, now, 'Rejected');
}

/** Return: a comment is required. The application goes back to the loan officer as Returned. */
export function returnForCorrection(
  data: WorkflowData,
  instanceId: string,
  user: DemoUser,
  comment: string,
  now: Date = new Date(),
): WorkflowOutcome {
  return stop(data, instanceId, user, comment, now, 'Returned');
}

// ---------------------------------------------------------------------------
// Resubmit: the loan officer sends a returned application back
// ---------------------------------------------------------------------------

/**
 * Resubmit. A returned application (after its loan officer has corrected it) goes back into the
 * SAME instance, at Level 1: the instance is In Progress again, the Branch Manager has the task, the
 * decisions of the earlier round are cleared from the application (the trail keeps them), and the
 * trail gets "Resubmitted". Only the loan officer who submitted it, or the administrator, can do it,
 * and the KYC result must still allow a submission (as when it was first submitted).
 */
export function resubmit(
  data: WorkflowData,
  instanceId: string,
  user: DemoUser,
  now: Date = new Date(),
): WorkflowOutcome {
  const instance = data.workflowInstances.find((i) => i.id === instanceId);
  if (!instance) return refuse('not-found', `There is no workflow instance ${instanceId}`);
  const application = applicationOf(data, instance.applicationId);
  if (!application) return refuse('not-found', `There is no application ${instance.applicationId}`);
  if (
    instance.status !== WorkflowInstanceStatus.Returned ||
    application.status !== ApplicationStatus.Returned
  ) {
    return refuse('not-returned', 'Only a returned application can be resubmitted');
  }
  const owner = can(user.role, 'resubmitApplication') && user.name === instance.initiatedBy;
  if (!owner && user.role !== 'admin') {
    return refuse(
      'not-allowed',
      'Only the loan officer who submitted it, or the administrator, can resubmit it',
    );
  }
  const result = application.kycOverallResult;
  if (
    result === '' ||
    result === 'Fail' ||
    (result === 'Exception' && application.kycExceptionRemark.trim() === '')
  ) {
    return refuse('kyc-blocked', 'Resolve the KYC result before resubmitting');
  }

  const at = isoOf(now);
  const cleared = { status: WorkflowNodeStatus.Waiting, actedBy: '', actedAt: '', comment: '' };
  const nodes = setNode(
    setNode(
      setNode(
        setNode(instance.nodes, 1, {
          status: WorkflowNodeStatus.Done,
          actedBy: user.name,
          actedAt: at,
          comment: 'Resubmitted after correction',
        }),
        2,
        { ...cleared, status: WorkflowNodeStatus.Pending },
      ),
      3,
      cleared,
    ),
    4,
    cleared,
  );
  const next: WorkflowInstance = {
    ...instance,
    status: WorkflowInstanceStatus.InProgress,
    currentNodeIndex: 2,
    nodes,
  };
  const app = sanitizeApplication<HomeLoanApplication>({
    ...application,
    status: ApplicationStatus.InLevel1,
    // a new round: the decisions of the one before are in the trail
    level1Approver: '',
    level1Decision: '' as const,
    level1Remarks: '',
    level1Time: '',
    level2Approver: '',
    level2Decision: '' as const,
    level2Remarks: '',
    level2Time: '',
    sanctionedAmount: null,
    sanctionDate: '',
    updatedAt: at,
  });
  const events = withEventIds(data.auditEvents, [
    {
      applicationId: app.applicationId,
      event: 'Resubmitted',
      user: user.name,
      at,
      field: 'Status',
      oldValue: application.status,
      newValue: ApplicationStatus.InLevel1,
      reference: instance.id,
    },
  ]);
  return {
    ok: true,
    data: {
      ...data,
      applications: upsertApplication(data.applications, app),
      workflowInstances: replaceInstance(data.workflowInstances, next),
      auditEvents: [...data.auditEvents, ...events],
    },
    instance: next,
    message: `Application ${app.applicationId} resubmitted for approval`,
  };
}

// ---------------------------------------------------------------------------
// Looking things up
// ---------------------------------------------------------------------------

type Readable = Pick<
  WorkflowData,
  'applications' | 'masterRecords' | 'workflowInstances' | 'notifications'
>;

const byTime = (a: string, b: string) => Date.parse(a) - Date.parse(b);

/** The approval tasks waiting for this user (the instances where it is their turn), oldest first. */
export function pendingTasksFor(state: Readable, user: DemoUser): ApprovalTask[] {
  return state.workflowInstances
    .flatMap((instance): ApprovalTask[] => {
      if (instance.status !== WorkflowInstanceStatus.InProgress) return [];
      const node = instance.nodes.find((n) => n.index === instance.currentNodeIndex);
      if (!node || node.status !== WorkflowNodeStatus.Pending) return [];
      if (node.role !== user.role || user.name === instance.initiatedBy) return [];
      // the same rule as turnOf: whoever created the application never decides on it
      if (user.name === applicationOf(state, instance.applicationId)?.createdBy) return [];
      const before = instance.nodes.find((n) => n.index === node.index - 1);
      return [
        {
          id: instance.id,
          applicationId: instance.applicationId,
          applicantName: applicationOf(state, instance.applicationId)?.fullNameAsPerPan ?? '',
          level: levelOfNode(node.index),
          assignedTo: user.id,
          receivedAt: before?.actedAt || instance.initiatedAt,
        },
      ];
    })
    .sort((a, b) => byTime(a.receivedAt, b.receivedAt));
}

/** The instances this user has acted on (decided, or submitted), the latest action first. */
export function completedFor(
  state: Pick<Readable, 'workflowInstances'>,
  user: DemoUser,
): WorkflowInstance[] {
  const lastAction = (i: WorkflowInstance) =>
    Math.max(
      ...i.nodes.filter((n) => n.actedBy === user.name).map((n) => Date.parse(n.actedAt) || 0),
    );
  return state.workflowInstances
    .filter((i) => i.nodes.some((n) => n.actedBy === user.name))
    .sort((a, b) => lastAction(b) - lastAction(a));
}

/** Every instance, the newest submission first. */
export function allInstances(state: Pick<Readable, 'workflowInstances'>): WorkflowInstance[] {
  return [...state.workflowInstances].sort((a, b) => byTime(b.initiatedAt, a.initiatedAt));
}

/**
 * The instances this user may see in "All Workflows": the administrator sees every one, everybody
 * else the ones they are part of (they submitted it, or a node is assigned to them or was acted on
 * by them).
 */
export function instancesFor(
  state: Pick<Readable, 'workflowInstances'>,
  user: DemoUser,
): WorkflowInstance[] {
  const all = allInstances(state);
  if (user.role === 'admin') return all;
  return all.filter(
    (i) =>
      i.initiatedBy === user.name ||
      i.nodes.some((n) => n.assignee === user.name || n.actedBy === user.name),
  );
}

/** The instance of an application (an application has one). */
export function instanceByApplication(
  state: Pick<Readable, 'workflowInstances'>,
  applicationId: string,
): WorkflowInstance | undefined {
  return state.workflowInstances.find((i) => i.applicationId === applicationId);
}

/** What the bell counts: the tasks waiting for the user and the messages they have not read. */
export function unreadCount(state: Readable, user: DemoUser): number {
  return (
    pendingTasksFor(state, user).length +
    state.notifications.filter((n) => n.userId === user.id && !n.read).length
  );
}

/** Marks the user's messages as read (the bell was opened). Gives the same list if none was unread. */
export function markNotificationsRead(
  notifications: AppNotification[],
  userId: DemoUser['id'],
): AppNotification[] {
  if (!notifications.some((n) => n.userId === userId && !n.read)) return notifications;
  return notifications.map((n) => (n.userId === userId && !n.read ? { ...n, read: true } : n));
}
