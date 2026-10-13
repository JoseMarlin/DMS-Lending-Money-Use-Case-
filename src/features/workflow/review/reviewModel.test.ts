import { SEED_APPLICATIONS } from '@/data/seed';
import { buildSeedWorkflow } from '@/data/seedWorkflow';
import { KycResult, type HomeLoanApplication, type WorkflowInstance } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import { resubmit, returnForCorrection, type WorkflowData } from '@/data/workflow';
import {
  applicationOfInstance,
  blockMessage,
  detailSections,
  headerTitle,
  kycBlock,
  levelOneDecision,
  progressSteps,
  submissionItems,
} from './reviewModel';

const { priya, mahesh, sunita, admin } = DEMO_USERS;

function seed(): WorkflowData {
  const applications = structuredClone(SEED_APPLICATIONS);
  return { applications, masterRecords: [], ...buildSeedWorkflow(applications) };
}

const instanceOf = (data: WorkflowData, n: number): WorkflowInstance =>
  data.workflowInstances.find((i) => i.id === `WI-${23445213 + n}`)!;
const appOf = (data: WorkflowData, instance: WorkflowInstance) =>
  data.applications.find((a) => a.applicationId === instance.applicationId)!;

// seed: +0 Vijay (completed), +1 Shobha (waits for Level 2), +2 Manjunath (waits for Level 1),
// +3 Savita, +4 Basavaraj (rejected at Level 2, KYC Exception)

describe('headerTitle', () => {
  it('writes the title as in the brief, with a colon before the name', () => {
    expect(headerTitle('Ramesh Patil')).toBe(
      'Form Submitted · Home Loan Application : Ramesh Patil',
    );
  });

  it('leaves the colon and the name out when there is no name', () => {
    expect(headerTitle('')).toBe('Form Submitted · Home Loan Application');
    expect(headerTitle('   ')).toBe('Form Submitted · Home Loan Application');
  });
});

describe('blockMessage', () => {
  const instance = instanceOf(seed(), 2);

  it('says who it waits for when the user has the wrong role', () => {
    expect(blockMessage({ code: 'wrong-role', error: '' }, instance)).toBe(
      'Waiting for Mahesh Joshi (Branch Manager). You have no action on this request.',
    );
  });

  it('says the request is finished, in the words of its status', () => {
    const done = { ...instance, status: 'Completed' as const };
    expect(blockMessage({ code: 'not-active', error: '' }, done)).toBe(
      'This request is completed, so nothing is waiting for action.',
    );
    const rejected = { ...instance, status: 'Rejected' as const };
    expect(blockMessage({ code: 'not-active', error: '' }, rejected)).toContain('rejected');
  });

  it('says it for the person who submitted it, and for a repeat approver', () => {
    expect(blockMessage({ code: 'own-instance', error: '' }, instance)).toBe(
      'You submitted this request, so you cannot act on it.',
    );
    expect(blockMessage({ code: 'same-approver', error: '' }, instance)).toBe(
      'You approved Level 1, so a different person has to decide at Level 2.',
    );
  });

  it('has a plain answer for anything else', () => {
    expect(blockMessage({ code: 'not-pending', error: '' }, instance)).toBe(
      'Nothing is waiting for action on this request.',
    );
    expect(blockMessage({ code: 'kyc-blocked', error: '' }, instance)).toBe(
      'You have no action on this request.',
    );
  });
});

