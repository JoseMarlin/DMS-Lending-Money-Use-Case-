/**
 * What the Audit Log panel of the record sheet shows, as plain functions: the events of one
 * application from the store (and, for a draft that was never submitted, the ones that its own data
 * tells: created, each document, the consent, the checks), worded for a person, in a timeline of the
 * newest first, grouped by day, with the filters and their counts. The Aadhaar number is never in
 * an event, and is masked once more here.
 */
import { maskAadhaarInText } from '@/data/aadhaar';
import { roleChipOf } from '@/data/recordComments';
import type { AuditEvent, AuditEventName, HomeLoanApplication } from '@/data/types';
import { draftKycTime, formAuditEvents, withoutLoggedEvents } from '@/data/workflow';
import { formatIndianNumber, formatListDate } from '@/lib/format';

export type AuditFilter = 'all' | 'data' | 'workflow' | 'kyc' | 'files' | 'comments';
export type AuditCategory = Exclude<AuditFilter, 'all'>;

export const AUDIT_FILTERS: readonly { id: AuditFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'data', label: 'Data changes' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'kyc', label: 'KYC' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
];

/** Which filter an event belongs to. */
export function categoryOf(event: AuditEventName): AuditCategory {
  switch (event) {
    case 'Application created':
    case 'Field changed':
    case 'Consent given':
      return 'data';
    case 'KYC check run':
    case 'KYC result set':
      return 'kyc';
    case 'Document uploaded':
    case 'Document replaced':
    case 'Document removed':
    case 'Attachment added':
    case 'Attachment removed':
    case 'Files stored':
      return 'files';
    case 'Comment added':
      return 'comments';
    default:
      return 'workflow';
  }
}

/** The icon of an event: one for each kind of thing that happens. */
export type AuditIcon =
  | 'created'
  | 'edit'
  | 'consent'
  | 'file'
  | 'kyc'
  | 'comment'
  | 'submit'
  | 'workflow'
  | 'approved'
  | 'returned'
  | 'rejected'
  | 'record';

