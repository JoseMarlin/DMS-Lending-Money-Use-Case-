/**
 * The rules of the record sheet's edit mode, as plain functions: which fields each tab edits and
 * which of them are locked, how a change is written to the working copy (with the form's own rules:
 * the fields that are hidden by a change are cleared, the calculated fields follow), the validation
 * (the form's rules module, over the sections the tabs edit), which tab each error belongs to, and
 * what changed between the record and the working copy. Nothing is defined twice: the fields, the
 * conditions, the calculations and the rules are the form's.
 */
import type { BadgeTone } from '@/components/ui';
import { applyCalculatedFields, identityChanged, sanitizeApplication } from '@/data/application';
import type { FieldChange } from '@/data/recordEdit';
import type { HomeLoanApplication } from '@/data/types';
import { buildPatch, isFieldVisible } from '@/features/home-loan/form/formState';
import type { FieldKey, FieldSchema } from '@/features/home-loan/form/schema';
import { STEP1_SECTIONS } from '@/features/home-loan/form/step1Schema';
import { validateStep1, type ValidationIssue } from '@/features/home-loan/validation/validate';
import { formatListDateTime } from '@/lib/format';
import {
  FORM_TAB_KEYS,
  SCHEMA_FIELDS,
  SHEET_TABS,
  formatFormValue,
  sheetFields,
  type SheetTabId,
} from './recordSheetModel';

/** The sections the tabs edit: the form's, without the documents (they are in the Files and Attachments panel). */
export const EDIT_SECTIONS = STEP1_SECTIONS.filter((section) => section.id !== 'documents');

/** The documents section of the form: its rows are checked on Save (every required document has to be there). */
const DOCUMENT_SECTIONS = STEP1_SECTIONS.filter((section) => section.id === 'documents');

// ---------------------------------------------------------------------------
// The fields of each tab
// ---------------------------------------------------------------------------

/** The form fields of each tab that has any, in the order of the form. */
const EDIT_TAB_KEYS: Partial<Record<SheetTabId, FieldKey[]>> = {
  application: FORM_TAB_KEYS.application,
  applicant: FORM_TAB_KEYS.applicant,
  identity: [...(FORM_TAB_KEYS.identity ?? []), 'consentGiven'],
  property: FORM_TAB_KEYS.property,
  // the toggle comes first: it is what shows the co-applicant's name and relation
  sureties: ['addCoApplicant', ...(FORM_TAB_KEYS.sureties ?? [])],
};

/** A field that can be changed (an input of the form), or one that is shown with a lock. */
export type EditItem =
  | { kind: 'field'; id: string; field: FieldSchema; wide: 'one' | 'two' | 'row' }
  | {
      kind: 'locked';
      id: string;
      label: string;
      value: string;
      wide: 'one' | 'two' | 'row';
      badge?: BadgeTone;
      /** The hint under the value: why it cannot be changed */
      hint: string;
    };

const spanOf = (field: FieldSchema): 'one' | 'two' | 'row' =>
  field.width === 'full'
    ? 'row'
    : field.width === undefined || field.width === 'third'
      ? 'one'
      : 'two';

/** Fields that the form shows but does not let anybody type in: the ID and date, the product, the calculated ones. */
export const isLockedField = (field: FieldSchema) => Boolean(field.readOnly || field.calculated);

export const HINT_SYSTEM = 'Set by the system';
export const HINT_CALCULATED = 'Worked out from the other fields';
export const HINT_KYC = 'Set by the KYC checks';
export const HINT_APPROVAL = 'Set by the approvers';

/**
 * What a tab shows in edit mode, for the working copy: an input for each field of the form (the
 * conditions of the form decide which are there: the GSTIN, the co-applicant's name and relation),
 * and the locked fields with their hint. The KYC and Approval tabs are locked as a whole.
 */
