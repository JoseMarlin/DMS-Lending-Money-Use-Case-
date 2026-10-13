import { SEED_APPLICATIONS } from './seed';
import { SEED_COMMENTS } from './seedComments';
import { addMissingWorkflow, buildSeedWorkflow } from './seedWorkflow';
import { ApplicationStatus } from './types';
import { DEMO_USERS } from './users';
import { instanceByApplication, pendingTasksFor, unreadCount } from './workflow';

const { mahesh, sunita, priya } = DEMO_USERS;

const seed = () => {
  const applications = structuredClone(SEED_APPLICATIONS);
  const workflow = buildSeedWorkflow(applications);
  return { applications, masterRecords: [], ...workflow };
};

describe('the seed workflow', () => {
  it('has one instance for each submitted seed application, numbered from WI-23445213, and none for the draft', () => {
    const { workflowInstances } = seed();
    expect(workflowInstances.map((i) => i.id)).toEqual([
      'WI-23445213',
      'WI-23445214',
      'WI-23445215',
      'WI-23445216',
      'WI-23445217',
      'WI-23445218',
    ]);
    // the seventh seed application (Prakash Naik) is a draft: it has not been submitted
    expect(workflowInstances.map((i) => i.applicationId)).toEqual(
      SEED_APPLICATIONS.filter((a) => a.status !== ApplicationStatus.Draft).map(
        (a) => a.applicationId,
      ),
    );
    expect(instanceByApplication(seed(), 'HL-2026-0007')).toBeUndefined();
  });

  it.each([
    ['HL-2026-0001', 'Completed', ['Done', 'Approved', 'Approved', 'Done'], 4],
    ['HL-2026-0002', 'In Progress', ['Done', 'Approved', 'Pending', 'Waiting'], 3],
    ['HL-2026-0003', 'In Progress', ['Done', 'Pending', 'Waiting', 'Waiting'], 2],
    ['HL-2026-0004', 'Returned', ['Done', 'Returned', 'Waiting', 'Waiting'], 2],
    ['HL-2026-0005', 'Rejected', ['Done', 'Approved', 'Rejected', 'Waiting'], 3],
    ['HL-2026-0006', 'Completed', ['Done', 'Approved', 'Approved', 'Done'], 4],
  ])('%s is %s, as its status says', (id, status, nodes, current) => {
    const instance = instanceByApplication(seed(), id)!;
    expect(instance.status).toBe(status);
    expect(instance.nodes.map((n) => n.status)).toEqual(nodes);
    expect(instance.currentNodeIndex).toBe(current);
  });

  it('agrees with the application on who decided, when and why', () => {
    const data = seed();
    const returned = instanceByApplication(data, 'HL-2026-0004')!;
    expect(returned.nodes[1]).toMatchObject({
      actedBy: 'Mahesh Joshi',
      comment: 'Income Proof is not readable. Upload a clear copy and resubmit.',
    });
    const rejected = instanceByApplication(data, 'HL-2026-0005')!;
    expect(rejected.nodes[2]).toMatchObject({
      actedBy: 'Sunita Hegde',
      comment: 'Repayment capacity is not enough for the requested amount.',
    });
  });

  it('puts one task with each approver to start with: Manjunath at Level 1, Shobha at Level 2', () => {
    const data = seed();
    expect(pendingTasksFor(data, mahesh).map((t) => t.applicantName)).toEqual([
      'Manjunath Hiremath',
    ]);
    expect(pendingTasksFor(data, sunita).map((t) => t.applicantName)).toEqual(['Shobha Gaonkar']);
    expect(pendingTasksFor(data, priya)).toEqual([]);
    expect(unreadCount(data, mahesh)).toBe(1);
    expect(unreadCount(data, priya)).toBe(0);
  });

  it('has the trail of each application, from its creation, in order of time', () => {
    const { auditEvents } = seed();
    for (const app of SEED_APPLICATIONS) {
      const events = auditEvents.filter((e) => e.applicationId === app.applicationId);
      if (app.status === ApplicationStatus.Draft) {
        // a draft was never submitted: the trail has only the notes written on it (the rest of its
        // history is drawn from the application itself)
        expect(events.length).toBeGreaterThan(0);
        expect(events.every((e) => e.event === 'Comment added')).toBe(true);
      } else {
        expect(events[0].event).toBe('Application created');
        expect(events.map((e) => e.event)).toContain('Submitted');
      }
      const times = events.map((e) => Date.parse(e.at));
      expect(times.every((t) => !Number.isNaN(t))).toBe(true);
    }
    const ids = auditEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has an event for each seed comment, written by its author at its time', () => {
    const { auditEvents } = seed();
    const written = auditEvents.filter((e) => e.event === 'Comment added');
    expect(written).toHaveLength(SEED_COMMENTS.length);
    for (const comment of SEED_COMMENTS) {
      expect(written).toContainEqual(
        expect.objectContaining({
          applicationId: comment.applicationId,
          user: comment.author,
          at: comment.at,
          comment: comment.text,
        }),
      );
    }
  });

  it('logs the supporting files as "Attachment added", and the 12 forms files as "Document uploaded"', () => {
    const { auditEvents } = seed();
    const of = (event: string) =>
      auditEvents.filter((e) => e.applicationId === 'HL-2026-0001' && e.event === event);
    expect(of('Document uploaded')).toHaveLength(12);
    expect(of('Attachment added').map((e) => e.newValue)).toEqual([
      'Salary_Slip_Aug.pdf',
      'Electricity_Bill.pdf',
    ]);
    expect(of('Attachment added')[0]).toMatchObject({
      field: 'Supporting Document',
      comment: 'Latest salary slip, added after the first upload',
    });
  });

  it('has the decisions in the trail: approved twice, returned, rejected', () => {
    const { auditEvents } = seed();
    const of = (id: string) =>
      auditEvents.filter((e) => e.applicationId === id).map((e) => `${e.event}:${e.newValue}`);
    expect(of('HL-2026-0001')).toEqual(
      expect.arrayContaining(['Level 1 decision:Approved', 'Level 2 decision:Approved']),
    );
    expect(of('HL-2026-0004')).toEqual(
      expect.arrayContaining(['Level 1 decision:Returned', 'Returned:Returned']),
    );
    expect(of('HL-2026-0005')).toEqual(
      expect.arrayContaining(['Level 2 decision:Rejected', 'Rejected:Rejected']),
    );
    expect(of('HL-2026-0003')).not.toEqual(expect.arrayContaining(['Level 1 decision:Approved']));
  });

  it('says each old approved application had its record created and its files stored, in that order', () => {
    const { auditEvents, masterRecords } = seed();
    for (const id of ['HL-2026-0001', 'HL-2026-0006']) {
      const names = auditEvents.filter((e) => e.applicationId === id).map((e) => e.event);
      expect(names).toContain('Record created');
      expect(names).toContain('Files stored');
      expect(names.indexOf('Record created')).toBeLessThan(names.indexOf('Files stored'));
    }
    // the others were not approved: nothing was created or filed
    const others = auditEvents.filter(
      (e) => e.applicationId !== 'HL-2026-0001' && e.applicationId !== 'HL-2026-0006',
    );
    expect(others.some((e) => e.event === 'Record created' || e.event === 'Files stored')).toBe(
      false,
    );
    // ...but no master list entry was made for these: that tab holds the records the demo creates
    expect(masterRecords).toEqual([]);
  });

  it('counts every file of the application in the "Files stored" event, the supporting ones too', () => {
    const { auditEvents } = seed();
    const filed = (id: string) =>
      auditEvents.find((e) => e.applicationId === id && e.event === 'Files stored');
    // 12 documents of the form and 2 supporting files
    expect(filed('HL-2026-0001')).toMatchObject({
      user: 'System',
      field: '14 files',
      newValue: 'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0001 Vijay Kulkarni',
    });
    const meera = SEED_APPLICATIONS.find((a) => a.applicationId === 'HL-2026-0006')!;
    expect(filed('HL-2026-0006')?.field).toBe(`${meera.documents.length} files`);
  });

  it('has no Aadhaar number in it, only the masked KYC references', () => {
    const { workflowInstances, auditEvents, notifications } = seed();
    const text = JSON.stringify([workflowInstances, auditEvents, notifications]);
    expect(text).not.toMatch(/\d{12}/);
    expect(text).not.toMatch(/XXXX XXXX/);
  });

  it('files the documents of the approved seed application', () => {
    const vijay = SEED_APPLICATIONS.find((a) => a.applicationId === 'HL-2026-0001')!;
    expect(vijay.documents.length).toBeGreaterThan(0);
    expect(vijay.documents.every((d) => d.filing?.docTypeTag === d.docType)).toBe(true);
    expect(vijay.documents[0].filing?.folderPath).toMatch(
      /^Loans\/Home Loan\/Belagavi Main Branch \(demo\)\/HL-2026-0001 Vijay Kulkarni\/0[123] /,
    );
    // the two supporting files are filed with it, in the subfolder 05 Other
    const attachments = vijay.documents.filter((d) => d.docType === 'Supporting Document');
    expect(attachments).toHaveLength(2);
    expect(attachments.every((d) => d.filing?.folderPath.endsWith('/05 Other'))).toBe(true);
    // the others are still inside the workflow
    for (const app of SEED_APPLICATIONS.filter((a) => a.status !== ApplicationStatus.Approved)) {
      expect(app.documents.some((d) => d.filing)).toBe(false);
    }
  });
});

