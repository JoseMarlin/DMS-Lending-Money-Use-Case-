/**
 * The workflow data of the seed applications. Each of the seven existing applications (the draft has no
 * workflow yet, only its notes) gets the instance and the audit trail that its status says it must have: an application "In Level 2" has
 * a Level 1 approval behind it and a task waiting for the Credit approver, a "Returned" one has the
 * Level 1 return and its comment, and so on. So the lists, the bell and the workflow screens are
 * populated from the first minute, and agree with the master list.
 *
 * Dates come from the application itself (its Level 1 and Level 2 times).
 */
import { SEED_COMMENTS } from './seedComments';
import {
  ApplicationStatus,
  WorkflowInstanceStatus,
  WorkflowNodeStatus,
  type AuditEvent,
  type HomeLoanApplication,
  type RecordComment,
  type UserRole,
  type WorkflowInstance,
} from './types';
import { DEMO_USERS } from './users';
import {
  WORKFLOW_NAME,
  applicationFolder,
  createNodes,
  formAuditEvents,
  nextInstanceId,
  withEventIds,
  type WorkflowData,
} from './workflow';

type SeedWorkflow = Pick<WorkflowData, 'workflowInstances' | 'auditEvents' | 'notifications'>;

/** The role of the person who made an application: a demo user's own role, else a loan officer. */
function roleOf(name: string): UserRole {
  return Object.values(DEMO_USERS).find((user) => user.name === name)?.role ?? 'loanOfficer';
}

const plusSecond = (iso: string) => new Date(Date.parse(iso) + 1000).toISOString();

function seedInstance(app: HomeLoanApplication, id: string): WorkflowInstance {
  const initiatedAt = `${app.applicationDate}T10:45:00+05:30`;
  let instance: WorkflowInstance = {
    id,
    workflowName: WORKFLOW_NAME,
    applicationId: app.applicationId,
    initiatedBy: app.createdBy,
    initiatedAt,
    status: WorkflowInstanceStatus.InProgress,
    currentNodeIndex: 2,
    nodes: createNodes({ name: app.createdBy, role: roleOf(app.createdBy) }, initiatedAt),
  };
  const patch = (index: number, change: Partial<WorkflowInstance['nodes'][number]>) => {
    instance = {
      ...instance,
      nodes: instance.nodes.map((n) => (n.index === index ? { ...n, ...change } : n)),
    };
  };

  const decided = (level: 1 | 2) => ({
    status:
      (level === 1 ? app.level1Decision : app.level2Decision) === 'Approved'
        ? WorkflowNodeStatus.Approved
        : (level === 1 ? app.level1Decision : app.level2Decision) === 'Returned'
          ? WorkflowNodeStatus.Returned
          : WorkflowNodeStatus.Rejected,
    actedBy: level === 1 ? app.level1Approver : app.level2Approver,
    actedAt: level === 1 ? app.level1Time : app.level2Time,
    comment: level === 1 ? app.level1Remarks : app.level2Remarks,
  });

  if (app.level1Decision) {
    patch(2, decided(1));
    if (app.level1Decision === 'Approved') {
      instance = { ...instance, currentNodeIndex: 3 };
      patch(3, { status: WorkflowNodeStatus.Pending });
    } else {
      instance = {
        ...instance,
        status:
          app.level1Decision === 'Returned'
            ? WorkflowInstanceStatus.Returned
            : WorkflowInstanceStatus.Rejected,
      };
    }
  }
  if (app.level2Decision) {
    patch(3, decided(2));
    if (app.level2Decision === 'Approved') {
      instance = { ...instance, status: WorkflowInstanceStatus.Completed, currentNodeIndex: 4 };
      patch(4, {
        status: WorkflowNodeStatus.Done,
        actedBy: 'System',
        actedAt: plusSecond(app.level2Time),
      });
    } else {
      instance = {
        ...instance,
        status:
          app.level2Decision === 'Returned'
            ? WorkflowInstanceStatus.Returned
            : WorkflowInstanceStatus.Rejected,
      };
    }
  }
  return instance;
}