export type AuditTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface TimelineItem {
  id: string;
  /** ISO date and time */
  at: string;
  category: AuditCategory;
  icon: AuditIcon;
  tone: AuditTone;
  /** "Document uploaded: PAN Card" */
  title: string;
  /** Who did it, and their role ('' for the system) */
  user: string;
  role: string;
  /** The lines under the title: a file name, a comment, a reference */
  details: string[];
  /** For a change of a value: what it was and became, written for the line "old → new" */
  change?: { from: string; to: string };
  /** The reason for a change that the administrator made */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

const AMOUNT_FIELDS = new Set(['Sanctioned Amount']);

const masked = (text: string) => maskAadhaarInText(text);

/** An amount that the trail holds as digits, written as rupees. */
function valueText(field: string, value: string): string {
  if (AMOUNT_FIELDS.has(field) && /^\d+$/.test(value))
    return `₹ ${formatIndianNumber(Number(value))}`;
  return masked(value);
}

/** The line "was → became", for an event that carries both. */
function changeOf(e: AuditEvent): { from: string; to: string } | undefined {
  if (!e.oldValue && !e.newValue) return undefined;
  return {
    from: e.oldValue ? valueText(e.field, e.oldValue) : 'empty',
    to: e.newValue ? valueText(e.field, e.newValue) : 'empty',
  };
}

const lines = (...parts: (string | undefined)[]): string[] =>
  parts.filter((part): part is string => Boolean(part && part.trim())).map(masked);

/** The item of one event of the trail. */
export function itemOf(e: AuditEvent): TimelineItem {
  const base = {
    id: e.id,
    at: e.at,
    category: categoryOf(e.event),
    user: e.user,
    role: e.user === 'System' ? '' : roleChipOf(e.user),
  };
  switch (e.event) {
    case 'Application created':
      return {
        ...base,
        icon: 'created',
        tone: 'info',
        title: 'Application created',
        details: lines(e.newValue),
      };
    case 'Field changed': {
      // the consent ticked in the record sheet reads as it does when the form logs it
      if (e.field === 'Consent' && /^(yes|given|true)$/i.test(e.newValue.trim())) {
        return { ...base, icon: 'consent', tone: 'success', title: 'Consent given', details: [] };
      }
      // an edit of an approved record by the administrator carries the reason that was asked for
      const admin = e.user === 'Admin';
      // the trail never holds an Aadhaar number, so a changed one has no "old -> new" to show
      const aadhaar = e.field === 'Aadhaar';
      return {
        ...base,
        icon: 'edit',
        tone: admin ? 'warning' : 'info',
        title: admin ? `${e.field} changed by the administrator` : `${e.field} changed`,
        details: aadhaar ? ['The number is kept masked and is not shown'] : [],
        change: aadhaar ? undefined : changeOf(e),
        ...(e.comment.trim() ? { reason: masked(e.comment.trim()) } : {}),
      };
    }
    case 'Consent given':
      return { ...base, icon: 'consent', tone: 'success', title: 'Consent given', details: [] };
    case 'Document uploaded':
      return {
        ...base,
        icon: 'file',
        tone: 'info',
        title: `Document uploaded: ${e.field}`,
        details: lines(e.newValue),
        ...(e.comment.trim() ? { reason: masked(e.comment.trim()) } : {}),
      };
    case 'Document replaced':
      return {
        ...base,
        icon: 'file',
        tone: 'info',
        title: `Document replaced: ${e.field}`,
        details: lines(e.newValue),
        change: e.oldValue ? { from: masked(e.oldValue), to: masked(e.newValue) } : undefined,
        ...(e.comment.trim() ? { reason: masked(e.comment.trim()) } : {}),
      };
    case 'Document removed':
      return {
        ...base,
        icon: 'file',
        tone: 'warning',
        title: `Document removed: ${e.field}`,
        details: lines(e.oldValue),
        ...(e.comment.trim() ? { reason: masked(e.comment.trim()) } : {}),
      };
    case 'Attachment added':
      return {
        ...base,
        icon: 'file',
        tone: 'info',
        title: 'Attachment added',
        details: lines(e.newValue, e.comment),
      };
    case 'Attachment removed':
      return {
        ...base,
        icon: 'file',
        tone: 'warning',
        title: 'Attachment removed',
        details: lines(e.oldValue),
      };
    case 'KYC check run':
      return {
        ...base,
        icon: 'kyc',
        tone: e.newValue === 'Verified' ? 'success' : e.newValue === 'Failed' ? 'error' : 'warning',
        title: `KYC check run: ${e.field}`,
        details: lines(e.newValue, e.reference ? `Reference ${e.reference}` : ''),
      };
    case 'KYC result set':
      return {
        ...base,
        icon: 'kyc',
        tone: e.newValue === 'Pass' ? 'success' : e.newValue === 'Fail' ? 'error' : 'warning',
        title: `KYC result set: ${e.newValue}`,
        details: lines(e.comment ? `Remark: ${e.comment}` : ''),
      };
    case 'Submitted':
      return {
        ...base,
        icon: 'submit',
        tone: 'info',
        title: 'Submitted for approval',
        details: lines(e.newValue ? `Status ${e.newValue}` : ''),
      };
    case 'Workflow started':
      return {
        ...base,
        icon: 'workflow',
        tone: 'neutral',
        title: 'Workflow started',
        details: lines(e.newValue, e.reference),
      };
    case 'Level 1 decision':
    case 'Level 2 decision': {
      if (e.field === 'Sanctioned Amount') {
        return {
          ...base,
          icon: 'approved',
          tone: 'success',
          title: 'Sanctioned amount set',
          details: [],
          change: changeOf(e),
        };
      }
      const level = e.event === 'Level 1 decision' ? 'Level 1' : 'Level 2';
      const tone: AuditTone =
        e.newValue === 'Approved' ? 'success' : e.newValue === 'Rejected' ? 'error' : 'warning';
      return {
        ...base,
        icon:
          e.newValue === 'Approved'
            ? 'approved'
            : e.newValue === 'Rejected'
              ? 'rejected'
              : 'returned',
        tone,
        title: `${level} decision: ${e.newValue}`,
        details: lines(e.comment),
      };
    }
    case 'Returned':
      return {
        ...base,
        icon: 'returned',
        tone: 'warning',
        title: 'Returned for correction',
        details: lines(e.comment),
      };
    case 'Resubmitted':
      return {
        ...base,
        icon: 'submit',
        tone: 'info',
        title: 'Resubmitted for approval',
        details: lines(e.oldValue && e.newValue ? `${e.oldValue} → ${e.newValue}` : '', e.comment),
      };
    case 'Rejected':
      return {
        ...base,
        icon: 'rejected',
        tone: 'error',
        title: 'Rejected',
        details: lines(e.comment),
      };
    case 'Record created':
      return {
        ...base,
        icon: 'record',
        tone: 'success',
        title: 'Record created',
        details: lines(e.newValue ? `Status ${e.newValue}` : ''),
      };
    case 'Files stored':
      return {
        ...base,
        icon: 'file',
        tone: 'success',
        title: 'Files stored',
        details: lines(e.field ? `${e.field} stored in` : '', e.newValue),
      };
    case 'Comment added':
      return {
        ...base,
        icon: 'comment',
        tone: 'neutral',
        title: 'Comment added',
        details: lines(e.comment),
      };
  }
}

// ---------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------

/**
 * The events of an application, newest first. A draft that was never submitted has no events in the
 * store but the ones that were logged on it (a comment, an attachment): the rest is told by the
 * application's own data, as the form would have written it (created, each document, the consent,
 * the checks).
 */
export function auditTimeline(
  application: HomeLoanApplication,
  events: AuditEvent[],
): TimelineItem[] {
  const own = events.filter((e) => e.applicationId === application.applicationId);
  const submitted = own.some((e) => e.event === 'Application created');
  const drawn: AuditEvent[] = submitted
    ? []
    : withoutLoggedEvents(formAuditEvents(application, draftKycTime(application)), own).map(
        (e, index) => ({
          id: `draft-${index + 1}`,
          comment: '',
          field: '',
          oldValue: '',
          newValue: '',
          reference: '',
          ...e,
        }),
      );
  return [...drawn, ...own]
    .map((event, order) => ({ item: itemOf(event), order }))
    .sort((a, b) => {
      const byTime = Date.parse(b.item.at) - Date.parse(a.item.at);
      return byTime !== 0 ? byTime : b.order - a.order;
    })
    .map(({ item }) => item);
}

/** How many items each filter has, "All" included. */
export function filterCounts(items: TimelineItem[]): Record<AuditFilter, number> {
  const counts: Record<AuditFilter, number> = {
    all: items.length,
    data: 0,
    workflow: 0,
    kyc: 0,
    files: 0,
    comments: 0,
  };
  for (const item of items) counts[item.category] += 1;
  return counts;
}

export function applyFilter(items: TimelineItem[], filter: AuditFilter): TimelineItem[] {
  return filter === 'all' ? items : items.filter((item) => item.category === filter);
}

export interface DayGroup {
  /** "13 Oct 2026" (a plain date, whatever the time zone) */
  key: string;
  /** "Today", "Yesterday" or the date */
  label: string;
  items: TimelineItem[];
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The items by the day they happened (newest day first, each day newest first), with a muted heading for each. */
export function groupByDay(items: TimelineItem[], now: Date = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString());
  for (const item of items) {
    const key = dayKey(item.at);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const date = formatListDate(item.at);
      group = {
        key,
        label: key === today ? `Today, ${date}` : key === yesterday ? `Yesterday, ${date}` : date,
        items: [],
      };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
