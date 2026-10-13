import { approveBothLevels, submitScenario, user } from '@/test/workflowHelpers';
import { STORAGE_KEY, useAppStore } from './store';
import { ApplicationStatus } from './types';
import { pendingTasksFor } from './workflow';

const state = () => useAppStore.getState();
const load = async (saved: unknown) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
  await useAppStore.persist.rehydrate();
};

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the store starts with the seed workflow', () => {
  it('has six instances (the draft has none), a trail and no messages', () => {
    expect(state().workflowInstances).toHaveLength(6);
    expect(state().auditEvents.length).toBeGreaterThan(40);
    expect(state().notifications).toEqual([]);
    expect(state().masterRecords).toEqual([]);
  });

  it('has one task for each approver', () => {
    expect(pendingTasksFor(state(), user('mahesh'))).toHaveLength(1);
    expect(pendingTasksFor(state(), user('sunita'))).toHaveLength(1);
  });
});

describe('submitApplication', () => {
  it('puts the draft into the workflow and keeps the form in step with the saved copy', () => {
    const { id, applicationId } = submitScenario('A');
    expect(id).toBe('WI-23445219');
    expect(state().draft.status).toBe(ApplicationStatus.InLevel1);
    const saved = state().applications.find((a) => a.applicationId === applicationId)!;
    expect(saved.status).toBe(ApplicationStatus.InLevel1);
    expect(state().applications).toHaveLength(8);
    expect(state().workflowInstances).toHaveLength(7);
  });

  it('refuses a draft whose KYC result is Fail, and changes nothing', () => {
    state().fillScenario('C');
    state().updateDraft({ consentGiven: true, kycOverallResult: 'Fail' });
    const before = state().workflowInstances.length;
    const outcome = state().submitApplication();
    expect(outcome).toMatchObject({ ok: false, code: 'kyc-blocked' });
    expect(state().workflowInstances).toHaveLength(before);
    expect(state().applications).toHaveLength(7);
    expect(state().draft.status).toBe(ApplicationStatus.Draft);
  });

  it('is done by the user who is acting: an approver cannot submit', () => {
    state().fillScenario('A');
    state().updateDraft({ kycOverallResult: 'Pass' });
    state().setCurrentUser('mahesh');
    expect(state().submitApplication()).toMatchObject({ ok: false, code: 'not-allowed' });
  });

  it('cannot be done twice for the same application', () => {
    submitScenario('A');
    expect(state().submitApplication()).toMatchObject({ ok: false, code: 'already-submitted' });
    expect(state().workflowInstances).toHaveLength(7);
  });
});

describe('the decisions, through the store', () => {
  it('Level 1 approves: the task moves to the Credit approver, and the draft follows', () => {
    const { id, applicationId } = submitScenario('A');
    const outcome = state().approve(id, user('mahesh'), 'In order.');
    expect(outcome).toMatchObject({ ok: true, message: 'Approved and sent to Level 2' });
    expect(pendingTasksFor(state(), user('sunita')).map((t) => t.applicationId)).toContain(
      applicationId,
    );
    expect(state().draft.status).toBe(ApplicationStatus.InLevel2);
  });

  it('both levels approve: the record is made and the files are filed', () => {
    const { id, applicationId } = submitScenario('A');
    approveBothLevels(id);
    expect(state().masterRecords.map((r) => r.applicationId)).toEqual([applicationId]);
    expect(state().masterRecords[0].documents.every((d) => d.filing)).toBe(true);
    expect(state().applications.find((a) => a.applicationId === applicationId)?.status).toBe(
      'Approved',
    );
    expect(state().notifications.map((n) => n.userId)).toEqual(['priya']);
  });

  it('a rejection makes no record', () => {
    const { id } = submitScenario('A');
    expect(state().reject(id, user('mahesh'), 'No.').ok).toBe(true);
    expect(state().masterRecords).toEqual([]);
  });

  it('a return is Returned for the loan officer', () => {
    const { id, applicationId } = submitScenario('A');
    expect(state().returnForCorrection(id, user('mahesh'), 'Fix the income proof.').ok).toBe(true);
    expect(state().applications.find((a) => a.applicationId === applicationId)?.status).toBe(
      'Returned',
    );
  });

  it('a refused action changes nothing', () => {
    const { id } = submitScenario('A');
    const before = state().auditEvents.length;
    expect(state().approve(id, user('admin'), '')).toMatchObject({ ok: false, code: 'wrong-role' });
    expect(state().reject(id, user('mahesh'), '')).toMatchObject({
      ok: false,
      code: 'comment-required',
    });
    expect(state().auditEvents).toHaveLength(before);
  });

  it('markNotificationsRead clears the count, once', () => {
    const { id } = submitScenario('A');
    state().reject(id, user('mahesh'), 'No.');
    expect(state().notifications.some((n) => !n.read)).toBe(true);
    state().markNotificationsRead('priya');
    expect(state().notifications.every((n) => n.read)).toBe(true);
    const list = state().notifications;
    state().markNotificationsRead('priya');
    expect(state().notifications).toBe(list); // nothing changed, so nothing re-draws
  });
});

