import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import type { AuditEvent, AuditEventName, HomeLoanApplication } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import {
  AUDIT_FILTERS,
  applyFilter,
  auditTimeline,
  categoryOf,
  filterCounts,
  groupByDay,
  itemOf,
  type AuditCategory,
} from './auditLogModel';

const [VIJAY, SHOBHA, , SAVITA, BASAVARAJ, MEERA, PRAKASH] = SEED_APPLICATIONS;

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'AE-00001',
  applicationId: 'HL-2026-0001',
  event: 'Field changed',
  user: 'Priya Kulkarni',
  at: '2026-10-12T10:00:00+05:30',
  comment: '',
  field: '',
  oldValue: '',
  newValue: '',
  reference: '',
  ...over,
});

const seedEvents = () => {
  useAppStore.getState().resetDemo();
  return useAppStore.getState().auditEvents;
};

describe('the filters', () => {
  it('are All, Data changes, Workflow, KYC, Files and Comments, in that order', () => {
    expect(AUDIT_FILTERS.map((f) => f.label)).toEqual([
      'All',
      'Data changes',
      'Workflow',
      'KYC',
      'Files',
      'Comments',
    ]);
  });

  it.each<[AuditEventName, AuditCategory]>([
    ['Application created', 'data'],
    ['Field changed', 'data'],
    ['Consent given', 'data'],
    ['KYC check run', 'kyc'],
    ['KYC result set', 'kyc'],
    ['Document uploaded', 'files'],
    ['Document replaced', 'files'],
    ['Document removed', 'files'],
    ['Attachment added', 'files'],
    ['Attachment removed', 'files'],
    ['Files stored', 'files'],
    ['Comment added', 'comments'],
    ['Submitted', 'workflow'],
    ['Workflow started', 'workflow'],
    ['Level 1 decision', 'workflow'],
    ['Level 2 decision', 'workflow'],
    ['Returned', 'workflow'],
    ['Resubmitted', 'workflow'],
    ['Rejected', 'workflow'],
    ['Record created', 'workflow'],
  ])('puts %s under %s', (name, category) => {
    expect(categoryOf(name)).toBe(category);
  });
});