describe('progressSteps', () => {
  it('Level 1 waiting, for the approver whose turn it is', () => {
    const steps = progressSteps(instanceOf(seed(), 2), true);
    expect(steps.map((s) => [s.index, s.name, s.state])).toEqual([
      [1, 'Initiator', 'done'],
      [2, 'Level 1: Branch Manager', 'current'],
      [3, 'Level 2: Credit Approver', 'upcoming'],
      [4, 'Record creation and filing', 'upcoming'],
    ]);
    expect(steps[0].chip).toEqual({ label: 'Submitted', tone: 'success' });
    expect(steps[0].who).toBe('Gokak loan officer (demo) · 5 Oct 2026, 10:45 AM');
    expect(steps[1].chip).toEqual({ label: 'Your approval required', tone: 'error' });
  });

  it('shows only the name of who it waits for on a node nobody has acted on', () => {
    const steps = progressSteps(instanceOf(seed(), 2), true);
    expect(steps[1].who).toBe('Mahesh Joshi');
    expect(steps[2].who).toBe('Sunita Hegde');
    expect(steps[3].who).toBe('System');
    expect(steps[2].chip).toBeNull();
    expect(steps[3].chip).toBeNull();
    expect(steps[1].comment).toBe('');
  });

  it('tells everybody else that it is waiting, not that their approval is required', () => {
    const steps = progressSteps(instanceOf(seed(), 2), false);
    expect(steps[1].state).toBe('current');
    expect(steps[1].chip).toEqual({ label: 'Waiting for approval', tone: 'warning' });
  });

  it('Level 2 waiting: Level 1 is done with its comment, who and when', () => {
    const steps = progressSteps(instanceOf(seed(), 1), true);
    expect(steps[1].state).toBe('done');
    expect(steps[1].chip).toEqual({ label: 'Approved', tone: 'success' });
    expect(steps[1].who).toBe('Mahesh Joshi · 17 Sep 2026, 11:00 AM');
    expect(steps[1].comment).toBe('Business income verified.');
    expect(steps[2].state).toBe('current');
  });

  it('completed: every node is done, and filing says Completed', () => {
    const steps = progressSteps(instanceOf(seed(), 0), false);
    expect(steps.every((s) => s.state === 'done')).toBe(true);
    expect(steps.map((s) => s.chip?.label)).toEqual([
      'Submitted',
      'Approved',
      'Approved',
      'Completed',
    ]);
  });

  it('rejected: the node that rejected says so in red, and nothing is current', () => {
    const steps = progressSteps(instanceOf(seed(), 4), false);
    expect(steps.some((s) => s.state === 'current')).toBe(false);
    expect(steps[2].chip).toEqual({ label: 'Rejected', tone: 'error' });
    expect(steps[2].comment).not.toBe('');
    expect(steps[3].state).toBe('upcoming');
  });

  it('returned: the node says Returned, in amber, and nothing is current', () => {
    const data = seed();
    const out = returnForCorrection(data, instanceOf(data, 2).id, mahesh, 'Add the sale deed.');
    if (!out.ok) throw new Error(out.error);
    const steps = progressSteps(out.instance, false);
    expect(steps[1].chip).toEqual({ label: 'Returned', tone: 'warning' });
    expect(steps[1].comment).toBe('Add the sale deed.');
    expect(steps.some((s) => s.state === 'current')).toBe(false);
  });
});

describe('progressSteps after a resubmit', () => {
  it('shows the initiator done again, with what he did, and Level 1 waiting again', () => {
    const data = seed();
    const returned = instanceOf(data, 3); // Savita, returned by Mahesh
    const outcome = resubmit(data, returned.id, priya, new Date('2026-10-12T10:00:00Z'));
    if (!outcome.ok) throw new Error(outcome.error);
    const steps = progressSteps(outcome.instance, false);
    expect(steps[0]).toMatchObject({
      state: 'done',
      actor: 'Priya Kulkarni',
      chip: { label: 'Submitted', tone: 'success' },
      comment: 'Resubmitted after correction',
    });
    expect(steps[1]).toMatchObject({
      state: 'current',
      actor: 'Mahesh Joshi',
      when: '',
      comment: '',
      chip: { label: 'Waiting for approval', tone: 'warning' },
    });
    expect(steps[2].state).toBe('upcoming');
    expect(steps[3].state).toBe('upcoming');
  });

  it('gives the Branch Manager the action again', () => {
    const data = seed();
    const outcome = resubmit(data, instanceOf(data, 3).id, priya, new Date('2026-10-12T10:00:00Z'));
    if (!outcome.ok) throw new Error(outcome.error);
    expect(progressSteps(outcome.instance, true)[1].chip).toEqual({
      label: 'Your approval required',
      tone: 'error',
    });
  });
});