describe('addMissingWorkflow (for a saved copy from before the workflow)', () => {
  const empty = { workflowInstances: [], auditEvents: [], notifications: [] };

  it('gives every submitted application an instance and a trail, and the draft none', () => {
    const result = addMissingWorkflow(structuredClone(SEED_APPLICATIONS), empty);
    expect(result.workflowInstances).toHaveLength(6);
    expect(result.workflowInstances.map((i) => i.applicationId)).not.toContain('HL-2026-0007');
    expect(result.auditEvents.length).toBeGreaterThan(30);
  });

  it('treats an old "Submitted" application as waiting for the Branch Manager', () => {
    const app = {
      ...structuredClone(SEED_APPLICATIONS[2]),
      applicationId: 'HL-2026-0008',
      status: ApplicationStatus.Submitted,
    };
    const result = addMissingWorkflow([app], empty);
    expect(result.workflowInstances[0].nodes.map((n) => n.status)).toEqual([
      'Done',
      'Pending',
      'Waiting',
      'Waiting',
    ]);
  });

  it('leaves drafts alone', () => {
    const draft = {
      ...structuredClone(SEED_APPLICATIONS[2]),
      status: ApplicationStatus.Draft,
    };
    const kycDone = {
      ...draft,
      applicationId: 'HL-2026-0008',
      status: ApplicationStatus.KycDone,
    };
    const result = addMissingWorkflow([draft, kycDone], empty);
    expect(result.workflowInstances).toEqual([]);
  });

  it('does not touch an application that already has an instance, and numbers new ones on', () => {
    const base = buildSeedWorkflow(structuredClone(SEED_APPLICATIONS).slice(0, 2));
    const extra = { ...structuredClone(SEED_APPLICATIONS[2]), applicationId: 'HL-2026-0008' };
    const result = addMissingWorkflow(
      [...structuredClone(SEED_APPLICATIONS).slice(0, 2), extra],
      base,
    );
    expect(result.workflowInstances).toHaveLength(3);
    expect(result.workflowInstances.slice(0, 2)).toEqual(base.workflowInstances);
    expect(result.workflowInstances[2].id).toBe('WI-23445215');
    expect(result.auditEvents.slice(0, base.auditEvents.length)).toEqual(base.auditEvents);
  });

  it('is safe to run twice', () => {
    const once = addMissingWorkflow(structuredClone(SEED_APPLICATIONS), empty);
    const twice = addMissingWorkflow(structuredClone(SEED_APPLICATIONS), once);
    expect(twice).toEqual(once);
  });
});