export function editItems(working: HomeLoanApplication, tab: SheetTabId): EditItem[] {
  if (tab === 'kyc' || tab === 'approval') {
    return sheetFields(working, tab).map((field) => ({
      kind: 'locked',
      id: field.id,
      label: field.label,
      value: field.value,
      wide: field.fullRow ? 'row' : field.wide ? 'two' : 'one',
      badge: field.badge,
      hint: tab === 'kyc' ? HINT_KYC : HINT_APPROVAL,
    }));
  }
  const items: EditItem[] = [];
  for (const key of EDIT_TAB_KEYS[tab] ?? []) {
    const field = SCHEMA_FIELDS.get(key);
    if (!field || !isFieldVisible(field, working)) continue;
    if (isLockedField(field)) {
      items.push({
        kind: 'locked',
        id: field.key,
        label: field.label,
        value: formatFormValue(field, working),
        wide: spanOf(field),
        hint: field.calculated ? HINT_CALCULATED : HINT_SYSTEM,
      });
    } else {
      // the consent says when it was given in its own locked field below: its helper text would say it twice
      items.push({
        kind: 'field',
        id: field.key,
        field: key === 'consentGiven' ? { ...field, helperText: undefined } : field,
        wide: spanOf(field),
      });
    }
    // the moment the consent was given follows the box, and is set by the system
    if (key === 'consentGiven') {
      items.push({
        kind: 'locked',
        id: 'consentTime',
        label: 'Consent Time',
        value: formatListDateTime(working.consentTime),
        wide: 'one',
        hint: HINT_SYSTEM,
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Changing a field
// ---------------------------------------------------------------------------

/**
 * The working copy after one field was changed, as the form does it: a field that the change
 * hides is cleared, the Eligible Amount and the other calculated fields follow, and the Aadhaar
 * stays masked.
 */
export function applyFieldChange(
  working: HomeLoanApplication,
  field: FieldSchema,
  raw: string,
): HomeLoanApplication {
  const patch = buildPatch(EDIT_SECTIONS, working, field, raw);
  return applyCalculatedFields(sanitizeApplication({ ...working, ...patch }));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Which tab each field of the form is on. */
const TAB_OF_FIELD: ReadonlyMap<string, SheetTabId> = new Map(
  (Object.entries(EDIT_TAB_KEYS) as [SheetTabId, FieldKey[]][]).flatMap(([tab, keys]) =>
    keys.map((key): [string, SheetTabId] => [key, tab]),
  ),
);

/** The tab of a field (by its id, see fieldId): a field that is on no tab is on Application. */
export const tabOfField = (id: string): SheetTabId => TAB_OF_FIELD.get(id) ?? 'application';

/** Where an error is: a tab of the sheet, or the Files and Attachments panel (a document that is missing). */
export type IssueTab = SheetTabId | 'files';

export interface EditIssue extends ValidationIssue {
  tab: IssueTab;
}

/**
 * Every problem of the working copy, in the order of the form, with the tab it is on. The same
 * rules as the form, with the duplicate PAN check (which leaves this record out).
 */
export function validateEdit(
  working: HomeLoanApplication,
  applications: Pick<HomeLoanApplication, 'applicationId' | 'pan'>[],
  /** The duplicate PAN check is made when saving, as the form makes it at Next */
  checkDuplicatePan = true,
): EditIssue[] {
  const onTabs = validateStep1(EDIT_SECTIONS, working, { applications, checkDuplicatePan }).map(
    (issue): EditIssue => ({ ...issue, tab: tabOfField(issue.fieldId) }),
  );
  // a required document that is not there: the same rule as the form's, shown in the Files panel
  const missing = validateStep1(DOCUMENT_SECTIONS, working).map((issue): EditIssue => ({
    ...issue,
    tab: 'files',
  }));
  return [...onTabs, ...missing];
}

/** True when a required document is missing. */
export const filesInError = (issues: EditIssue[]): boolean =>
  issues.some((issue) => issue.tab === 'files');

/** The tabs that have an error, in the order of the tabs. */
export function tabsWithIssues(issues: EditIssue[]): SheetTabId[] {
  return SHEET_TABS.map((tab) => tab.id).filter((id) => issues.some((issue) => issue.tab === id));
}

/** "3 fields need attention: Applicant (2), Property (1)". */
export function issueSummary(issues: EditIssue[]): string {
  if (issues.length === 0) return '';
  const parts = tabsWithIssues(issues).map((id) => {
    const label = SHEET_TABS.find((tab) => tab.id === id)?.label ?? id;
    return `${label} (${issues.filter((issue) => issue.tab === id).length})`;
  });
  const documents = issues.filter((issue) => issue.tab === 'files').length;
  if (documents > 0) parts.push(`Files and Attachments (${documents})`);
  return `${issues.length} ${issues.length === 1 ? 'field needs' : 'fields need'} attention: ${parts.join(', ')}`;
}

// ---------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------

/** The fields that are compared: those of the form that the tabs edit, in order, with the consent time after the consent. */
const COMPARED = EDIT_SECTIONS.flatMap((section) => section.fields).filter(
  (field) => field.type !== 'attachment',
);

/**
 * The fields that differ between the record and the working copy, as the trail writes them: the
 * label, and what it was and became as text. A changed Aadhaar is "changed", never the number (the
 * record holds only the masked one, and even the last four digits stay out of the trail).
 * `aadhaarEntered` is true when the person typed an Aadhaar, even one that ends in the same digits.
 */
export function changedFields(
  original: HomeLoanApplication,
  working: HomeLoanApplication,
  aadhaarEntered = false,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of COMPARED) {
    if (field.mask === 'aadhaar') {
      if (aadhaarEntered || original.aadhaar !== working.aadhaar) {
        changes.push({ label: field.label, oldValue: '', newValue: 'changed' });
      }
      continue;
    }
    if (original[field.key] !== working[field.key]) {
      changes.push({
        label: field.summaryLabel ?? field.label,
        oldValue: formatFormValue(field, original),
        newValue: formatFormValue(field, working),
      });
    }
    if (field.key === 'consentGiven' && original.consentTime !== working.consentTime) {
      changes.push({
        label: 'Consent Time',
        oldValue: formatListDateTime(original.consentTime),
        newValue: formatListDateTime(working.consentTime),
      });
    }
  }
  return changes;
}

/**
 * True when what the checks look at changed: PAN, Aadhaar, GSTIN, name or date of birth. A
 * re-entered Aadhaar counts, whatever its last four digits are.
 */
export function identityTouched(
  original: HomeLoanApplication,
  working: HomeLoanApplication,
  aadhaarEntered: boolean,
): boolean {
  return aadhaarEntered || identityChanged(original, working);
}

// ---------------------------------------------------------------------------
// Resubmit
// ---------------------------------------------------------------------------

/** The events of a correction: a field saved, or a document of the form uploaded, replaced or removed in the sheet. */
const CORRECTION_EVENTS = new Set([
  'Field changed',
  'Document uploaded',
  'Document replaced',
  'Document removed',
]);

/**
 * True when the record was corrected (a field saved, or a document uploaded, replaced or removed)
 * after it was last returned: only then is "Resubmit for approval" offered, so that
 * a returned application is not sent back as it was. A returned record is often corrected with a
 * clear copy of a document and nothing else.
 */
export function correctedSinceReturn(
  events: { applicationId: string; event: string; at: string }[],
  applicationId: string,
): boolean {
  const mine = events.filter((e) => e.applicationId === applicationId);
  const returnedAt = Math.max(
    -Infinity,
    ...mine.filter((e) => e.event === 'Returned').map((e) => Date.parse(e.at) || 0),
  );
  return mine.some((e) => CORRECTION_EVENTS.has(e.event) && (Date.parse(e.at) || 0) >= returnedAt);
}