describe('submissionItems', () => {
  it('lists what waits for the approver, with the applicant, Pending and the day it arrived', () => {
    expect(submissionItems(seed(), mahesh, '')).toEqual([
      {
        id: 'WI-23445215',
        applicantName: 'Manjunath Hiremath',
        applicationId: appOf(seed(), instanceOf(seed(), 2)).applicationId,
        status: 'Pending',
        date: '5 Oct, 26',
      },
    ]);
    expect(submissionItems(seed(), sunita, '').map((i) => i.applicantName)).toEqual([
      'Shobha Gaonkar',
    ]);
  });

  it('is empty for people who have nothing waiting', () => {
    expect(submissionItems(seed(), priya, '')).toEqual([]);
    expect(submissionItems(seed(), admin, '')).toEqual([]);
  });

  it('narrows by applicant, instance ID or Application ID, in any case', () => {
    const data = seed();
    const id = appOf(data, instanceOf(data, 2)).applicationId;
    expect(submissionItems(data, mahesh, 'manju')).toHaveLength(1);
    expect(submissionItems(data, mahesh, 'wi-23445215')).toHaveLength(1);
    expect(submissionItems(data, mahesh, id.toLowerCase())).toHaveLength(1);
    expect(submissionItems(data, mahesh, '  MANJU  ')).toHaveLength(1);
    expect(submissionItems(data, mahesh, 'zzz')).toEqual([]);
  });
});

describe('detailSections', () => {
  const data = seed();
  const manjunath = appOf(data, instanceOf(data, 2));
  const basavaraj = appOf(data, instanceOf(data, 4));
  const titles = (app: HomeLoanApplication) => detailSections(app).map((s) => s.title);
  const value = (app: HomeLoanApplication, label: string) =>
    detailSections(app)
      .flatMap((s) => s.rows)
      .find((r) => r.label === label)?.value;

  it('groups the rows like the form: Application, Applicant, Identity, Property, Sureties, Consent', () => {
    const list = titles(manjunath);
    expect(list).toEqual(
      expect.arrayContaining([
        'Application',
        'Applicant',
        'Identity',
        'Property',
        'Sureties',
        'Consent',
      ]),
    );
    expect(list.indexOf('Application')).toBeLessThan(list.indexOf('Applicant'));
    expect(list.indexOf('Identity')).toBeLessThan(list.indexOf('Property'));
    expect(list.indexOf('Sureties')).toBeLessThan(list.indexOf('Consent'));
    expect(list.at(-1)).toBe('Consent');
    expect(list).not.toContain('Property and security');
    expect(list).not.toContain('Documents');
  });

  it("uses the form's own labels", () => {
    expect(value(manjunath, 'Application ID')).toBe(manjunath.applicationId);
    expect(value(manjunath, 'Full Name (as per PAN)')).toBe('Manjunath Hiremath');
    expect(value(manjunath, 'Loan Amount Requested')).toBe('12,00,000');
    expect(value(manjunath, 'PAN')).toBe(manjunath.pan);
  });

  it('shows the Aadhaar masked, and masks one that was not', () => {
    expect(value(manjunath, 'Aadhaar')).toMatch(/^XXXX XXXX \d{4}$/);
    const leaky = { ...manjunath, aadhaar: '234123412346' };
    expect(value(leaky, 'Aadhaar')).toBe('XXXX XXXX 2346');
    const text = JSON.stringify(detailSections(leaky));
    expect(text).not.toContain('234123412346');
    expect(text).not.toMatch(/\d{4}[\s-]?\d{4}[\s-]?\d{4}/);
  });

  it('shows the GSTIN only for a Business or Professional applicant', () => {
    expect(value(basavaraj, 'GSTIN')).toMatch(/^\d{2}[A-Z0-9]{13}$/);
    expect(value(manjunath, 'GSTIN')).toBeUndefined();
  });

  it('has the Co-applicant section only when there is a co-applicant', () => {
    expect(titles(manjunath)).not.toContain('Co-applicant');
    expect(titles({ ...manjunath, addCoApplicant: true })).toContain('Co-applicant');
    expect(value(manjunath, 'Co-applicant Name')).toBeUndefined();
    const withOne = { ...manjunath, addCoApplicant: true, coApplicantName: 'Geeta Hiremath' };
    expect(value(withOne, 'Co-applicant Name')).toBe('Geeta Hiremath');
  });

  it('has the consent rows: given, and when', () => {
    const consent = detailSections(manjunath).find((s) => s.id === 'consent')!;
    expect(consent.rows.map((r) => r.label)).toEqual(['Consent Given', 'Consent Time']);
    expect(consent.rows[0].value).toBe('Yes');
    expect(consent.rows[1].value).toMatch(/^\d{1,2} [A-Z][a-z]{2} 2026, \d{1,2}:\d{2} (AM|PM)$/);
    const none = detailSections({ ...manjunath, consentGiven: false, consentTime: '' }).find(
      (s) => s.id === 'consent',
    )!;
    expect(none.rows.map((r) => r.value)).toEqual(['No', '—']);
  });
});

