import {
  createBlankApplication,
  applyCalculatedFields,
  toApplicationDocuments,
} from './application';
import { SCENARIOS, SEED_APPLICATIONS } from './seed';
import { buildSeedWorkflow } from './seedWorkflow';
import {
  ApplicationStatus,
  WorkflowInstanceStatus,
  WorkflowNodeStatus,
  type DemoUser,
  type HomeLoanApplication,
} from './types';
import { DEMO_USERS } from './users';
import {
  actionBlock,
  allInstances,
  approve,
  completedFor,
  instanceByApplication,
  instancesFor,
  markNotificationsRead,
  pendingTasksFor,
  reject,
  returnForCorrection,
  submitToWorkflow,
  unreadCount,
  withEventIds,
  type WorkflowData,
  type WorkflowOutcome,
} from './workflow';

const { priya, mahesh, sunita, admin } = DEMO_USERS;

/**
 * What the next application and instance are called: the seven seed applications (0001 to 0007) and
 * their six instances (the seventh is a draft, which has none) are taken.
 */
const NEW_ID = 'HL-2026-0008';
const NEW_INSTANCE = 'WI-23445219';
const seedInstanceCount = 6;

const T0 = new Date('2026-10-09T10:00:00+05:30');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

/** The data the demo starts with: the seven seed applications and their workflow. */
function startData(): WorkflowData {
  const applications = structuredClone(SEED_APPLICATIONS);
  return { applications, masterRecords: [], ...buildSeedWorkflow(applications) };
}

/** Scenario A as the loan officer leaves it after Step 2: all filled, 13 documents, KYC Pass. */
function scenarioA(patch: Partial<HomeLoanApplication> = {}): HomeLoanApplication {
  const blank = createBlankApplication({
    applicationId: NEW_ID,
    branch: 'Belagavi Main Branch (demo)',
    createdBy: priya.name,
    now: new Date('2026-10-09T09:00:00+05:30'),
  });
  return applyCalculatedFields({
    ...blank,
    ...structuredClone(SCENARIOS.A.application),
    documents: toApplicationDocuments(
      blank.applicationId,
      SCENARIOS.A.documents,
      priya.name,
      '2026-10-09T09:10:00+05:30',
    ),
    consentGiven: true,
    consentTime: '2026-10-09T09:30:00+05:30',
    panStatus: 'Verified',
    aadhaarStatus: 'Verified',
    gstStatus: 'Verified',
    aadhaarReference: 'MOCK-AAD-20261009-08',
    nameMatchPercent: 100,
    dateOfBirthMatch: 'Exact',
    kycOverallResult: 'Pass',
    kycCheckedOn: '2026-10-09',
    ...patch,
  });
}

function ok(outcome: WorkflowOutcome) {
  if (!outcome.ok) throw new Error(`expected a success, got ${outcome.code}: ${outcome.error}`);
  return outcome;
}

/** Scenario A submitted by Priya: the instance is waiting for the Branch Manager. */
function submitted(patch: Partial<HomeLoanApplication> = {}) {
  const outcome = ok(submitToWorkflow(startData(), scenarioA(patch), priya, at(0)));
  return { data: outcome.data, id: outcome.instance.id };
}

const appOf = (data: WorkflowData, id = NEW_ID) =>
  data.applications.find((a) => a.applicationId === id)!;
const instOf = (data: WorkflowData, id: string) => data.workflowInstances.find((i) => i.id === id)!;
const eventsOf = (data: WorkflowData, id = NEW_ID) =>
  data.auditEvents.filter((e) => e.applicationId === id);

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