describe('the wording of an event', () => {
  it('writes a change of a value as "from -> to", with the user and the role', () => {
    const item = itemOf(
      event({
        field: 'Monthly Income',
        oldValue: '₹ 75,000',
        newValue: '₹ 1,20,000',
        user: 'Priya Kulkarni',
      }),
    );
    expect(item).toMatchObject({
      title: 'Monthly Income changed',
      change: { from: '₹ 75,000', to: '₹ 1,20,000' },
      user: 'Priya Kulkarni',
      role: 'Loan officer',
      category: 'data',
      icon: 'edit',
    });
  });

  it('says "empty" for a value that was not there, or is gone', () => {
    expect(itemOf(event({ field: 'Email', oldValue: '', newValue: 'a@b.in' })).change).toEqual({
      from: 'empty',
      to: 'a@b.in',
    });
    expect(itemOf(event({ field: 'Email', oldValue: 'a@b.in', newValue: '' })).change).toEqual({
      from: 'a@b.in',
      to: 'empty',
    });
  });

  it('says that the administrator made the change, and gives the reason for it', () => {
    const item = itemOf(
      event({
        user: 'Admin',
        field: 'Mobile',
        newValue: '9000000001',
        comment: 'The applicant gave a new number',
      }),
    );
    expect(item.title).toBe('Mobile changed by the administrator');
    expect(item.reason).toBe('The applicant gave a new number');
    expect(item.role).toBe('Administrator');
    expect(item.tone).toBe('warning');
  });

  it('writes a sanctioned amount as rupees', () => {
    const item = itemOf(
      event({
        event: 'Level 2 decision',
        field: 'Sanctioned Amount',
        oldValue: '2000000',
        newValue: '1750000',
      }),
    );
    expect(item.title).toBe('Sanctioned amount set');
    expect(item.change).toEqual({ from: '₹ 20,00,000', to: '₹ 17,50,000' });
  });

  it('shows the outcome of each decision, with its comment', () => {
    const approved = itemOf(
      event({
        event: 'Level 1 decision',
        user: 'Mahesh Joshi',
        field: 'Level 1 Decision',
        newValue: 'Approved',
        comment: 'Documents are in order.',
      }),
    );
    expect(approved).toMatchObject({
      title: 'Level 1 decision: Approved',
      icon: 'approved',
      tone: 'success',
      role: 'Branch Manager',
    });
    expect(approved.details).toEqual(['Documents are in order.']);
    const returned = itemOf(
      event({ event: 'Level 1 decision', field: 'Level 1 Decision', newValue: 'Returned' }),
    );
    expect(returned).toMatchObject({ icon: 'returned', tone: 'warning' });
    const rejected = itemOf(
      event({ event: 'Level 2 decision', field: 'Level 2 Decision', newValue: 'Rejected' }),
    );
    expect(rejected).toMatchObject({
      title: 'Level 2 decision: Rejected',
      icon: 'rejected',
      tone: 'error',
    });
  });

  it('writes the KYC checks with the outcome and the mock reference, and the result with the remark', () => {
    const check = itemOf(
      event({
        event: 'KYC check run',
        user: 'System',
        field: 'PAN',
        newValue: 'Verified',
        reference: 'MOCK-PAN-000006',
      }),
    );
    expect(check).toMatchObject({ title: 'KYC check run: PAN', tone: 'success', role: '' });
    expect(check.details).toEqual(['Verified', 'Reference MOCK-PAN-000006']);
    const failed = itemOf(
      event({ event: 'KYC check run', user: 'System', field: 'PAN', newValue: 'Failed' }),
    );
    expect(failed.tone).toBe('error');
    const result = itemOf(
      event({
        event: 'KYC result set',
        user: 'System',
        field: 'KYC Overall Result',
        newValue: 'Exception',
        comment: 'The middle initial is missing',
      }),
    );
    expect(result).toMatchObject({ title: 'KYC result set: Exception', tone: 'warning' });
    expect(result.details).toEqual(['Remark: The middle initial is missing']);
  });

  it('writes the events of the files: a document, a replaced one, a removed one, an attachment', () => {
    expect(
      itemOf(event({ event: 'Document uploaded', field: 'PAN Card', newValue: 'PAN.pdf' })).title,
    ).toBe('Document uploaded: PAN Card');
    const replaced = itemOf(
      event({
        event: 'Document replaced',
        field: 'PAN Card',
        oldValue: 'old.pdf',
        newValue: 'new.pdf (v1.1)',
      }),
    );
    expect(replaced.title).toBe('Document replaced: PAN Card');
    expect(replaced.change).toEqual({ from: 'old.pdf', to: 'new.pdf (v1.1)' });
    const removed = itemOf(
      event({
        event: 'Document removed',
        field: 'GST Certificate or Business Licence',
        oldValue: 'gst.pdf',
      }),
    );
    expect(removed.details).toEqual(['gst.pdf']);
    const added = itemOf(
      event({
        event: 'Attachment added',
        field: 'Supporting Document',
        newValue: 'Bill.pdf',
        comment: 'Latest bill',
      }),
    );
    expect(added).toMatchObject({
      title: 'Attachment added',
      details: ['Bill.pdf', 'Latest bill'],
    });
    expect(itemOf(event({ event: 'Attachment removed', oldValue: 'Bill.pdf' })).details).toEqual([
      'Bill.pdf',
    ]);
  });

  it('writes the other events of the journey', () => {
    expect(
      itemOf(event({ event: 'Application created', newValue: 'HL-2026-0001' })).details,
    ).toEqual(['HL-2026-0001']);
    expect(itemOf(event({ event: 'Consent given' })).title).toBe('Consent given');
    expect(itemOf(event({ event: 'Submitted', newValue: 'In Level 1' })).title).toBe(
      'Submitted for approval',
    );
    expect(
      itemOf(
        event({
          event: 'Workflow started',
          newValue: 'Home Loan Approval',
          reference: 'WI-23445213',
        }),
      ).details,
    ).toEqual(['Home Loan Approval', 'WI-23445213']);
    expect(itemOf(event({ event: 'Returned', comment: 'Upload a clear copy' })).title).toBe(
      'Returned for correction',
    );
    expect(
      itemOf(event({ event: 'Resubmitted', oldValue: 'Returned', newValue: 'In Level 1' })).details,
    ).toEqual(['Returned → In Level 1']);
    expect(itemOf(event({ event: 'Rejected', comment: 'Not enough income' })).tone).toBe('error');
    expect(itemOf(event({ event: 'Record created', newValue: 'Approved' })).title).toBe(
      'Record created',
    );
    expect(
      itemOf(
        event({ event: 'Files stored', field: '14 files', newValue: 'Loans/Home Loan/B/HL-1 V' }),
      ).details,
    ).toEqual(['14 files stored in', 'Loans/Home Loan/B/HL-1 V']);
    expect(itemOf(event({ event: 'Comment added', comment: 'Called the surety' })).details).toEqual(
      ['Called the surety'],
    );
  });

  it('masks an Aadhaar number wherever one could be in the text', () => {
    const item = itemOf(
      event({
        event: 'Comment added',
        comment: 'Customer gave 2345 0007 4821 on the phone',
        field: 'x 234500074821',
        oldValue: '234500074821',
        newValue: 'n 2345-0007-4821',
      }),
    );
    expect(JSON.stringify(item)).not.toMatch(/2345[ -]?0007|234500074821/);
  });
});

