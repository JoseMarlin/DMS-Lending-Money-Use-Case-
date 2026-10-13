/**
 * The Activity log of the review screen: the audit events of one application (section 11 of the
 * overview), newest first, each turned into what the screen writes: a title, who and when, what
 * changed, and the comment. Plain functions, so they can be tested. Every text goes through the
 * Aadhaar mask on its way out, whatever the store holds.
 */
import { maskAadhaarInText } from '@/data/aadhaar';
import type { AuditEvent } from '@/data/types';
import { formatIndianNumber, formatListDateTime } from '@/lib/format';

export type ActivityTone = 'neutral' | 'success' | 'warning' | 'error';

export interface ActivityEntry {
  id: string;
  /** The event, for example "Level 1 decision" */
  title: string;
  /** The result of a decision or a check, as a chip: Approved, Rejected, Returned, Pass ... */
  chip: { label: string; tone: ActivityTone } | null;
  /** Who did it ("System" for the automatic ones) and when, in two parts and as one line */
  actor: string;
  when: string;
  who: string;
  /** What changed or was recorded: "Sanctioned Amount: 18,00,000 → 17,50,000" */
  details: string[];
  /** What the person wrote with a decision */
  comment: string;
  /** For example the mock reference of a KYC check or the workflow instance */
  reference: string;
  /** The colour of the dot on the line */
  tone: ActivityTone;
}

const RESULT_TONE: Record<string, ActivityTone> = {
  Approved: 'success',
  Pass: 'success',
  Verified: 'success',
  Rejected: 'error',
  Fail: 'error',
  Failed: 'error',
  Returned: 'warning',
  Exception: 'warning',
  Unavailable: 'warning',
};

const mask = (text: string) => maskAadhaarInText(text);

/** "18000000" -> "1,80,00,000" for the fields that hold an amount; anything else as it is. */
function valueOf(field: string, value: string): string {
  if (/amount/i.test(field) && /^\d+$/.test(value)) return formatIndianNumber(Number(value));
  return value;
}

function detailsOf(event: AuditEvent): string[] {
  const { field, oldValue, newValue } = event;
  if (field && (oldValue || newValue)) {
    // a value that did not change (the sanctioned amount that is the requested one) is just the value
    const from = oldValue && oldValue !== newValue ? `${valueOf(field, oldValue)} → ` : '';
    return [`${field}: ${from}${valueOf(field, newValue)}`];
  }
  if (newValue) return [newValue];
  if (field) return [field];
  return [];
}

/** The chip a decision or a check carries, from the value it set. */
function chipOf(event: AuditEvent): ActivityEntry['chip'] {
  const decided =
    /decision$/i.test(event.field) ||
    event.event === 'KYC result set' ||
    event.event === 'KYC check run';
  if (decided && RESULT_TONE[event.newValue]) {
    return { label: event.newValue, tone: RESULT_TONE[event.newValue] };
  }
  if (event.event === 'Rejected') return { label: 'Rejected', tone: 'error' };
  if (event.event === 'Returned') return { label: 'Returned', tone: 'warning' };
  return null;
}

/** What each event is made of: the dot colour follows the chip, else it is neutral. */
function entryOf(event: AuditEvent, repeatsDecision: boolean): ActivityEntry {
  // the Rejected or Returned event follows the decision that says it: keep its status line only
  const chip = repeatsDecision ? null : chipOf(event);
  const actor = mask(event.user);
  const when = formatListDateTime(event.at);
  return {
    id: event.id,
    title: mask(event.event),
    chip: chip ? { label: mask(chip.label), tone: chip.tone } : null,
    actor,
    when,
    who: [actor, when].filter(Boolean).join(' · '),
    // a decision says Approved, Rejected or Returned in its chip, so the line would only repeat it
    details: (chip && /decision$/i.test(event.field) ? [] : detailsOf(event)).map(mask),
    comment: repeatsDecision ? '' : mask(event.comment),
    reference: mask(event.reference),
    tone: chip ? chip.tone : 'neutral',
  };
}

/**
 * The events of this application, newest first. Events with the same time (the checks of one KYC
 * run, a decision and the filing that follows it) keep the order they were written in, newest
 * written first, so that the log reads backwards the way it happened.
 */
export function activityEntries(events: AuditEvent[], applicationId: string): ActivityEntry[] {
  const mine = events.filter((event) => event.applicationId === applicationId);
  // a decision as it was written: who, when and what they said
  const said = new Set(
    mine.filter((e) => /decision$/i.test(e.field)).map((e) => `${e.user}|${e.at}|${e.comment}`),
  );
  const repeats = (e: AuditEvent) =>
    (e.event === 'Rejected' || e.event === 'Returned') &&
    said.has(`${e.user}|${e.at}|${e.comment}`);
  return mine
    .map((event, index) => ({ event, index }))
    .sort((a, b) => Date.parse(b.event.at) - Date.parse(a.event.at) || b.index - a.index)
    .map(({ event }) => entryOf(event, repeats(event)));
}