describe('the workflow survives a reload', () => {
  it('keeps the instances, the trail and the record, and the files stay filed', async () => {
    const { id, applicationId } = submitScenario('A');
    approveBothLevels(id);
    const saved = localStorage.getItem(STORAGE_KEY)!;
    state().resetDemo();
    expect(state().masterRecords).toEqual([]);
    localStorage.setItem(STORAGE_KEY, saved);
    await useAppStore.persist.rehydrate();
    expect(state().workflowInstances.find((i) => i.id === id)?.status).toBe('Completed');
    expect(state().masterRecords.map((r) => r.applicationId)).toEqual([applicationId]);
    expect(state().masterRecords[0].documents[0].filing?.folderPath).toContain(applicationId);
    expect(
      state().auditEvents.some(
        (e) => e.event === 'Files stored' && e.applicationId === applicationId,
      ),
    ).toBe(true);
    expect(state().notifications).toHaveLength(1);
  });

  it('never writes an Aadhaar number to localStorage, through the whole journey', () => {
    const { id } = submitScenario('A');
    approveBothLevels(id);
    expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/\d{12}/);
  });

  it('Reset demo goes back to the seed workflow', () => {
    const { id, applicationId } = submitScenario('A');
    approveBothLevels(id);
    state().resetDemo();
    expect(state().workflowInstances).toHaveLength(6);
    expect(state().masterRecords).toEqual([]);
    expect(state().notifications).toEqual([]);
    expect(applicationId).toBe('HL-2026-0008');
    expect(state().auditEvents.every((e) => e.applicationId !== applicationId)).toBe(true);
  });
});

describe('a saved copy that is old or damaged, with the workflow in it', () => {
  it('gets the seed workflow when the copy has none (it was saved before the workflow existed)', async () => {
    await load({ currentUserId: 'mahesh' });
    expect(state().currentUserId).toBe('mahesh');
    expect(state().workflowInstances).toHaveLength(6);
    expect(pendingTasksFor(state(), user('mahesh'))).toHaveLength(1);
  });

  it('gives an application that was "Submitted" in that old copy its instance, waiting for Level 1', async () => {
    const old = {
      ...state().applications[2],
      applicationId: 'HL-2026-0008',
      status: 'Submitted',
      level1Decision: '',
      level1Approver: '',
      level1Remarks: '',
      level1Time: '',
    };
    await load({ applications: [...state().applications, old], workflowInstances: undefined });
    const instance = state().workflowInstances.find((i) => i.applicationId === 'HL-2026-0008')!;
    expect(instance).toBeDefined();
    expect(instance.nodes[1].status).toBe('Pending');
    expect(pendingTasksFor(state(), user('mahesh')).map((t) => t.applicationId)).toContain(
      'HL-2026-0008',
    );
  });

  it('drops a damaged instance, event and message, and keeps the good ones', async () => {
    const good = state().workflowInstances[0];
    const event = state().auditEvents[0];
    await load({
      workflowInstances: [good, { ...good, id: 'WI-99999999', status: 'Finished' }, null, 'text'],
      auditEvents: [
        event,
        { ...event, id: 'AE-90001', event: 'Something happened' },
        { ...event, id: 'AE-90002', at: 'soon' },
      ],
      notifications: [
        {
          id: 'NT-1',
          userId: 'priya',
          applicationId: 'a',
          instanceId: 'b',
          message: 'ok',
          at: '2026-10-09T10:00:00Z',
          read: false,
        },
        {
          id: 'NT-2',
          userId: 'nobody',
          applicationId: 'a',
          instanceId: 'b',
          message: 'no',
          at: '2026-10-09T10:00:00Z',
          read: false,
        },
      ],
    });
    expect(state().workflowInstances.map((i) => i.id)).toContain(good.id);
    expect(state().workflowInstances.map((i) => i.id)).not.toContain('WI-99999999');
    const eventIds = state().auditEvents.map((e) => e.id);
    expect(eventIds).toContain(event.id);
    expect(eventIds).not.toContain('AE-90001');
    expect(eventIds).not.toContain('AE-90002');
    // the applications whose instances were lost get new ones, with their trail
    expect(state().workflowInstances).toHaveLength(6);
    expect(state().notifications.map((n) => n.id)).toEqual(['NT-1']);
  });

  it('falls back to the seed workflow when the saved values are not lists', async () => {
    await load({ workflowInstances: 'many', auditEvents: 5, notifications: {} });
    expect(state().workflowInstances).toHaveLength(6);
    expect(state().notifications).toEqual([]);
  });

  it('an old saved copy with approval tasks in it (the format before the workflow) loads without them', async () => {
    await load({ approvalTasks: [{ id: 't1' }], currentUserId: 'sunita' });
    expect(state().currentUserId).toBe('sunita');
    expect('approvalTasks' in state()).toBe(false);
  });
});