describe('the timeline of an application', () => {
  it('has the events of that application only, newest first', () => {
    const items = auditTimeline(VIJAY, seedEvents());
    const times = items.map((i) => Date.parse(i.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(items.length).toBeGreaterThan(20);
    const stored = useAppStore
      .getState()
      .auditEvents.filter((e) => e.applicationId === VIJAY.applicationId);
    expect(items).toHaveLength(stored.length);
  });

  it('has the whole history of an approved application', () => {
    const titles = auditTimeline(VIJAY, seedEvents()).map((i) => i.title);
    for (const wanted of [
      'Application created',
      'Document uploaded: PAN Card',
      'Attachment added',
      'Consent given',
      'KYC check run: PAN',
      'KYC check run: Aadhaar',
      'KYC result set: Pass',
      'Submitted for approval',
      'Workflow started',
      'Level 1 decision: Approved',
      'Level 2 decision: Approved',
      'Record created',
      'Files stored',
      'Comment added',
    ]) {
      expect(titles).toContain(wanted);
    }
  });

  it.each([
    ['a second approved one', MEERA, ['Record created', 'Files stored']],
    ['one in Level 2', SHOBHA, ['Level 1 decision: Approved', 'Workflow started']],
    ['a returned one', SAVITA, ['Level 1 decision: Returned', 'Returned for correction']],
    ['a rejected one', BASAVARAJ, ['Level 2 decision: Rejected', 'Rejected']],
  ])('has the history of %s', (_name, app, wanted) => {
    const titles = auditTimeline(app, seedEvents()).map((i) => i.title);
    for (const title of wanted) expect(titles).toContain(title);
  });

  it('has no Record created or Files stored for an application that was not approved', () => {
    for (const app of [SHOBHA, SAVITA, BASAVARAJ]) {
      const titles = auditTimeline(app, seedEvents()).map((i) => i.title);
      expect(titles).not.toContain('Record created');
      expect(titles).not.toContain('Files stored');
    }
  });

  it('draws the history of a draft from its own data: created, each document, the attachment, and the comments', () => {
    const items = auditTimeline(PRAKASH, seedEvents());
    const titles = items.map((i) => i.title);
    expect(titles).toContain('Application created');
    expect(titles.filter((t) => t.startsWith('Document uploaded'))).toHaveLength(3);
    expect(titles).toContain('Attachment added');
    expect(titles.filter((t) => t === 'Comment added')).toHaveLength(3);
    // not submitted: no workflow, no consent, no checks
    expect(titles).not.toContain('Submitted for approval');
    expect(titles).not.toContain('Consent given');
    expect(titles.some((t) => t.startsWith('KYC'))).toBe(false);
  });

  it('does not write an attachment twice for a draft whose attachment is already in the trail', () => {
    const logged = event({
      id: 'AE-90001',
      applicationId: PRAKASH.applicationId,
      event: 'Attachment added',
      field: 'Supporting Document',
      newValue: 'Electricity_Bill.pdf',
    });
    const items = auditTimeline(PRAKASH, [logged]);
    expect(items.filter((i) => i.title === 'Attachment added')).toHaveLength(1);
  });

  it('is empty for an application with no events and nothing of its own', () => {
    const blank: HomeLoanApplication = {
      ...PRAKASH,
      documents: [],
      consentGiven: false,
      kycOverallResult: '',
    };
    const items = auditTimeline(blank, []);
    expect(items.map((i) => i.title)).toEqual(['Application created']);
  });

  it('puts the later event first when two have the same time', () => {
    const items = auditTimeline(VIJAY, [
      event({
        id: 'AE-1',
        applicationId: VIJAY.applicationId,
        event: 'Application created',
        at: '2026-08-18T10:00:00+05:30',
      }),
      event({
        id: 'AE-2',
        applicationId: VIJAY.applicationId,
        event: 'Comment added',
        comment: 'first',
        at: '2026-10-12T10:00:00+05:30',
      }),
      event({
        id: 'AE-3',
        applicationId: VIJAY.applicationId,
        event: 'Comment added',
        comment: 'second',
        at: '2026-10-12T10:00:00+05:30',
      }),
    ]);
    expect(items.map((i) => i.details[0] ?? i.title)).toEqual(
      ['second', 'first', 'HL-2026-0001'].slice(0, 2).concat(['Application created']),
    );
  });
});

describe('the counts and the filter', () => {
  const items = auditTimeline(VIJAY, seedEvents());

  it('count each filter, and All is the sum', () => {
    const counts = filterCounts(items);
    expect(counts.all).toBe(items.length);
    expect(counts.data + counts.workflow + counts.kyc + counts.files + counts.comments).toBe(
      items.length,
    );
    expect(counts.kyc).toBe(3);
    expect(counts.comments).toBe(4);
    expect(counts.workflow).toBeGreaterThanOrEqual(5);
  });

  it('keep the items of one category, and everything for All', () => {
    expect(applyFilter(items, 'all')).toBe(items);
    const kyc = applyFilter(items, 'kyc');
    expect(kyc).toHaveLength(filterCounts(items).kyc);
    expect(kyc.every((i) => i.category === 'kyc')).toBe(true);
  });
});

describe('the days', () => {
  const at = (iso: string): ReturnType<typeof itemOf> => itemOf(event({ at: iso }));

  it('group the items by day, newest day first, and keep each day newest first', () => {
    const items = [
      at('2026-10-12T15:00:00+05:30'),
      at('2026-10-12T09:00:00+05:30'),
      at('2026-10-11T18:00:00+05:30'),
    ];
    const groups = groupByDay(items, new Date('2026-10-20T10:00:00+05:30'));
    expect(groups.map((g) => g.label)).toEqual(['12 Oct 2026', '11 Oct 2026']);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].items.map((i) => i.at)).toEqual([items[0].at, items[1].at]);
  });

  it('say Today and Yesterday', () => {
    const items = [
      at('2026-10-12T15:00:00+05:30'),
      at('2026-10-11T18:00:00+05:30'),
      at('2026-10-01T10:00:00+05:30'),
    ];
    const groups = groupByDay(items, new Date('2026-10-12T20:00:00+05:30'));
    expect(groups.map((g) => g.label)).toEqual([
      'Today, 12 Oct 2026',
      'Yesterday, 11 Oct 2026',
      '1 Oct 2026',
    ]);
  });

  it('give no groups for no items', () => {
    expect(groupByDay([], new Date())).toEqual([]);
  });
});

describe('the roles', () => {
  it('are the ones of the demo users, a loan officer for the other branches, and none for the system', () => {
    expect(itemOf(event({ user: DEMO_USERS.sunita.name })).role).toBe('Credit approver');
    expect(itemOf(event({ user: 'Gokak loan officer (demo)' })).role).toBe('Loan officer');
    expect(itemOf(event({ user: 'System' })).role).toBe('');
  });
});