// ---------------------------------------------------------------------------
describe('submitting the form starts the workflow', () => {
  it('makes an instance with the four nodes, the first one done', () => {
    const { data, id } = submitted();
    const instance = instOf(data, id);
    expect(instance).toMatchObject({
      workflowName: 'Home Loan Approval',
      applicationId: NEW_ID,
      initiatedBy: 'Priya Kulkarni',
      status: WorkflowInstanceStatus.InProgress,
      currentNodeIndex: 2,
    });
    expect(instance.id).toMatch(/^WI-\d{8}$/);
    expect(instance.nodes.map((n) => [n.index, n.name, n.role, n.assignee, n.status])).toEqual([
      [1, 'Initiator', 'loanOfficer', 'Priya Kulkarni', 'Done'],
      [2, 'Level 1: Branch Manager', 'branchManager', 'Mahesh Joshi', 'Pending'],
      [3, 'Level 2: Credit Approver', 'creditApprover', 'Sunita Hegde', 'Waiting'],
      [4, 'Record creation and filing', 'system', 'System', 'Waiting'],
    ]);
    expect(instance.nodes[0]).toMatchObject({
      actedBy: 'Priya Kulkarni',
      actedAt: at(0).toISOString(),
    });
  });

  it('numbers instances on from the seed ones, WI-23445213 to WI-23445218 being taken', () => {
    const { id } = submitted();
    expect(id).toBe(NEW_INSTANCE);
  });

  it('sets the application to In Level 1 and saves it', () => {
    const { data } = submitted();
    expect(appOf(data).status).toBe(ApplicationStatus.InLevel1);
    expect(data.applications).toHaveLength(SEED_APPLICATIONS.length + 1);
    expect(data.masterRecords).toEqual([]);
  });

  it('gives the Branch Manager a task, and nobody else', () => {
    const { data, id } = submitted();
    const tasks = pendingTasksFor(data, mahesh);
    expect(tasks.map((t) => t.id)).toContain(id);
    expect(pendingTasksFor(data, sunita).map((t) => t.id)).not.toContain(id);
    expect(pendingTasksFor(data, priya)).toEqual([]);
    expect(pendingTasksFor(data, admin)).toEqual([]);
  });

  it('writes the trail of the application up to the submission, in order of time', () => {
    const { data } = submitted();
    const events = eventsOf(data);
    const names = events.map((e) => e.event);
    expect(names[0]).toBe('Application created');
    expect(names.filter((n) => n === 'Document uploaded')).toHaveLength(13);
    expect(names).toContain('Consent given');
    expect(names.filter((n) => n === 'KYC check run')).toHaveLength(3);
    expect(names).toContain('KYC result set');
    expect(names.slice(-2)).toEqual(['Submitted', 'Workflow started']);
    const times = events.map((e) => Date.parse(e.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(events.find((e) => e.event === 'Submitted')).toMatchObject({
      user: 'Priya Kulkarni',
      newValue: 'In Level 1',
    });
    expect(events.find((e) => e.event === 'Workflow started')).toMatchObject({
      user: 'System',
      reference: NEW_INSTANCE,
    });
  });

  it('gives every event a different id', () => {
    const { data } = submitted();
    const ids = data.auditEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips the GST check for an applicant who has no GST', () => {
    const { data } = submitted({ gstStatus: 'Not applicable' });
    expect(eventsOf(data).filter((e) => e.event === 'KYC check run')).toHaveLength(2);
  });

  it('never has an Aadhaar number in the application trail or in the instance', () => {
    const { data } = submitted();
    const text = JSON.stringify([eventsOf(data), data.workflowInstances, data.notifications]);
    expect(text).not.toMatch(/\d{12}/);
    expect(text).not.toMatch(/XXXX XXXX/);
    // the mock reference of the Aadhaar check is there, which is not the number
    expect(eventsOf(data).some((e) => e.reference === 'MOCK-AAD-20261009-08')).toBe(true);
  });

  it('lets the administrator submit too', () => {
    const outcome = submitToWorkflow(
      startData(),
      scenarioA({ createdBy: admin.name }),
      admin,
      at(0),
    );
    expect(outcome.ok).toBe(true);
  });
});

describe('submitting is refused', () => {
  it.each([
    ['a KYC result of Fail', { kycOverallResult: 'Fail' as const }],
    ['no KYC result', { kycOverallResult: '' as const }],
    [
      'an Exception without a remark',
      { kycOverallResult: 'Exception' as const, kycExceptionRemark: '  ' },
    ],
  ])('with %s', (_label, patch) => {
    const outcome = submitToWorkflow(startData(), scenarioA(patch), priya, at(0));
    expect(outcome).toMatchObject({
      ok: false,
      code: 'kyc-blocked',
      error: 'Resolve the KYC result before submitting',
    });
  });

  it('allows an Exception that has a remark', () => {
    const outcome = submitToWorkflow(
      startData(),
      scenarioA({
        kycOverallResult: 'Exception',
        kycExceptionRemark: 'Name differs by an initial.',
      }),
      priya,
      at(0),
    );
    expect(outcome.ok).toBe(true);
  });

  it('for an approver, who does not submit applications', () => {
    expect(submitToWorkflow(startData(), scenarioA(), mahesh, at(0))).toMatchObject({
      ok: false,
      code: 'not-allowed',
    });
  });

  it('the second time for the same application', () => {
    const { data } = submitted();
    expect(submitToWorkflow(data, scenarioA(), priya, at(5))).toMatchObject({
      ok: false,
      code: 'already-submitted',
    });
  });

  it('changes nothing when it is refused', () => {
    const before = deepFreeze(startData());
    submitToWorkflow(before, scenarioA({ kycOverallResult: 'Fail' }), priya, at(0));
    expect(before.workflowInstances).toHaveLength(seedInstanceCount);
    expect(before.applications).toHaveLength(SEED_APPLICATIONS.length);
  });
});

// ---------------------------------------------------------------------------
describe('scenario A: both levels approve', () => {
  function throughLevel1() {
    const { data, id } = submitted();
    const outcome = ok(approve(data, id, mahesh, 'Documents are in order.', {}, at(60)));
    return { data: outcome.data, id, outcome };
  }

  it('Level 1 approves: node 2 is Approved and node 3 waits for the Credit approver', () => {
    const { data, id, outcome } = throughLevel1();
    expect(outcome.message).toBe('Approved and sent to Level 2');
    const instance = instOf(data, id);
    expect(instance.currentNodeIndex).toBe(3);
    expect(instance.status).toBe('In Progress');
    expect(instance.nodes[1]).toMatchObject({
      status: WorkflowNodeStatus.Approved,
      actedBy: 'Mahesh Joshi',
      actedAt: at(60).toISOString(),
      comment: 'Documents are in order.',
    });
    expect(instance.nodes[2].status).toBe(WorkflowNodeStatus.Pending);
    expect(instance.nodes[3].status).toBe(WorkflowNodeStatus.Waiting);
  });

  it('puts the Level 1 decision on the application and moves it to In Level 2', () => {
    const { data } = throughLevel1();
    expect(appOf(data)).toMatchObject({
      status: 'In Level 2',
      level1Approver: 'Mahesh Joshi',
      level1Decision: 'Approved',
      level1Remarks: 'Documents are in order.',
      level1Time: at(60).toISOString(),
    });
  });

  it('moves the task from the Branch Manager to the Credit approver', () => {
    const { data, id } = throughLevel1();
    expect(pendingTasksFor(data, mahesh).map((t) => t.id)).not.toContain(id);
    const task = pendingTasksFor(data, sunita).find((t) => t.id === id);
    expect(task).toMatchObject({
      applicationId: NEW_ID,
      applicantName: 'Ramesh Patil',
      level: 2,
      receivedAt: at(60).toISOString(),
    });
  });

  it('records the Level 1 decision in the trail with its comment', () => {
    const { data } = throughLevel1();
    expect(eventsOf(data).at(-1)).toMatchObject({
      event: 'Level 1 decision',
      user: 'Mahesh Joshi',
      comment: 'Documents are in order.',
      newValue: 'Approved',
    });
  });

  describe('then Level 2 approves', () => {
    function finish(extra = { sanctionedAmount: 1_800_000, sanctionDate: '2026-10-10' }) {
      const { data, id } = throughLevel1();
      const outcome = ok(approve(data, id, sunita, 'Sanctioned as requested.', extra, at(120)));
      return { data: outcome.data, id, outcome };
    }

    it('completes the instance: node 3 Approved, node 4 done by the system', () => {
      const { data, id, outcome } = finish();
      expect(outcome.message).toBe('Application approved and record created');
      const instance = instOf(data, id);
      expect(instance.status).toBe('Completed');
      expect(instance.currentNodeIndex).toBe(4);
      expect(instance.nodes[2]).toMatchObject({
        status: 'Approved',
        actedBy: 'Sunita Hegde',
        comment: 'Sanctioned as requested.',
      });
      expect(instance.nodes[3]).toMatchObject({ status: 'Done', actedBy: 'System' });
      expect(Date.parse(instance.nodes[3].actedAt)).toBeGreaterThan(
        Date.parse(instance.nodes[2].actedAt),
      );
    });

    it('creates the master record, Approved, with the approval fields of section 6.8', () => {
      const { data } = finish();
      expect(data.masterRecords).toHaveLength(1);
      expect(data.masterRecords[0]).toMatchObject({
        applicationId: NEW_ID,
        status: 'Approved',
        fullNameAsPerPan: 'Ramesh Patil',
        level1Approver: 'Mahesh Joshi',
        level1Decision: 'Approved',
        level2Approver: 'Sunita Hegde',
        level2Decision: 'Approved',
        level2Remarks: 'Sanctioned as requested.',
        sanctionedAmount: 1_800_000,
        sanctionDate: '2026-10-10',
      });
      expect(appOf(data).status).toBe('Approved');
    });

    it('gives each of the 13 files its DocType tag and its folder, and moves none', () => {
      const { data } = finish();
      const docs = data.masterRecords[0].documents;
      expect(docs).toHaveLength(13);
      const folder = `Loans/Home Loan/Belagavi Main Branch (demo)/${NEW_ID} Ramesh Patil`;
      const byType = Object.fromEntries(docs.map((d) => [d.docType, d.filing]));
      expect(byType['PAN Card']).toMatchObject({
        docTypeTag: 'PAN Card',
        folderPath: `${folder}/01 KYC`,
      });
      expect(byType['Aadhaar (Masked Copy)']?.folderPath).toBe(`${folder}/01 KYC`);
      expect(byType['Income Proof']?.folderPath).toBe(`${folder}/02 Income`);
      expect(byType['GST Certificate or Business Licence']?.folderPath).toBe(`${folder}/02 Income`);
      expect(byType['Surety Documents']?.folderPath).toBe(`${folder}/02 Income`);
      expect(byType['Valuation Certificate']?.folderPath).toBe(`${folder}/03 Property`);
      expect(byType['Tax Paid Receipt']?.folderPath).toBe(`${folder}/03 Property`);
      expect(
        docs.every((d) => d.filing?.docTypeTag === d.docType && d.filing.storedAt !== ''),
      ).toBe(true);
      // the file names are as they were: filing only records where each belongs
      expect(docs.map((d) => d.fileName)).toEqual(scenarioA().documents.map((d) => d.fileName));
    });

    it("also writes the filing data on the application's own documents, for the trail", () => {
      const { data } = finish();
      expect(appOf(data).documents.every((d) => d.filing)).toBe(true);
    });

    it('records the decision, the sanctioned amount, the record and the files in the trail', () => {
      const { data } = finish();
      const events = eventsOf(data);
      const tail = events.slice(-4);
      expect(tail.map((e) => e.event)).toEqual([
        'Level 2 decision',
        'Level 2 decision',
        'Record created',
        'Files stored',
      ]);
      expect(tail[0]).toMatchObject({
        user: 'Sunita Hegde',
        newValue: 'Approved',
        comment: 'Sanctioned as requested.',
      });
      expect(tail[1]).toMatchObject({
        field: 'Sanctioned Amount',
        oldValue: '1800000',
        newValue: '1800000',
      });
      expect(tail[2]).toMatchObject({ user: 'System', newValue: 'Approved' });
      expect(tail[3]).toMatchObject({
        user: 'System',
        field: '13 files',
        newValue: `Loans/Home Loan/Belagavi Main Branch (demo)/${NEW_ID} Ramesh Patil`,
      });
    });

    it('notes the old and the new value when the sanctioned amount differs from the request', () => {
      const { data } = finish({ sanctionedAmount: 1_700_000, sanctionDate: '2026-10-10' });
      const change = eventsOf(data).find((e) => e.field === 'Sanctioned Amount')!;
      expect(change).toMatchObject({ oldValue: '1800000', newValue: '1700000' });
      expect(data.masterRecords[0].sanctionedAmount).toBe(1_700_000);
    });

    it('tells the loan officer, once, and leaves the approvers with no task', () => {
      const { data } = finish();
      expect(data.notifications).toHaveLength(1);
      expect(data.notifications[0]).toMatchObject({
        userId: 'priya',
        applicationId: NEW_ID,
        read: false,
      });
      expect(data.notifications[0].message).toMatch(/approved and its record was created/);
      expect(unreadCount(data, priya)).toBe(1);
      // the seed tasks (Manjunath for Mahesh, Shobha for Sunita) are still theirs
      expect(pendingTasksFor(data, mahesh).map((t) => t.applicationId)).toEqual(['HL-2026-0003']);
      expect(pendingTasksFor(data, sunita).map((t) => t.applicationId)).toEqual(['HL-2026-0002']);
    });

    it('the instance is found by the application, and is in the Completed list of both approvers and the maker', () => {
      const { data, id } = finish();
      expect(instanceByApplication(data, NEW_ID)?.id).toBe(id);
      for (const user of [priya, mahesh, sunita]) {
        expect(completedFor(data, user).map((i) => i.id)).toContain(id);
      }
      expect(completedFor(data, admin)).toEqual([]);
    });

    it('allows a sanctioned amount equal to the Eligible Amount', () => {
      const eligible = appOf(submitted().data).eligibleAmount!;
      expect(eligible).toBe(1_950_000);
      const { data, id } = throughLevel1();
      const outcome = approve(
        data,
        id,
        sunita,
        '',
        { sanctionedAmount: eligible, sanctionDate: '2026-10-10' },
        at(120),
      );
      expect(outcome.ok).toBe(true);
    });
  });
});

describe('Level 2 needs the sanction details', () => {
  function atLevel2() {
    const { data, id } = submitted();
    return { data: ok(approve(data, id, mahesh, '', {}, at(60))).data, id };
  }

  it('refuses an amount above the Eligible Amount, and says what it is', () => {
    const { data, id } = atLevel2();
    const outcome = approve(
      data,
      id,
      sunita,
      '',
      { sanctionedAmount: 1_950_001, sanctionDate: '2026-10-10' },
      at(90),
    );
    expect(outcome).toMatchObject({ ok: false, code: 'sanction-over-eligible' });
    expect(!outcome.ok && outcome.error).toContain('19,50,000');
  });

  it.each([
    ['none', undefined],
    ['zero', 0],
    ['negative', -5],
    ['a fraction', 1000.5],
    ['not a number', Number.NaN],
  ])('refuses %s as the amount', (_label, amount) => {
    const { data, id } = atLevel2();
    const outcome = approve(
      data,
      id,
      sunita,
      '',
      { sanctionedAmount: amount, sanctionDate: '2026-10-10' },
      at(90),
    );
    expect(outcome).toMatchObject({ ok: false, code: 'invalid-sanction-amount' });
  });

  it.each([
    ['none', undefined],
    ['empty', ''],
    ['not a date', 'tomorrow'],
    ['not a day', '2026-13-45'],
  ])('refuses %s as the date', (_label, date) => {
    const { data, id } = atLevel2();
    const outcome = approve(
      data,
      id,
      sunita,
      '',
      { sanctionedAmount: 1_000_000, sanctionDate: date },
      at(90),
    );
    expect(outcome).toMatchObject({ ok: false, code: 'invalid-sanction-date' });
  });

  it('creates no record and files nothing while it is refused, and the task stays', () => {
    const { data, id } = atLevel2();
    const outcome = approve(
      data,
      id,
      sunita,
      '',
      { sanctionedAmount: 9_999_999, sanctionDate: '2026-10-10' },
      at(90),
    );
    expect(outcome.ok).toBe(false);
    expect(data.masterRecords).toEqual([]);
    expect(instOf(data, id).nodes[2].status).toBe('Pending');
    expect(pendingTasksFor(data, sunita).map((t) => t.id)).toContain(id);
  });

  it('does not ask for the sanction at Level 1', () => {
    const { data, id } = submitted();
    expect(approve(data, id, mahesh, '', {}, at(60)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('rejecting', () => {
  it('at Level 1 needs a comment', () => {
    const { data, id } = submitted();
    for (const comment of ['', '   ']) {
      expect(reject(data, id, mahesh, comment, at(60))).toMatchObject({
        ok: false,
        code: 'comment-required',
        error: 'Enter a comment to reject',
      });
    }
  });

  it('at Level 1 ends it: Rejected, no record, nothing filed, the later nodes untouched', () => {
    const { data, id } = submitted();
    const outcome = ok(reject(data, id, mahesh, 'Income documents are missing.', at(60)));
    expect(outcome.message).toBe('Application rejected');
    const next = outcome.data;
    const instance = instOf(next, id);
    expect(instance.status).toBe('Rejected');
    expect(instance.currentNodeIndex).toBe(2);
    expect(instance.nodes.map((n) => n.status)).toEqual(['Done', 'Rejected', 'Waiting', 'Waiting']);
    expect(instance.nodes[1]).toMatchObject({
      actedBy: 'Mahesh Joshi',
      comment: 'Income documents are missing.',
    });
    expect(appOf(next)).toMatchObject({
      status: 'Rejected',
      level1Decision: 'Rejected',
      level1Remarks: 'Income documents are missing.',
      level2Decision: '',
    });
    expect(next.masterRecords).toEqual([]);
    expect(appOf(next).documents.some((d) => d.filing)).toBe(false);
    expect(pendingTasksFor(next, sunita).map((t) => t.id)).not.toContain(id);
  });

  it('at Level 2 ends it the same way, after Level 1 approved', () => {
    const { data, id } = submitted();
    const atTwo = ok(approve(data, id, mahesh, 'ok', {}, at(60))).data;
    expect(reject(atTwo, id, sunita, '', at(120))).toMatchObject({
      ok: false,
      code: 'comment-required',
    });
    const outcome = ok(reject(atTwo, id, sunita, 'Repayment capacity is not enough.', at(120)));
    const next = outcome.data;
    const instance = instOf(next, id);
    expect(instance.status).toBe('Rejected');
    expect(instance.currentNodeIndex).toBe(3);
    expect(instance.nodes.map((n) => n.status)).toEqual([
      'Done',
      'Approved',
      'Rejected',
      'Waiting',
    ]);
    expect(appOf(next)).toMatchObject({
      status: 'Rejected',
      level1Decision: 'Approved',
      level2Decision: 'Rejected',
      level2Remarks: 'Repayment capacity is not enough.',
    });
    expect(next.masterRecords).toEqual([]);
    expect(appOf(next).documents.some((d) => d.filing)).toBe(false);
    expect(appOf(next).sanctionedAmount).toBeNull();
    // the files stay in the workflow: no "Record created" and no "Files stored" in the trail
    const names = eventsOf(next).map((e) => e.event);
    expect(names).not.toContain('Record created');
    expect(names).not.toContain('Files stored');
  });

  it('records the decision and the rejection in the trail, with the reason', () => {
    const { data, id } = submitted();
    const next = ok(reject(data, id, mahesh, 'Not eligible.', at(60))).data;
    const tail = eventsOf(next).slice(-2);
    expect(tail.map((e) => e.event)).toEqual(['Level 1 decision', 'Rejected']);
    expect(tail[0]).toMatchObject({
      newValue: 'Rejected',
      comment: 'Not eligible.',
      user: 'Mahesh Joshi',
    });
    expect(tail[1]).toMatchObject({
      oldValue: 'In Level 1',
      newValue: 'Rejected',
      comment: 'Not eligible.',
    });
  });

  it('tells the loan officer with the reason', () => {
    const { data, id } = submitted();
    const next = ok(reject(data, id, mahesh, 'Not eligible.', at(60))).data;
    expect(next.notifications).toHaveLength(1);
    expect(next.notifications[0].message).toBe(
      `Application ${NEW_ID} was rejected. Reason: Not eligible.`,
    );
    expect(unreadCount(next, priya)).toBe(1);
  });

  it('cannot be acted on again once it is rejected', () => {
    const { data, id } = submitted();
    const next = ok(reject(data, id, mahesh, 'No.', at(60))).data;
    expect(approve(next, id, mahesh, '', {}, at(70))).toMatchObject({
      ok: false,
      code: 'not-active',
    });
    expect(reject(next, id, sunita, 'No.', at(70))).toMatchObject({
      ok: false,
      code: 'not-active',
    });
  });
});

describe('returning for correction', () => {
  it('needs a comment', () => {
    const { data, id } = submitted();
    expect(returnForCorrection(data, id, mahesh, '', at(60))).toMatchObject({
      ok: false,
      code: 'comment-required',
      error: 'Enter a comment to return the application',
    });
  });

  it('at Level 1: the application and the instance are Returned, and the loan officer is told why', () => {
    const { data, id } = submitted();
    const outcome = ok(
      returnForCorrection(data, id, mahesh, 'Upload a clear income proof.', at(60)),
    );
    expect(outcome.message).toBe('Returned to loan officer');
    const next = outcome.data;
    const instance = instOf(next, id);
    expect(instance.status).toBe('Returned');
    expect(instance.nodes.map((n) => n.status)).toEqual(['Done', 'Returned', 'Waiting', 'Waiting']);
    expect(appOf(next)).toMatchObject({
      status: 'Returned',
      level1Decision: 'Returned',
      level1Remarks: 'Upload a clear income proof.',
    });
    expect(next.masterRecords).toEqual([]);
    expect(next.notifications[0].message).toBe(
      `Application ${NEW_ID} was returned for correction. Reason: Upload a clear income proof.`,
    );
    const tail = eventsOf(next).slice(-2);
    expect(tail.map((e) => e.event)).toEqual(['Level 1 decision', 'Returned']);
  });

  it('at Level 2: the same, with the Level 2 decision', () => {
    const { data, id } = submitted();
    const atTwo = ok(approve(data, id, mahesh, '', {}, at(60))).data;
    const next = ok(
      returnForCorrection(atTwo, id, sunita, 'Check the property valuation.', at(120)),
    ).data;
    expect(instOf(next, id).nodes.map((n) => n.status)).toEqual([
      'Done',
      'Approved',
      'Returned',
      'Waiting',
    ]);
    expect(appOf(next)).toMatchObject({ status: 'Returned', level2Decision: 'Returned' });
    expect(next.masterRecords).toEqual([]);
  });

  it('takes the task off the approver', () => {
    const { data, id } = submitted();
    const next = ok(returnForCorrection(data, id, mahesh, 'Fix it.', at(60))).data;
    expect(pendingTasksFor(next, mahesh).map((t) => t.id)).not.toContain(id);
  });
});

// ---------------------------------------------------------------------------
describe('who may act', () => {
  it('only the assigned role: the administrator and the wrong approver cannot', () => {
    const { data, id } = submitted();
    expect(approve(data, id, admin, '', {}, at(60))).toMatchObject({
      ok: false,
      code: 'wrong-role',
    });
    expect(approve(data, id, sunita, '', {}, at(60))).toMatchObject({
      ok: false,
      code: 'wrong-role',
    });
    expect(reject(data, id, sunita, 'No', at(60))).toMatchObject({ ok: false, code: 'wrong-role' });
    expect(returnForCorrection(data, id, admin, 'No', at(60))).toMatchObject({
      ok: false,
      code: 'wrong-role',
    });
  });

  it('the Branch Manager cannot take the Level 2 turn after approving Level 1', () => {
    const { data, id } = submitted();
    const atTwo = ok(approve(data, id, mahesh, '', {}, at(60))).data;
    expect(
      approve(atTwo, id, mahesh, '', { sanctionedAmount: 1, sanctionDate: '2026-10-10' }, at(70)),
    ).toMatchObject({
      ok: false,
      code: 'wrong-role',
    });
  });

  it('the loan officer who submitted can never act on it, whatever the role they are given', () => {
    const { data, id } = submitted();
    expect(approve(data, id, priya, '', {}, at(60))).toMatchObject({
      ok: false,
      code: 'own-instance',
    });
    // even a person who has the Branch Manager role but is the one who submitted
    const sameName: DemoUser = { ...mahesh, name: 'Priya Kulkarni' };
    expect(approve(data, id, sameName, '', {}, at(60))).toMatchObject({
      ok: false,
      code: 'own-instance',
    });
    expect(reject(data, id, sameName, 'No', at(60))).toMatchObject({
      ok: false,
      code: 'own-instance',
    });
    // and at Level 2
    const atTwo = ok(approve(data, id, mahesh, '', {}, at(60))).data;
    const creditSame: DemoUser = { ...sunita, name: 'Priya Kulkarni' };
    expect(
      approve(
        atTwo,
        id,
        creditSame,
        '',
        { sanctionedAmount: 1, sanctionDate: '2026-10-10' },
        at(70),
      ),
    ).toMatchObject({ ok: false, code: 'own-instance' });
  });

  it('the Level 1 and the Level 2 approver must be different people', () => {
    const { data, id } = submitted();
    const atTwo = ok(approve(data, id, mahesh, '', {}, at(60))).data;
    const sameApprover: DemoUser = { ...sunita, name: 'Mahesh Joshi' };
    expect(
      approve(
        atTwo,
        id,
        sameApprover,
        '',
        { sanctionedAmount: 1_000_000, sanctionDate: '2026-10-10' },
        at(70),
      ),
    ).toMatchObject({ ok: false, code: 'same-approver' });
    expect(reject(atTwo, id, sameApprover, 'No', at(70))).toMatchObject({
      ok: false,
      code: 'same-approver',
    });
    expect(returnForCorrection(atTwo, id, sameApprover, 'No', at(70))).toMatchObject({
      ok: false,
      code: 'same-approver',
    });
  });

  it('an unknown instance is refused', () => {
    expect(approve(startData(), 'WI-00000000', mahesh, '', {}, at(0))).toMatchObject({
      ok: false,
      code: 'not-found',
    });
  });

  it('a decided node cannot be decided again', () => {
    const { data, id } = submitted();
    const done = ok(approve(data, id, mahesh, '', {}, at(60))).data;
    // node 2 is Approved now; the same approver coming back is not the one whose turn it is
    expect(approve(done, id, mahesh, '', {}, at(61)).ok).toBe(false);
  });

  it('a completed instance cannot be acted on', () => {
    const { data, id } = submitted();
    const atTwo = ok(approve(data, id, mahesh, '', {}, at(60))).data;
    const done = ok(
      approve(
        atTwo,
        id,
        sunita,
        '',
        { sanctionedAmount: 1_000_000, sanctionDate: '2026-10-10' },
        at(70),
      ),
    ).data;
    expect(
      approve(
        done,
        id,
        sunita,
        '',
        { sanctionedAmount: 1_000_000, sanctionDate: '2026-10-10' },
        at(80),
      ),
    ).toMatchObject({
      ok: false,
      code: 'not-active',
    });
  });

  it('a refused action changes nothing at all', () => {
    const { data, id } = submitted();
    const frozen = deepFreeze(structuredClone(data));
    approve(frozen, id, admin, '', {}, at(60));
    reject(frozen, id, mahesh, '', at(60));
    returnForCorrection(frozen, id, priya, 'x', at(60));
    expect(frozen).toEqual(data);
  });

  it('a successful action does not change the data it was given either', () => {
    const { data, id } = submitted();
    const frozen = deepFreeze(structuredClone(data));
    expect(() => approve(frozen, id, mahesh, 'ok', {}, at(60))).not.toThrow();
    expect(() => reject(frozen, id, mahesh, 'no', at(60))).not.toThrow();
    expect(() => returnForCorrection(frozen, id, mahesh, 'fix', at(60))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe('looking things up', () => {
  it('lists the tasks of a user oldest first, with the applicant and the level', () => {
    const { data } = submitted();
    const tasks = pendingTasksFor(data, mahesh);
    expect(tasks.map((t) => [t.applicationId, t.applicantName, t.level])).toEqual([
      ['HL-2026-0003', 'Manjunath Hiremath', 1],
      [NEW_ID, 'Ramesh Patil', 1],
    ]);
    expect(tasks[0].assignedTo).toBe('mahesh');
  });

  it('counts what is new: tasks plus unread messages, and a read message no more', () => {
    const { data, id } = submitted();
    const rejected = ok(reject(data, id, mahesh, 'No', at(60))).data;
    expect(unreadCount(rejected, priya)).toBe(1);
    expect(unreadCount(rejected, mahesh)).toBe(1); // the seed task for Manjunath
    const read = {
      ...rejected,
      notifications: markNotificationsRead(rejected.notifications, 'priya'),
    };
    expect(unreadCount(read, priya)).toBe(0);
    expect(unreadCount(read, mahesh)).toBe(1);
  });

  it('keeps the same list when there was nothing to mark as read', () => {
    const none = startData().notifications;
    expect(markNotificationsRead(none, 'priya')).toBe(none);
  });

  it('shows the administrator every instance, and each other user the ones they are part of', () => {
    const { data } = submitted();
    expect(allInstances(data)).toHaveLength(seedInstanceCount + 1);
    expect(instancesFor(data, admin)).toHaveLength(seedInstanceCount + 1);
    // the maker sees only her own
    expect(
      instancesFor(data, priya)
        .map((i) => i.applicationId)
        .sort(),
    ).toEqual(['HL-2026-0001', 'HL-2026-0002', 'HL-2026-0004', 'HL-2026-0006', NEW_ID]);
    // the approvers are assigned to every instance
    expect(instancesFor(data, mahesh)).toHaveLength(seedInstanceCount + 1);
    expect(instancesFor(data, sunita)).toHaveLength(seedInstanceCount + 1);
  });

  it('lists the newest submission first', () => {
    const { data } = submitted();
    expect(allInstances(data)[0].applicationId).toBe(NEW_ID);
  });

  it('puts the instances a user acted on in the Completed list, latest action first', () => {
    const { data } = submitted();
    expect(completedFor(data, mahesh).map((i) => i.applicationId)).toEqual([
      'HL-2026-0006',
      'HL-2026-0004',
      'HL-2026-0002',
      'HL-2026-0005',
      'HL-2026-0001',
    ]);
  });

  it('finds no instance for an application that was never submitted', () => {
    expect(instanceByApplication(startData(), 'HL-2026-0099')).toBeUndefined();
  });
});

describe('actionBlock: why a user cannot act (what Take Action asks)', () => {
  const id = (n: number) => `WI-${23445213 + n}`;

  it('is null for the assigned approver at each level', () => {
    const data = startData();
    expect(actionBlock(data, id(2), mahesh)).toBeNull(); // Manjunath waits for Level 1
    expect(actionBlock(data, id(1), sunita)).toBeNull(); // Shobha waits for Level 2
  });

  it('says wrong-role for somebody who is not the assigned role', () => {
    const data = startData();
    expect(actionBlock(data, id(2), sunita)?.code).toBe('wrong-role');
    expect(actionBlock(data, id(1), mahesh)?.code).toBe('wrong-role');
    expect(actionBlock(data, id(2), admin)?.code).toBe('wrong-role');
  });

  it('says not-active for an instance that is finished', () => {
    const data = startData();
    expect(actionBlock(data, id(0), mahesh)?.code).toBe('not-active'); // Vijay: completed
    expect(actionBlock(data, id(4), sunita)?.code).toBe('not-active'); // Basavaraj: rejected
  });

  it('says own-instance for the person who submitted it', () => {
    const data = startData();
    const first = submitToWorkflow(data, scenarioA(), priya, at(0));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(actionBlock(first.data, first.instance.id, priya)?.code).toBe('own-instance');
  });

  it('says same-approver when the Level 1 approver would also decide Level 2', () => {
    const data = startData();
    const sub = submitToWorkflow(data, scenarioA(), priya, at(0));
    if (!sub.ok) throw new Error(sub.error);
    const one = approve(sub.data, sub.instance.id, mahesh, 'ok', {}, at(5));
    if (!one.ok) throw new Error(one.error);
    // a second person holding the credit role who is the same as the Level 1 approver
    const twin: DemoUser = { ...sunita, name: mahesh.name };
    expect(actionBlock(one.data, one.instance.id, twin)?.code).toBe('same-approver');
    expect(actionBlock(one.data, one.instance.id, sunita)).toBeNull();
  });

  it('says not-found for an instance that does not exist', () => {
    expect(actionBlock(startData(), 'WI-00000000', mahesh)?.code).toBe('not-found');
  });

  it('agrees with approve: it blocks exactly when approve would refuse', () => {
    const data = startData();
    for (const user of [priya, mahesh, sunita, admin]) {
      for (const instance of data.workflowInstances) {
        const block = actionBlock(data, instance.id, user);
        const result = approve(data, instance.id, user, 'ok', {
          sanctionedAmount: 100000,
          sanctionDate: '2026-10-10',
        });
        expect(block !== null, `${user.name} on ${instance.id}`).toBe(!result.ok);
      }
    }
  });
});

describe('an Aadhaar number typed into a comment', () => {
  const typed = 'Aadhaar 234500074821 checked against the PAN.';
  const masked = 'Aadhaar XXXX XXXX 4821 checked against the PAN.';

  it('is masked in the node, the trail and the application when a level approves', () => {
    const data = startData();
    const out = approve(data, 'WI-23445215', mahesh, typed, {}, at(0));
    if (!out.ok) throw new Error(out.error);
    expect(out.instance.nodes.find((n) => n.index === 2)?.comment).toBe(masked);
    const app = out.data.applications.find((a) => a.applicationId === out.instance.applicationId);
    expect(app?.level1Remarks).toBe(masked);
    const event = out.data.auditEvents.filter((e) => e.event === 'Level 1 decision').at(-1);
    expect(event?.comment).toBe(masked);
    expect(JSON.stringify(out.data)).not.toContain('234500074821');
  });

  it('is masked when a level rejects or returns', () => {
    const data = startData();
    const rejected = reject(data, 'WI-23445215', mahesh, typed, at(0));
    if (!rejected.ok) throw new Error(rejected.error);
    expect(rejected.instance.nodes.find((n) => n.index === 2)?.comment).toBe(masked);
    expect(JSON.stringify(rejected.data)).not.toContain('234500074821');

    const returned = returnForCorrection(data, 'WI-23445215', mahesh, typed, at(0));
    if (!returned.ok) throw new Error(returned.error);
    expect(returned.instance.nodes.find((n) => n.index === 2)?.comment).toBe(masked);
    expect(JSON.stringify(returned.data)).not.toContain('234500074821');
  });
});

describe('withEventIds', () => {
  it('masks an Aadhaar number in the comment and in the old and new values of any event', () => {
    const [event] = withEventIds(
      [],
      [
        {
          applicationId: 'HL-2026-0001',
          event: 'Field changed',
          user: 'Admin',
          at: '2026-10-12T10:00:00Z',
          comment: 'Checked 2345 0007 4821 by phone',
          oldValue: '234500074821',
          newValue: 'now 2345-0007-4821',
        },
      ],
    );
    expect(event.comment).toBe('Checked XXXX XXXX 4821 by phone');
    expect(event.oldValue).toBe('XXXX XXXX 4821');
    expect(JSON.stringify(event)).not.toMatch(/2345[ -]?0007|234500074821/);
  });

  it('leaves ordinary texts and amounts as they are', () => {
    const [event] = withEventIds(
      [],
      [
        {
          applicationId: 'HL-2026-0001',
          event: 'Field changed',
          user: 'Admin',
          at: '2026-10-12T10:00:00Z',
          comment: 'Valuation was revised',
          oldValue: '₹ 20,00,000',
          newValue: '9000000001',
        },
      ],
    );
    expect(event).toMatchObject({
      comment: 'Valuation was revised',
      oldValue: '₹ 20,00,000',
      newValue: '9000000001',
    });
  });
});

describe('pendingTasksFor and the application creator', () => {
  it('leaves out an instance whose application the user created, as actionBlock does', () => {
    const data = startData();
    expect(pendingTasksFor(data, mahesh).map((t) => t.id)).toEqual(['WI-23445215']);
    // Mahesh created that application (the instance was started by somebody else)
    data.applications = data.applications.map((a) =>
      a.applicationId === data.workflowInstances.find((i) => i.id === 'WI-23445215')!.applicationId
        ? { ...a, createdBy: mahesh.name }
        : a,
    );
    expect(pendingTasksFor(data, mahesh)).toEqual([]);
    expect(actionBlock(data, 'WI-23445215', mahesh)?.code).toBe('own-instance');
  });
});

describe('when the KYC checks are dated in the trail', () => {
  const kycTimes = (events: { event: string; at: string }[]) =>
    events
      .filter((e) => e.event === 'KYC check run' || e.event === 'KYC result set')
      .map((e) => Date.parse(e.at));

  it('is about 90 seconds before the submission when the form was filled long before', () => {
    const out = submitToWorkflow(startData(), scenarioA(), priya, at(60));
    if (!out.ok) throw new Error(out.error);
    const trail = out.data.auditEvents.filter(
      (e) => e.applicationId === out.instance.applicationId,
    );
    for (const time of kycTimes(trail)) expect(time).toBe(at(60).getTime() - 90_000);
  });

  it('is never before the application, its files or the consent were recorded', () => {
    // the form was filled 20 seconds before the submit: 90 seconds back would be before all of it
    const now = at(60);
    const filled = new Date(now.getTime() - 20_000).toISOString();
    const app = scenarioA({ createdAt: filled, consentTime: filled });
    app.documents = app.documents.map((d) => ({ ...d, uploadedAt: filled }));
    const out = submitToWorkflow(startData(), app, priya, now);
    if (!out.ok) throw new Error(out.error);
    const trail = out.data.auditEvents.filter(
      (e) => e.applicationId === out.instance.applicationId,
    );
    for (const time of kycTimes(trail)) {
      expect(time).toBeGreaterThanOrEqual(Date.parse(filled));
      expect(time).toBeLessThanOrEqual(now.getTime());
    }
  });

  it('reads in the right order, newest first: submitted, the checks, then the form events', () => {
    const now = at(60);
    const filled = new Date(now.getTime() - 5_000).toISOString();
    const app = scenarioA({ createdAt: filled, consentTime: filled });
    app.documents = app.documents.map((d) => ({ ...d, uploadedAt: filled }));
    const out = submitToWorkflow(startData(), app, priya, now);
    if (!out.ok) throw new Error(out.error);
    const trail = out.data.auditEvents
      .filter((e) => e.applicationId === out.instance.applicationId)
      .map((e, index) => ({ e, index }))
      .sort((a, b) => Date.parse(b.e.at) - Date.parse(a.e.at) || b.index - a.index)
      .map(({ e }) => e.event);
    expect(trail.indexOf('Workflow started')).toBeLessThan(trail.indexOf('Submitted'));
    expect(trail.indexOf('Submitted')).toBeLessThan(trail.indexOf('KYC result set'));
    expect(trail.indexOf('KYC result set')).toBeLessThan(trail.indexOf('Consent given'));
    expect(trail.indexOf('Consent given')).toBeLessThan(trail.indexOf('Document uploaded'));
    expect(trail.indexOf('Document uploaded')).toBeLessThan(trail.indexOf('Application created'));
  });
});
