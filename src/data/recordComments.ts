/**
 * The comments of the record sheet's side panel, as plain functions (no React, no store): who a
 * commenter is, what a thread is made of (the comments of the application and, taken from the
 * audit trail, the comments of the two approvers' decisions), adding a comment and deleting one's own.
 * The Aadhaar number never stays in a comment: it is masked on its way in.
 */
import { maskAadhaarInText } from './aadhaar';
import type { AuditEvent, DemoUser, HomeLoanApplication, RecordComment, UserRole } from './types';
import { DEMO_USERS } from './users';
import { withEventIds } from './workflow';

/** The longest comment, in characters. */
export const MAX_COMMENT_LENGTH = 1000;

/** What a role is called on a chip. */
export const ROLE_CHIP: Record<UserRole, string> = {
  loanOfficer: 'Loan officer',
  branchManager: 'Branch Manager',
  creditApprover: 'Credit approver',
  admin: 'Administrator',
};

/** The chip of a person by name: a demo user's role, else a loan officer (the officers of other branches). */
export function roleChipOf(name: string): string {
  const user = Object.values(DEMO_USERS).find((u) => u.name === name);
  return user ? ROLE_CHIP[user.role] : 'Loan officer';
}

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

export type DecisionLabel = 'Level 1 decision' | 'Level 2 decision';

/** One entry of the thread: a comment, or the comment that came with an approver's decision. */
export interface ThreadItem {
  id: string;
  kind: 'comment' | 'decision';
  author: string;
  /** The text of the role chip */
  role: string;
  /** ISO date and time */
  at: string;
  text: string;
  /** For a decision: which one, and what it was (Approved, Returned or Rejected) */
  decision?: { label: DecisionLabel; outcome: string };
}

/**
 * The thread of an application, oldest first: its comments and, from the audit trail, each decision
 * of Level 1 and Level 2 that was given with a comment. A decision at the same moment as a comment
 * comes after it.
 */
export function commentThread(
  comments: RecordComment[],
  auditEvents: AuditEvent[],
  applicationId: string,
): ThreadItem[] {
  const written = comments
    .filter((c) => c.applicationId === applicationId)
    .map((c): ThreadItem => ({
      id: c.id,
      kind: 'comment',
      author: c.author,
      role: c.authorRole,
      at: c.at,
      text: c.text,
    }));
  const decided = auditEvents
    .filter(
      (e) =>
        e.applicationId === applicationId &&
        (e.event === 'Level 1 decision' || e.event === 'Level 2 decision') &&
        /decision$/i.test(e.field) &&
        e.comment.trim() !== '',
    )
    .map((e): ThreadItem => ({
      id: `decision-${e.id}`,
      kind: 'decision',
      author: e.user,
      role: roleChipOf(e.user),
      at: e.at,
      text: e.comment,
      decision: { label: e.event as DecisionLabel, outcome: e.newValue },
    }));
  return [...written, ...decided]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byTime = Date.parse(a.item.at) - Date.parse(b.item.at);
      if (byTime !== 0) return byTime;
      return a.item.kind === b.item.kind ? a.index - b.index : a.item.kind === 'comment' ? -1 : 1;
    })
    .map(({ item }) => item);
}

// ---------------------------------------------------------------------------
// Adding and deleting
// ---------------------------------------------------------------------------

/** The data these functions work on (a part of the store's). */
export interface CommentData {
  applications: Pick<HomeLoanApplication, 'applicationId'>[];
  masterRecords: Pick<HomeLoanApplication, 'applicationId'>[];
  recordComments: RecordComment[];
  auditEvents: AuditEvent[];
}

export type CommentErrorCode = 'not-found' | 'empty' | 'too-long' | 'not-yours';

export type AddCommentOutcome =
  | { ok: true; recordComments: RecordComment[]; auditEvents: AuditEvent[]; comment: RecordComment }
  | { ok: false; code: CommentErrorCode; error: string };

export type DeleteCommentOutcome =
  | { ok: true; recordComments: RecordComment[] }
  | { ok: false; code: CommentErrorCode; error: string };

/** The next id of a comment: the largest number in use plus one. */
export function nextCommentId(comments: Pick<RecordComment, 'id'>[]): string {
  const last = comments.reduce((max, c) => {
    const n = Number(c.id.replace(/^CM-/, ''));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `CM-${String(last + 1).padStart(5, '0')}`;
}

/**
 * Adds a comment by this user to an application. The text is trimmed and masked, and the trail gets
 * "Comment added". Refused for an empty text, one over 1000 characters, or an application that is not there.
 */
export function addComment(
  data: CommentData,
  input: { applicationId: string; text: string; user: DemoUser; now?: Date },
): AddCommentOutcome {
  const { applicationId, user, now = new Date() } = input;
  const exists = [...data.applications, ...data.masterRecords].some(
    (a) => a.applicationId === applicationId,
  );
  if (!exists) {
    return { ok: false, code: 'not-found', error: `There is no application ${applicationId}` };
  }
  // the limit is that of what was typed: a number that is masked grows by two characters
  const typed = input.text.trim();
  const text = maskAadhaarInText(typed);
  if (text === '') return { ok: false, code: 'empty', error: 'Write a comment first' };
  if (typed.length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      code: 'too-long',
      error: `A comment can have at most ${MAX_COMMENT_LENGTH} characters`,
    };
  }
  const at = now.toISOString();
  const comment: RecordComment = {
    id: nextCommentId(data.recordComments),
    applicationId,
    author: user.name,
    authorRole: ROLE_CHIP[user.role],
    text,
    at,
  };
  const events = withEventIds(data.auditEvents, [
    { applicationId, event: 'Comment added', user: user.name, at, comment: text },
  ]);
  return {
    ok: true,
    recordComments: [...data.recordComments, comment],
    auditEvents: [...data.auditEvents, ...events],
    comment,
  };
}

/** Deletes a comment. Only its author can: a person deletes their own comments, and nobody else's. */
export function deleteComment(
  comments: RecordComment[],
  commentId: string,
  user: DemoUser,
): DeleteCommentOutcome {
  const comment = comments.find((c) => c.id === commentId);
  if (!comment)
    return { ok: false, code: 'not-found', error: 'This comment is not there any more' };
  if (comment.author !== user.name) {
    return { ok: false, code: 'not-yours', error: 'You can delete only your own comments' };
  }
  return { ok: true, recordComments: comments.filter((c) => c.id !== commentId) };
}