describe('kycBlock', () => {
  const base = appOf(seed(), instanceOf(seed(), 2));

  it('Pass: a green result, the match percent and the three statuses', () => {
    const kyc = kycBlock({
      ...base,
      kycOverallResult: KycResult.Pass,
      nameMatchPercent: 100,
      panStatus: 'Verified',
      aadhaarStatus: 'Verified',
      gstStatus: 'Not applicable',
    });
    expect(kyc.result).toBe('Pass');
    expect(kyc.tone).toBe('success');
    expect(kyc.rows).toEqual([
      { label: 'Name Match Percent', value: '100%' },
      { label: 'PAN Status', value: 'Verified' },
      { label: 'Aadhaar Status', value: 'Verified' },
      { label: 'GST Status', value: 'Not applicable' },
    ]);
    expect(kyc.remark).toBe('');
  });

  it("Exception: amber, with the loan officer's remark", () => {
    const kyc = kycBlock({
      ...base,
      kycOverallResult: KycResult.Exception,
      nameMatchPercent: 86,
      kycExceptionRemark: '  Middle initial missing.  ',
    });
    expect(kyc.tone).toBe('warning');
    expect(kyc.remark).toBe('Middle initial missing.');
    expect(kyc.rows[0].value).toBe('86%');
  });

  it('keeps a remark out of the block unless the result is Exception', () => {
    expect(
      kycBlock({ ...base, kycOverallResult: KycResult.Pass, kycExceptionRemark: 'old remark' })
        .remark,
    ).toBe('');
  });

  it('Fail is red; no result yet is neutral and says Not checked', () => {
    expect(kycBlock({ ...base, kycOverallResult: KycResult.Fail }).tone).toBe('error');
    const none = kycBlock({ ...base, kycOverallResult: '', nameMatchPercent: null });
    expect(none.result).toBe('Not checked');
    expect(none.tone).toBe('neutral');
    expect(none.rows[0].value).toBe('—');
  });
});

describe("levelOneDecision (the Credit approver's read-only row)", () => {
  const data = seed();

  it('gives the Level 1 decision, who, when and the comment to the Credit approver', () => {
    expect(levelOneDecision(instanceOf(data, 1), sunita)).toEqual({
      decision: 'Approved',
      by: 'Mahesh Joshi',
      at: '17 Sep 2026, 11:00 AM',
      comment: 'Business income verified.',
    });
  });

  it('gives nothing to anybody else', () => {
    for (const user of [priya, mahesh, admin]) {
      expect(levelOneDecision(instanceOf(data, 1), user)).toBeNull();
    }
  });

  it('gives nothing while Level 1 has not decided', () => {
    expect(levelOneDecision(instanceOf(data, 2), sunita)).toBeNull();
  });
});

describe('applicationOfInstance', () => {
  const data = seed();
  const instance = instanceOf(data, 2);

  it('finds the application in the working list', () => {
    expect(applicationOfInstance(data, instance)?.applicationId).toBe(instance.applicationId);
  });

  it('falls back to the master record once the application has moved there', () => {
    const app = appOf(data, instance);
    const moved = { applications: [], masterRecords: [app] };
    expect(applicationOfInstance(moved, instance)).toBe(app);
  });

  it('gives nothing when it is nowhere', () => {
    expect(
      applicationOfInstance({ applications: [], masterRecords: [] }, instance),
    ).toBeUndefined();
  });
});