function seedEvents(app: HomeLoanApplication, instance: WorkflowInstance) {
  const kycAt = `${app.kycCheckedOn || app.applicationDate}T10:40:00+05:30`;
  const events: Parameters<typeof withEventIds>[1] = [
    ...formAuditEvents(app, kycAt),
    {
      applicationId: app.applicationId,
      event: 'Submitted',
      user: app.createdBy,
      at: instance.initiatedAt,
      newValue: ApplicationStatus.InLevel1,
    },
    {
      applicationId: app.applicationId,
      event: 'Workflow started',
      user: 'System',
      at: plusSecond(instance.initiatedAt),
      reference: instance.id,
      newValue: WORKFLOW_NAME,
    },
  ];
  const decision = (level: 1 | 2) => {
    const node = instance.nodes.find((n) => n.index === level + 1);
    if (!node || !node.actedBy) return;
    const value = level === 1 ? app.level1Decision : app.level2Decision;
    events.push({
      applicationId: app.applicationId,
      event: level === 1 ? 'Level 1 decision' : 'Level 2 decision',
      user: node.actedBy,
      at: node.actedAt,
      comment: node.comment,
      field: level === 1 ? 'Level 1 Decision' : 'Level 2 Decision',
      newValue: value,
    });
    if (value === 'Returned' || value === 'Rejected') {
      events.push({
        applicationId: app.applicationId,
        event: value,
        user: node.actedBy,
        at: node.actedAt,
        comment: node.comment,
        field: 'Status',
        newValue: value,
      });
    }
  };
  decision(1);
  decision(2);
  if (instance.status === WorkflowInstanceStatus.Completed) {
    const filed = plusSecond(app.level2Time);
    // the old, approved applications are filed in the folders; their master list entry is not made
    // (the "All Records" tab only holds records made by an approval in this demo)
    events.push({
      applicationId: app.applicationId,
      event: 'Record created',
      user: 'System',
      at: filed,
      field: 'Status',
      newValue: ApplicationStatus.Approved,
      reference: app.applicationId,
    });
    events.push({
      applicationId: app.applicationId,
      event: 'Files stored',
      user: 'System',
      at: filed,
      field: `${app.documents.length} files`,
      newValue: applicationFolder(app),
    });
  }
  return events;
}

/** The instances and the audit trail for these applications, in the order given. */
export function buildSeedWorkflow(
  applications: HomeLoanApplication[],
  comments: RecordComment[] = SEED_COMMENTS,
): SeedWorkflow {
  const instances: WorkflowInstance[] = [];
  let events: AuditEvent[] = [];
  for (const app of applications) {
    // a draft has not been submitted: no instance, and its trail is drawn from the application
    if (app.status === ApplicationStatus.Draft || app.status === ApplicationStatus.KycDone)
      continue;
    const instance = seedInstance(app, nextInstanceId(instances));
    instances.push(instance);
    events = [...events, ...withEventIds(events, seedEvents(app, instance))];
  }
  // the notes written on the applications are in the trail too
  const written = comments.map((c) => ({
    applicationId: c.applicationId,
    event: 'Comment added' as const,
    user: c.author,
    at: c.at,
    comment: c.text,
  }));
  events = [...events, ...withEventIds(events, written)];
  return { workflowInstances: instances, auditEvents: events, notifications: [] };
}

/**
 * Gives the workflow data an instance and a trail for each application that has been submitted but
 * has none. A saved copy made before the workflow existed has applications like that (they were
 * "Submitted" with nothing behind them); this makes them behave like the others. Applications that
 * are still drafts are left alone, and nothing that exists is changed.
 */
export function addMissingWorkflow(
  applications: HomeLoanApplication[],
  existing: SeedWorkflow,
): SeedWorkflow {
  const instances = [...existing.workflowInstances];
  let events = [...existing.auditEvents];
  for (const app of applications) {
    const submitted =
      app.status !== ApplicationStatus.Draft && app.status !== ApplicationStatus.KycDone;
    if (!submitted || instances.some((i) => i.applicationId === app.applicationId)) continue;
    const instance = seedInstance(app, nextInstanceId(instances));
    instances.push(instance);
    events = [...events, ...withEventIds(events, seedEvents(app, instance))];
  }
  return {
    workflowInstances: instances,
    auditEvents: events,
    notifications: existing.notifications,
  };
}
