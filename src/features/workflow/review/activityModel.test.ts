import { SEED_APPLICATIONS } from '@/data/seed';
import { SEED_COMMENTS } from '@/data/seedComments';
import { buildSeedWorkflow } from '@/data/seedWorkflow';
import type { AuditEvent } from '@/data/types';
import { activityEntries } from './activityModel';

function event(patch: Partial<AuditEvent> & Pick<AuditEvent, 'id' | 'event'>): AuditEvent {
  return {
    applicationId: 'HL-2026-0001',
    user: 'Priya Kulkarni',
    at: '2026-10-09T10:00:00+05:30',
    comment: '',
    field: '',
    oldValue: '',
    newValue: '',
    reference: '',
    ...patch,
  };
}

describe('activityEntries', () => {
  it('keeps only the events of the application', () => {
    const events = [
      event({ id: 'AE-1', event: 'Submitted' }),
      event({ id: 'AE-2', event: 'Submitted', applicationId: 'HL-2026-0002' }),
    ];
    expect(activityEntries(events, 'HL-2026-0001').map((e) => e.id)).toEqual(['AE-1']);
    expect(activityEntries(events, 'HL-2026-9999')).toEqual([]);
  });

  it('puts the newest first', () => {
    const events = [
      event({ id: 'AE-1', event: 'Submitted', at: '2026-10-09T10:00:00+05:30' }),
      event({ id: 'AE-2', event: 'Level 1 decision', at: '2026-10-09T12:00:00+05:30' }),
      event({ id: 'AE-3', event: 'Consent given', at: '2026-10-09T09:00:00+05:30' }),
    ];
    expect(activityEntries(events, 'HL-2026-0001').map((e) => e.id)).toEqual([
      'AE-2',
      'AE-1',
      'AE-3',
    ]);
  });

  it('puts the event written last first when the times are the same', () => {
    const same = '2026-10-09T10:00:00+05:30';
    const events = [
      event({ id: 'AE-1', event: 'KYC check run', at: same }),
      event({ id: 'AE-2', event: 'KYC check run', at: same }),
      event({ id: 'AE-3', event: 'KYC result set', at: same }),
    ];
    expect(activityEntries(events, 'HL-2026-0001').map((e) => e.id)).toEqual([
      'AE-3',
      'AE-2',
      'AE-1',
    ]);
  });

  it('writes who and when, in two parts and as one line', () => {
    const [entry] = activityEntries([event({ id: 'AE-1', event: 'Submitted' })], 'HL-2026-0001');
    expect(entry.title).toBe('Submitted');
    expect(entry.actor).toBe('Priya Kulkarni');
    expect(entry.when).toBe('9 Oct 2026, 10:00 AM');
    expect(entry.who).toBe('Priya Kulkarni · 9 Oct 2026, 10:00 AM');
  });

  it('shows what a field changed from and to', () => {
    const [entry] = activityEntries(
      [
        event({
          id: 'AE-1',
          event: 'Field changed',
          field: 'Mobile',
          oldValue: '9876500001',
          newValue: '9876500002',
        }),
      ],
      'HL-2026-0001',
    );
    expect(entry.details).toEqual(['Mobile: 9876500001 → 9876500002']);
  });

  it('shows a new value alone when there was no old one, and a value without a field', () => {
    const events = [
      event({ id: 'AE-1', event: 'Document uploaded', field: 'PAN Card', newValue: 'pan.pdf' }),
      event({ id: 'AE-2', event: 'Submitted', newValue: 'In Level 1' }),
      event({ id: 'AE-3', event: 'Consent given' }),
    ];
    const [consent, submitted, uploaded] = activityEntries(events, 'HL-2026-0001');
    expect(uploaded.details).toEqual(['PAN Card: pan.pdf']);
    expect(submitted.details).toEqual(['In Level 1']);
    expect(consent.details).toEqual([]);
  });

  it('writes an amount the Indian way', () => {
    const [entry] = activityEntries(
      [
        event({
          id: 'AE-1',
          event: 'Level 2 decision',
          field: 'Sanctioned Amount',
          oldValue: '1800000',
          newValue: '1750000',
        }),
      ],
      'HL-2026-0001',
    );
    expect(entry.details).toEqual(['Sanctioned Amount: 18,00,000 → 17,50,000']);
  });

  it('gives a decision its result as a chip and a coloured dot, and does not repeat it as a line', () => {
    const events = [
      event({
        id: 'AE-1',
        event: 'Level 1 decision',
        field: 'Level 1 Decision',
        newValue: 'Approved',
        comment: 'In order.',
      }),
      event({
        id: 'AE-2',
        event: 'Level 2 decision',
        field: 'Level 2 Decision',
        newValue: 'Rejected',
        comment: 'Income is low.',
      }),
      event({
        id: 'AE-3',
        event: 'Level 1 decision',
        field: 'Level 1 Decision',
        newValue: 'Returned',
        comment: 'Add a deed.',
      }),
    ];
    const [returned, rejected, approved] = activityEntries(events, 'HL-2026-0001');
    expect(approved.chip).toEqual({ label: 'Approved', tone: 'success' });
    expect(approved.tone).toBe('success');
    expect(approved.details).toEqual([]);
    expect(approved.comment).toBe('In order.');
    expect(rejected.chip).toEqual({ label: 'Rejected', tone: 'error' });
    expect(returned.chip).toEqual({ label: 'Returned', tone: 'warning' });
  });

  it('gives the rejected and returned events a chip too', () => {
    const events = [
      event({ id: 'AE-1', event: 'Rejected', newValue: 'Rejected', comment: 'No.' }),
      event({ id: 'AE-2', event: 'Returned', newValue: 'Returned', comment: 'Fix it.' }),
    ];
    const [returned, rejected] = activityEntries(events, 'HL-2026-0001');
    expect(rejected.chip?.label).toBe('Rejected');
    expect(returned.chip?.label).toBe('Returned');
  });

  it('gives a KYC result and a KYC check their outcome', () => {
    const events = [
      event({
        id: 'AE-1',
        event: 'KYC result set',
        user: 'System',
        field: 'KYC Overall Result',
        newValue: 'Exception',
        comment: 'Middle initial.',
      }),
      event({
        id: 'AE-2',
        event: 'KYC check run',
        user: 'System',
        field: 'PAN',
        newValue: 'Verified',
        reference: 'MOCK-PAN-000001',
      }),
    ];
    const [check, result] = activityEntries(events, 'HL-2026-0001');
    expect(result.chip).toEqual({ label: 'Exception', tone: 'warning' });
    expect(result.details).toEqual(['KYC Overall Result: Exception']);
    expect(result.comment).toBe('Middle initial.');
    expect(check.chip).toEqual({ label: 'Verified', tone: 'success' });
    expect(check.reference).toBe('MOCK-PAN-000001');
  });

  it('has no chip and a neutral dot for an event without a result', () => {
    const [entry] = activityEntries(
      [event({ id: 'AE-1', event: 'Workflow started', user: 'System', reference: 'WI-23445213' })],
      'HL-2026-0001',
    );
    expect(entry.chip).toBeNull();
    expect(entry.tone).toBe('neutral');
    expect(entry.reference).toBe('WI-23445213');
  });

  it('never shows an Aadhaar number in full, whichever text it is in', () => {
    const full = '234500074821';
    const [entry] = activityEntries(
      [
        event({
          id: 'AE-1',
          event: 'Field changed',
          user: `Typed ${full}`,
          field: 'Remarks',
          oldValue: `Aadhaar ${full}`,
          newValue: `Aadhaar 2345 0007 4821`,
          comment: `See ${full}`,
          reference: full,
        }),
      ],
      'HL-2026-0001',
    );
    const text = JSON.stringify(entry);
    expect(text).not.toContain(full);
    expect(text).not.toMatch(/\d{4}[\s-]?\d{4}[\s-]?\d{4}/);
    expect(entry.comment).toBe('See XXXX XXXX 4821');
    expect(entry.details[0]).toBe('Remarks: Aadhaar XXXX XXXX 4821 → Aadhaar XXXX XXXX 4821');
  });

  it('does not change the list it is given', () => {
    const events = [
      event({ id: 'AE-1', event: 'Submitted', at: '2026-10-09T09:00:00+05:30' }),
      event({ id: 'AE-2', event: 'Submitted', at: '2026-10-09T11:00:00+05:30' }),
    ];
    const copy = [...events];
    activityEntries(events, 'HL-2026-0001');
    expect(events).toEqual(copy);
  });
});

