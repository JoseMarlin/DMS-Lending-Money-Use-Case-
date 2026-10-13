import { useAppStore } from './store';
import { ApplicationStatus, WorkflowInstanceStatus, WorkflowNodeStatus } from './types';
import { DEMO_USERS } from './users';
import { pendingTasksFor, resubmit, type WorkflowData } from './workflow';

const data = (): WorkflowData => {
  const s = useAppStore.getState();
  return {
    applications: s.applications,
    masterRecords: s.masterRecords,
    workflowInstances: s.workflowInstances,
    auditEvents: s.auditEvents,
    notifications: s.notifications,
  };
};

const SAVITA = 'HL-2026-0004'; // Returned by Mahesh, submitted by Priya
const instanceOf = (d: WorkflowData, applicationId: string) =>
  d.workflowInstances.find((i) => i.applicationId === applicationId)!;
const app = (d: WorkflowData, id: string) => d.applications.find((a) => a.applicationId === id)!;

beforeEach(() => {
  localStorage.clear();
  useAppStore.getState().resetDemo();
});

describe('resubmit', () => {
  const NOW = new Date('2026-10-12T10:00:00Z');

  it('sends a returned application back to Level 1 in the same instance', () => {
    const d = data();
    const before = instanceOf(d, SAVITA);
    expect(before.status).toBe(WorkflowInstanceStatus.Returned);
    const outcome = resubmit(d, before.id, DEMO_USERS.priya, NOW);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const after = instanceOf(outcome.data, SAVITA);
    expect(after.id).toBe(before.id); // the same instance
    expect(outcome.data.workflowInstances).toHaveLength(d.workflowInstances.length);
    expect(after.status).toBe(WorkflowInstanceStatus.InProgress);
    expect(after.currentNodeIndex).toBe(2);
    expect(app(outcome.data, SAVITA).status).toBe(ApplicationStatus.InLevel1);
    expect(outcome.message).toBe('Application HL-2026-0004 resubmitted for approval');
  });

  it('puts the nodes back: the initiator done again, Level 1 waiting for Mahesh, the rest not reached', () => {
    const d = data();
    const outcome = resubmit(d, instanceOf(d, SAVITA).id, DEMO_USERS.priya, NOW);
    if (!outcome.ok) throw new Error(outcome.error);
    const nodes = outcome.instance.nodes;
    expect(nodes[0]).toMatchObject({
      index: 1,
      status: WorkflowNodeStatus.Done,
      actedBy: 'Priya Kulkarni',
      actedAt: NOW.toISOString(),
      comment: 'Resubmitted after correction',
    });
    expect(nodes[1]).toMatchObject({
      index: 2,
      status: WorkflowNodeStatus.Pending,
      assignee: 'Mahesh Joshi',
      actedBy: '',
      actedAt: '',
      comment: '',
    });
    expect(nodes[2]).toMatchObject({ index: 3, status: WorkflowNodeStatus.Waiting, actedBy: '' });
    expect(nodes[3]).toMatchObject({ index: 4, status: WorkflowNodeStatus.Waiting, actedBy: '' });
  });

  it('gives the Branch Manager the task again', () => {
    const d = data();
    expect(pendingTasksFor(d, DEMO_USERS.mahesh).map((t) => t.applicationId)).not.toContain(SAVITA);
    const outcome = resubmit(d, instanceOf(d, SAVITA).id, DEMO_USERS.priya, NOW);
    if (!outcome.ok) throw new Error(outcome.error);
    const tasks = pendingTasksFor(outcome.data, DEMO_USERS.mahesh);
    expect(tasks.map((t) => t.applicationId)).toContain(SAVITA);
    expect(tasks.find((t) => t.applicationId === SAVITA)?.level).toBe(1);
  });

  it('clears the decisions of the round before from the application (the trail keeps them)', () => {
    const d = data();
    expect(app(d, SAVITA).level1Decision).toBe('Returned');
    const outcome = resubmit(d, instanceOf(d, SAVITA).id, DEMO_USERS.priya, NOW);
    if (!outcome.ok) throw new Error(outcome.error);
    expect(app(outcome.data, SAVITA)).toMatchObject({
      level1Approver: '',
      level1Decision: '',
      level1Remarks: '',
      level1Time: '',
      level2Decision: '',
      sanctionedAmount: null,
      sanctionDate: '',
      updatedAt: NOW.toISOString(),
    });
    // the earlier decision is still in the audit trail
    expect(
      outcome.data.auditEvents.some(
        (e) =>
          e.applicationId === SAVITA &&
          e.event === 'Returned' &&
          e.comment.includes('Income Proof'),
      ),
    ).toBe(true);
  });

  it('writes one Resubmitted event, with who, when and the instance', () => {
    const d = data();
    const outcome = resubmit(d, instanceOf(d, SAVITA).id, DEMO_USERS.priya, NOW);
    if (!outcome.ok) throw new Error(outcome.error);
    const added = outcome.data.auditEvents.slice(d.auditEvents.length);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      applicationId: SAVITA,
      event: 'Resubmitted',
      user: 'Priya Kulkarni',
      at: NOW.toISOString(),
      field: 'Status',
      oldValue: 'Returned',
      newValue: 'In Level 1',
      reference: instanceOf(d, SAVITA).id,
    });
    expect(added[0].id).toMatch(/^AE-\d{5}$/);
  });

  it('lets the administrator resubmit it too', () => {
    const d = data();
    expect(resubmit(d, instanceOf(d, SAVITA).id, DEMO_USERS.admin, NOW).ok).toBe(true);
  });

  it('is refused for a loan officer who did not submit it, and for the approvers', () => {
    const d = data();
    const id = instanceOf(d, SAVITA).id;
    const stranger = { ...DEMO_USERS.priya, name: 'Another Officer' };
    for (const who of [stranger, DEMO_USERS.mahesh, DEMO_USERS.sunita]) {
      const outcome = resubmit(d, id, who, NOW);
      expect(outcome).toMatchObject({ ok: false, code: 'not-allowed' });
    }
  });

  it('is refused for an application that is not returned', () => {
    const d = data();
    for (const id of ['HL-2026-0001', 'HL-2026-0002', 'HL-2026-0003', 'HL-2026-0005']) {
      const outcome = resubmit(d, instanceOf(d, id).id, DEMO_USERS.admin, NOW);
      expect(outcome).toMatchObject({ ok: false, code: 'not-returned' });
    }
  });

  it('is refused for an instance that does not exist', () => {
    expect(resubmit(data(), 'WI-00000000', DEMO_USERS.priya, NOW)).toMatchObject({
      ok: false,
      code: 'not-found',
    });
  });

  it('is refused while the KYC result does not allow a submission', () => {
    const d = data();
    const blocked = (patch: Record<string, unknown>) => ({
      ...d,
      applications: d.applications.map((a) =>
        a.applicationId === SAVITA ? { ...a, ...patch } : a,
      ),
    });
    const id = instanceOf(d, SAVITA).id;
    expect(
      resubmit(blocked({ kycOverallResult: 'Fail' }), id, DEMO_USERS.priya, NOW),
    ).toMatchObject({
      ok: false,
      code: 'kyc-blocked',
    });
    expect(resubmit(blocked({ kycOverallResult: '' }), id, DEMO_USERS.priya, NOW)).toMatchObject({
      ok: false,
      code: 'kyc-blocked',
    });
    expect(
      resubmit(
        blocked({ kycOverallResult: 'Exception', kycExceptionRemark: '  ' }),
        id,
        DEMO_USERS.priya,
        NOW,
      ),
    ).toMatchObject({ ok: false, code: 'kyc-blocked' });
    expect(
      resubmit(
        blocked({ kycOverallResult: 'Exception', kycExceptionRemark: 'Same person' }),
        id,
        DEMO_USERS.priya,
        NOW,
      ).ok,
    ).toBe(true);
  });

  it('cannot be done twice: the second time the application is no longer returned', () => {
    const d = data();
    const first = resubmit(d, instanceOf(d, SAVITA).id, DEMO_USERS.priya, NOW);
    if (!first.ok) throw new Error(first.error);
    expect(resubmit(first.data, first.instance.id, DEMO_USERS.priya, NOW)).toMatchObject({
      ok: false,
      code: 'not-returned',
    });
  });

  it('changes nothing in the data it was given', () => {
    const d = data();
    const snapshot = JSON.stringify(d);
    resubmit(d, instanceOf(d, SAVITA).id, DEMO_USERS.priya, NOW);
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it('after it, Level 1 can decide again, and Level 2 must be a different person than the new Level 1', () => {
    const state = useAppStore.getState();
    const id = instanceOf(data(), SAVITA).id;
    expect(state.resubmit(id, DEMO_USERS.priya).ok).toBe(true);
    expect(useAppStore.getState().approve(id, DEMO_USERS.mahesh, 'Corrected, in order.').ok).toBe(
      true,
    );
    const sunita = useAppStore.getState().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
      sanctionedAmount: 800000,
      sanctionDate: '2026-10-12',
    });
    expect(sunita.ok).toBe(true);
    expect(app(data(), SAVITA).status).toBe(ApplicationStatus.Approved);
  });
});
