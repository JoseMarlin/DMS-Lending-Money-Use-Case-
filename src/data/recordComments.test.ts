import {
  MAX_COMMENT_LENGTH,
  addComment,
  commentThread,
  deleteComment,
  nextCommentId,
  roleChipOf,
  type CommentData,
} from './recordComments';
import { SEED_COMMENTS } from './seedComments';
import { SEED_APPLICATIONS } from './seed';
import { buildSeedWorkflow } from './seedWorkflow';
import type { AuditEvent, RecordComment } from './types';
import { DEMO_USERS } from './users';

const { priya, mahesh, sunita, admin } = DEMO_USERS;
const APPLICATION = 'HL-2026-0001';

const comment = (over: Partial<RecordComment> = {}): RecordComment => ({
  id: 'CM-00001',
  applicationId: APPLICATION,
  author: 'Priya Kulkarni',
  authorRole: 'Loan officer',
  text: 'Documents seen.',
  at: '2026-08-18T11:20:00+05:30',
  ...over,
});

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'AE-00001',
  applicationId: APPLICATION,
  event: 'Level 1 decision',
  user: 'Mahesh Joshi',
  at: '2026-08-21T10:00:00+05:30',
  comment: 'Documents are in order.',
  field: 'Level 1 Decision',
  oldValue: '',
  newValue: 'Approved',
  reference: '',
  ...over,
});

const data = (over: Partial<CommentData> = {}): CommentData => ({
  applications: [{ applicationId: APPLICATION }],
  masterRecords: [],
  recordComments: [],
  auditEvents: [],
  ...over,
});

describe('who a commenter is', () => {
  it('gives the role of a demo user, and a loan officer for the officers of other branches', () => {
    expect(roleChipOf('Priya Kulkarni')).toBe('Loan officer');
    expect(roleChipOf('Mahesh Joshi')).toBe('Branch Manager');
    expect(roleChipOf('Sunita Hegde')).toBe('Credit approver');
    expect(roleChipOf('Admin')).toBe('Administrator');
    expect(roleChipOf('Gokak loan officer (demo)')).toBe('Loan officer');
  });
});

describe('the thread of an application', () => {
  it('has its comments only, oldest first', () => {
    const thread = commentThread(
      [
        comment({ id: 'CM-00002', at: '2026-08-19T09:00:00+05:30', text: 'Second' }),
        comment({ id: 'CM-00001', at: '2026-08-18T09:00:00+05:30', text: 'First' }),
        comment({ id: 'CM-00003', applicationId: 'HL-2026-0002', text: 'Another loan' }),
      ],
      [],
      APPLICATION,
    );
    expect(thread.map((t) => t.text)).toEqual(['First', 'Second']);
    expect(thread.every((t) => t.kind === 'comment')).toBe(true);
  });

  it('has the comment of each decision of Level 1 and Level 2, as a decision with its outcome', () => {
    const thread = commentThread(
      [],
      [
        event(),
        event({
          id: 'AE-00002',
          event: 'Level 2 decision',
          user: 'Sunita Hegde',
          at: '2026-08-26T10:00:00+05:30',
          comment: 'Sanctioned as requested.',
          field: 'Level 2 Decision',
        }),
      ],
      APPLICATION,
    );
    expect(thread).toHaveLength(2);
    expect(thread[0]).toMatchObject({
      kind: 'decision',
      author: 'Mahesh Joshi',
      role: 'Branch Manager',
      text: 'Documents are in order.',
      decision: { label: 'Level 1 decision', outcome: 'Approved' },
    });
    expect(thread[1].decision).toEqual({ label: 'Level 2 decision', outcome: 'Approved' });
    expect(thread[1].role).toBe('Credit approver');
  });

  it('leaves out a decision with no comment, the other decision events, and other loans', () => {
    const thread = commentThread(
      [],
      [
        event({ comment: '   ' }),
        event({ id: 'AE-00002', event: 'Returned', field: 'Status', comment: 'Return note' }),
        event({ id: 'AE-00003', event: 'Submitted', comment: 'Sent' }),
        event({ id: 'AE-00004', applicationId: 'HL-2026-0002' }),
      ],
      APPLICATION,
    );
    expect(thread).toEqual([]);
  });

  it('puts the comments and the decisions in one line of time; at the same moment the comment is first', () => {
    const thread = commentThread(
      [
        comment({ id: 'CM-00001', at: '2026-08-21T10:00:00+05:30', text: 'Same moment' }),
        comment({ id: 'CM-00002', at: '2026-08-22T10:00:00+05:30', text: 'After' }),
      ],
      [event({ at: '2026-08-21T10:00:00+05:30' })],
      APPLICATION,
    );
    expect(thread.map((t) => t.text)).toEqual(['Same moment', 'Documents are in order.', 'After']);
  });
});