describe('the seeded trail of an approved application', () => {
  const applications = structuredClone(SEED_APPLICATIONS);
  const { auditEvents } = buildSeedWorkflow(applications);
  const vijay = applications.find((a) => a.fullNameAsPerPan === 'Vijay Kulkarni')!;
  const entries = activityEntries(auditEvents, vijay.applicationId);

  it('starts with the last comment, then the files stored and the record created, and ends with the application created', () => {
    // the comment of 27 Aug, after the approval, is the newest event
    expect(entries[0].title).toBe('Comment added');
    expect(entries[0].actor).toBe('Priya Kulkarni');
    expect(entries[0].comment).toContain('Sanction letter handed over');
    // the filing follows the approval by a second: the record, then the files (newest written first)
    expect(entries[1].title).toBe('Files stored');
    expect(entries[1].details[0]).toContain(`${vijay.documents.length} files:`);
    expect(entries[1].details[0]).toContain('14 files:'); // 12 documents + 2 attachments
    expect(entries[2].title).toBe('Record created');
    expect(entries.at(-1)?.title).toBe('Application created');
  });

  it('has one line for each comment of the application', () => {
    const comments = entries.filter((e) => e.title === 'Comment added');
    expect(comments).toHaveLength(
      SEED_COMMENTS.filter((c) => c.applicationId === 'HL-2026-0001').length,
    );
    expect(comments.map((c) => c.actor)).toEqual([
      'Priya Kulkarni',
      'Sunita Hegde',
      'Mahesh Joshi',
      'Priya Kulkarni',
    ]);
    expect(comments.every((c) => c.comment !== '')).toBe(true);
  });

  it('has both decisions, with their comments', () => {
    const decisions = entries.filter((e) => /decision$/.test(e.title));
    expect(decisions.map((d) => d.actor)).toEqual(['Sunita Hegde', 'Mahesh Joshi']);
    expect(decisions.map((d) => d.chip?.label)).toEqual(['Approved', 'Approved']);
    expect(decisions.every((d) => d.comment !== '')).toBe(true);
  });

  it('has a line for each uploaded document', () => {
    expect(entries.filter((e) => e.title === 'Document uploaded')).toHaveLength(12);
  });

  it('logs each attachment as "Attachment added", with its note, not as a document uploaded', () => {
    const attached = entries.filter((e) => e.title === 'Attachment added');
    expect(attached).toHaveLength(2);
    // newest first: the bill, then the salary slip
    expect(attached.map((e) => e.details[0])).toEqual([
      'Supporting Document: Electricity_Bill.pdf',
      'Supporting Document: Salary_Slip_Aug.pdf',
    ]);
    expect(attached.map((e) => e.actor)).toEqual(['Priya Kulkarni', 'Priya Kulkarni']);
    expect(attached.every((e) => e.comment !== '')).toBe(true);
  });
});