describe('adding a comment', () => {
  const now = new Date('2026-10-12T09:30:00+05:30');

  it('adds it as the user, trimmed, with the next id', () => {
    const out = addComment(data({ recordComments: [comment({ id: 'CM-00007' })] }), {
      applicationId: APPLICATION,
      text: '  Called the surety.  ',
      user: priya,
      now,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.comment).toEqual({
      id: 'CM-00008',
      applicationId: APPLICATION,
      author: 'Priya Kulkarni',
      authorRole: 'Loan officer',
      text: 'Called the surety.',
      at: now.toISOString(),
    });
    expect(out.recordComments.at(-1)).toBe(out.comment);
    expect(out.recordComments).toHaveLength(2);
  });

  it('writes "Comment added" to the audit trail, with who, when and what', () => {
    const out = addComment(data(), {
      applicationId: APPLICATION,
      text: 'Site visit on Friday.',
      user: mahesh,
      now,
    });
    if (!out.ok) throw new Error(out.error);
    expect(out.auditEvents).toHaveLength(1);
    expect(out.auditEvents[0]).toMatchObject({
      applicationId: APPLICATION,
      event: 'Comment added',
      user: 'Mahesh Joshi',
      at: now.toISOString(),
      comment: 'Site visit on Friday.',
    });
    expect(out.auditEvents[0].id).toMatch(/^AE-\d{5}$/);
  });

  it('keeps the ids of the trail going on from the ones there are', () => {
    const out = addComment(data({ auditEvents: [event({ id: 'AE-00041' })] }), {
      applicationId: APPLICATION,
      text: 'Noted',
      user: priya,
      now,
    });
    if (!out.ok) throw new Error(out.error);
    expect(out.auditEvents.map((e) => e.id)).toEqual(['AE-00041', 'AE-00042']);
  });

  it('masks an Aadhaar number in the text, in the comment and in the trail', () => {
    const out = addComment(data(), {
      applicationId: APPLICATION,
      text: 'Aadhaar given was 2345 0007 4821 and also 234500074821.',
      user: priya,
      now,
    });
    if (!out.ok) throw new Error(out.error);
    const all = JSON.stringify(out);
    expect(all).not.toMatch(/\d{4}\s?\d{4}\s?4821|2345\s?0007/);
    expect(out.comment.text).toContain('XXXX XXXX 4821');
    expect(out.auditEvents[0].comment).toContain('XXXX XXXX 4821');
  });

  it.each(['', '   ', '\n\t '])('refuses a comment with no text (%j)', (text) => {
    const out = addComment(data(), { applicationId: APPLICATION, text, user: priya, now });
    expect(out).toMatchObject({ ok: false, code: 'empty' });
  });

  it('refuses a comment over 1000 characters, and takes one of exactly 1000', () => {
    const long = addComment(data(), {
      applicationId: APPLICATION,
      text: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
      user: priya,
      now,
    });
    expect(long).toMatchObject({ ok: false, code: 'too-long' });
    const exact = addComment(data(), {
      applicationId: APPLICATION,
      text: 'x'.repeat(MAX_COMMENT_LENGTH),
      user: priya,
      now,
    });
    expect(exact.ok).toBe(true);
  });

  it('refuses an application that is not there, and finds one that is only a master record', () => {
    expect(
      addComment(data(), { applicationId: 'HL-2026-9999', text: 'Hi', user: priya, now }),
    ).toMatchObject({ ok: false, code: 'not-found' });
    const masterOnly = data({
      applications: [],
      masterRecords: [{ applicationId: APPLICATION }],
    });
    expect(
      addComment(masterOnly, { applicationId: APPLICATION, text: 'Hi', user: admin, now }).ok,
    ).toBe(true);
  });

  it('gives the administrator the chip Administrator, and an approver his own', () => {
    const one = addComment(data(), { applicationId: APPLICATION, text: 'A', user: admin, now });
    const two = addComment(data(), { applicationId: APPLICATION, text: 'B', user: sunita, now });
    if (!one.ok || !two.ok) throw new Error('refused');
    expect(one.comment.authorRole).toBe('Administrator');
    expect(two.comment.authorRole).toBe('Credit approver');
  });

  it('does not change the lists it was given', () => {
    const before = data({ recordComments: [comment()], auditEvents: [event()] });
    const copy = structuredClone(before);
    addComment(before, { applicationId: APPLICATION, text: 'Noted', user: priya, now });
    expect(before).toEqual(copy);
  });
});

describe('the id of a comment', () => {
  it('is CM-00001 for the first and goes on from the largest in use', () => {
    expect(nextCommentId([])).toBe('CM-00001');
    expect(nextCommentId([{ id: 'CM-00003' }, { id: 'CM-00011' }, { id: 'CM-00002' }])).toBe(
      'CM-00012',
    );
  });
});

describe('deleting a comment', () => {
  const list = [
    comment({ id: 'CM-00001', author: 'Priya Kulkarni' }),
    comment({ id: 'CM-00002', author: 'Mahesh Joshi', authorRole: 'Branch Manager' }),
  ];

  it('removes the comment of the user', () => {
    const out = deleteComment(list, 'CM-00001', priya);
    expect(out).toEqual({ ok: true, recordComments: [list[1]] });
  });

  it("refuses the comment of somebody else, the administrator's included", () => {
    expect(deleteComment(list, 'CM-00002', priya)).toMatchObject({ ok: false, code: 'not-yours' });
    expect(deleteComment(list, 'CM-00001', admin)).toMatchObject({ ok: false, code: 'not-yours' });
  });

  it('says so for a comment that is not there', () => {
    expect(deleteComment(list, 'CM-00099', priya)).toMatchObject({ ok: false, code: 'not-found' });
  });
});

describe('the seed comments', () => {
  const ids = SEED_APPLICATIONS.map((a) => a.applicationId);
  const workflow = buildSeedWorkflow(structuredClone(SEED_APPLICATIONS));

  it.each(ids)('%s has three or four notes', (id) => {
    const count = SEED_COMMENTS.filter((c) => c.applicationId === id).length;
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(4);
  });

  it('has ids CM-00001 onwards, in order of time, with no repeat', () => {
    expect(SEED_COMMENTS.map((c) => c.id)).toEqual(
      SEED_COMMENTS.map((_, i) => `CM-${String(i + 1).padStart(5, '0')}`),
    );
    const times = SEED_COMMENTS.map((c) => Date.parse(c.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('is written by people of the demo, with the chip of their role', () => {
    SEED_COMMENTS.forEach((c) => {
      expect(c.authorRole).toBe(roleChipOf(c.author));
    });
    const names = new Set(SEED_COMMENTS.map((c) => c.author));
    expect(names.has('Priya Kulkarni')).toBe(true);
    expect(names.has('Mahesh Joshi')).toBe(true);
  });

  it('comes after the application was made, and not in the future of the demo', () => {
    SEED_APPLICATIONS.forEach((app) => {
      const started = Date.parse(`${app.applicationDate}T00:00:00+05:30`);
      SEED_COMMENTS.filter((c) => c.applicationId === app.applicationId).forEach((c) => {
        expect(Date.parse(c.at)).toBeGreaterThanOrEqual(started);
        expect(Date.parse(c.at)).toBeLessThanOrEqual(Date.parse('2026-10-12T00:00:00+05:30'));
      });
    });
  });

  it('never has an Aadhaar number, a PAN or an email address', () => {
    SEED_COMMENTS.forEach((c) => {
      expect(c.text).not.toMatch(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
      expect(c.text).not.toMatch(/[A-Z]{5}\d{4}[A-Z]/);
      expect(c.text).not.toMatch(/@/);
    });
  });

  it('makes a thread with the approvers’ decisions among the notes, for an approved application', () => {
    const thread = commentThread(SEED_COMMENTS, workflow.auditEvents, 'HL-2026-0001');
    expect(thread.filter((t) => t.kind === 'decision').map((t) => t.decision?.label)).toEqual([
      'Level 1 decision',
      'Level 2 decision',
    ]);
    expect(thread.filter((t) => t.kind === 'comment').length).toBeGreaterThanOrEqual(3);
    const times = thread.map((t) => Date.parse(t.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