describe('the events of a rejection or a return, as the workflow writes them', () => {
  const same = '2026-10-09T15:00:00+05:30';
  const trail = (kind: 'Rejected' | 'Returned') => [
    event({
      id: 'AE-1',
      event: 'Level 2 decision',
      user: 'Sunita Hegde',
      at: same,
      field: 'Level 2 Decision',
      newValue: kind,
      comment: 'Income proof is thin.',
    }),
    event({
      id: 'AE-2',
      event: kind,
      user: 'Sunita Hegde',
      at: same,
      field: 'Status',
      oldValue: 'In Level 2',
      newValue: kind,
      comment: 'Income proof is thin.',
    }),
  ];

  it('shows the reason and the chip once, on the decision, and only the status on the other line', () => {
    for (const kind of ['Rejected', 'Returned'] as const) {
      const [status, decision] = activityEntries(trail(kind), 'HL-2026-0001');
      expect(decision.title).toBe('Level 2 decision');
      expect(decision.chip?.label).toBe(kind);
      expect(decision.comment).toBe('Income proof is thin.');
      expect(status.title).toBe(kind);
      expect(status.chip).toBeNull();
      expect(status.comment).toBe('');
      expect(status.details).toEqual([`Status: In Level 2 → ${kind}`]);
      expect(status.tone).toBe('neutral');
    }
  });

  it('keeps the chip and the comment of a Rejected event that has no decision beside it', () => {
    const [only] = activityEntries(
      [
        event({
          id: 'AE-1',
          event: 'Rejected',
          field: 'Status',
          oldValue: 'In Level 1',
          newValue: 'Rejected',
          comment: 'Not eligible.',
        }),
      ],
      'HL-2026-0001',
    );
    expect(only.chip?.label).toBe('Rejected');
    expect(only.comment).toBe('Not eligible.');
  });

  it('keeps both when the comments differ (they are two different things said)', () => {
    const events = trail('Rejected');
    events[1] = { ...events[1], comment: 'Something else.' };
    const [status] = activityEntries(events, 'HL-2026-0001');
    expect(status.comment).toBe('Something else.');
    expect(status.chip?.label).toBe('Rejected');
  });
});

describe('the sanctioned amount line', () => {
  it('shows an amount that did not change as a plain value, and a change as from and to', () => {
    const same = activityEntries(
      [
        event({
          id: 'AE-1',
          event: 'Level 2 decision',
          field: 'Sanctioned Amount',
          oldValue: '1800000',
          newValue: '1800000',
        }),
      ],
      'HL-2026-0001',
    );
    expect(same[0].details).toEqual(['Sanctioned Amount: 18,00,000']);
    const changed = activityEntries(
      [
        event({
          id: 'AE-1',
          event: 'Level 2 decision',
          field: 'Sanctioned Amount',
          oldValue: '1800000',
          newValue: '1500000',
        }),
      ],
      'HL-2026-0001',
    );
    expect(changed[0].details).toEqual(['Sanctioned Amount: 18,00,000 → 15,00,000']);
  });
});
