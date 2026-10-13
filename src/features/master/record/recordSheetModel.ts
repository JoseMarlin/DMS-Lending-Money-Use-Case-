/**
 * What the record sheet shows for an application, as plain functions so that the rules can be
 * tested: the tabs, the fields of each tab (the same schema as the form, so the labels are the
 * form's labels), how a value is written, the banner under the tabs, and whether the current user
 * may open the workflow of the application.
 */
import type { BadgeTone } from '@/components/ui';
import type { BannerVariant } from '@/components/ui/InlineBanner';
import { maskAadhaar } from '@/data/aadhaar';
import {
  ApplicationStatus,
  type DemoUser,
  type HomeLoanApplication,
  type WorkflowInstance,
} from '@/data/types';
import { instanceByApplication, instancesFor } from '@/data/workflow';
import { isFieldVisible } from '@/features/home-loan/form/formState';
import type { FieldKey, FieldSchema } from '@/features/home-loan/form/schema';
import { STEP1_SECTIONS } from '@/features/home-loan/form/step1Schema';
import { kycBlock } from '@/features/workflow/review/reviewModel';
import { formatIndianNumber, formatListDate, formatListDateTime } from '@/lib/format';

export type SheetTabId =
  'application' | 'applicant' | 'identity' | 'property' | 'sureties' | 'kyc' | 'approval';

export interface SheetTab {
  id: SheetTabId;
  /** The tab */
  label: string;
  /** The bold heading under the tabs */
  heading: string;
}

export const SHEET_TABS: SheetTab[] = [
  { id: 'application', label: 'Application', heading: 'Application Details' },
  { id: 'applicant', label: 'Applicant', heading: 'Applicant Details' },
  { id: 'identity', label: 'Identity', heading: 'Identity and Consent' },
  { id: 'property', label: 'Property', heading: 'Property and Security' },
  { id: 'sureties', label: 'Sureties', heading: 'Co-applicant and Sureties' },
  { id: 'kyc', label: 'KYC', heading: 'KYC Validation' },
  { id: 'approval', label: 'Approval', heading: 'Approval' },
];

export const DEFAULT_SHEET_TAB: SheetTabId = 'application';

export function isSheetTab(value: string | null): value is SheetTabId {
  return SHEET_TABS.some((tab) => tab.id === value);
}

export interface SheetField {
  id: string;
  label: string;
  /** The text shown; '' when there is nothing (the sheet draws a dash) */
  value: string;
  /** Takes two columns of the grid (an address, a long remark) */
  wide: boolean;
  /** Has a row to itself (the remarks of an approval), so that the next level starts on a new row */
  fullRow?: boolean;
  /** Drawn as a badge of this tone instead of plain bold text */
  badge?: BadgeTone;
}

// ---------------------------------------------------------------------------
// The fields of each tab
// ---------------------------------------------------------------------------

/** Every field of the form by its key (the attachments all share the key 'documents', so they are left out). */
export const SCHEMA_FIELDS = new Map<FieldKey, FieldSchema>(
  STEP1_SECTIONS.flatMap((section) => section.fields)
    .filter((field) => field.type !== 'attachment')
    .map((field) => [field.key, field]),
);

/** The tabs that are fields of the form, in the order of the form. GSTIN is added only when it applies. */
export const FORM_TAB_KEYS: Partial<Record<SheetTabId, FieldKey[]>> = {
  application: [
    'applicationId',
    'branch',
    'loanProduct',
    'loanPurpose',
    'loanAmountRequested',
    'tenureMonths',
    'applicationDate',
  ],
  applicant: [
    'fullNameAsPerPan',
    'dateOfBirth',
    'mobile',
    'email',
    'occupation',
    'monthlyIncome',
    'address',
    'pinCode',
  ],
  identity: ['pan', 'aadhaar', 'gstin'],
  property: [
    'propertyAddress',
    'propertyOwnerName',
    'estimatedCost',
    'eligibleAmount',
    'securityType',
  ],
  sureties: [
    'coApplicantRequired',
    'coApplicantName',
    'coApplicantRelation',
    'surety1Name',
    'surety1Mobile',
    'surety1Pan',
    'surety2Name',
    'surety2Mobile',
    'surety2Pan',
  ],
};

/** The amounts of money, shown as ₹ 18,00,000. The other numbers (the tenure) are plain. */
const AMOUNT_KEYS: ReadonlySet<FieldKey> = new Set([
  'loanAmountRequested',
  'monthlyIncome',
  'estimatedCost',
  'eligibleAmount',
  'sanctionedAmount',
]);

/** Nothing was entered: empty, or only spaces (an optional field that was typed over with a space). */
const isBlank = (raw: unknown) =>
  raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');

export const rupees = (value: number) => `₹ ${formatIndianNumber(value)}`;

/** A form field's value the way the sheet writes it: ₹ amounts, DD MMM YYYY dates, a masked Aadhaar. */
export function formatFormValue(field: FieldSchema, application: HomeLoanApplication): string {
  const raw = application[field.key];
  if (field.mask === 'aadhaar') return maskAadhaar(typeof raw === 'string' ? raw : '');
  if (isBlank(raw)) return '';
  switch (field.type) {
    case 'number':
      return typeof raw === 'number'
        ? AMOUNT_KEYS.has(field.key)
          ? rupees(raw)
          : formatIndianNumber(raw)
        : '';
    case 'date':
      return typeof raw === 'string' ? formatListDate(raw) : '';
    case 'toggle':
    case 'checkbox':
      return raw === true ? 'Yes' : 'No';
    default:
      return typeof raw === 'string' ? raw : String(raw);
  }
}

/** A field that is not in the form: the consent, the KYC result and the approvals. */
interface ExtraField {
  key: FieldKey;
  label: string;
  kind: 'text' | 'date' | 'dateTime' | 'amount' | 'percent' | 'yesNo';
  wide?: boolean;
  fullRow?: boolean;
}

/** Labels as in PROJECT_OVERVIEW.md 6.6 */
const CONSENT_FIELDS: ExtraField[] = [
  { key: 'consentGiven', label: 'Consent Given', kind: 'yesNo' },
  { key: 'consentTime', label: 'Consent Time', kind: 'dateTime' },
];

/** Labels as in PROJECT_OVERVIEW.md 6.7. The overall result comes first and is drawn as a badge. */
const KYC_FIELDS: ExtraField[] = [
  { key: 'nameMatchPercent', label: 'Name Match Percent', kind: 'percent' },
  { key: 'panStatus', label: 'PAN Status', kind: 'text' },
  { key: 'panNameAsPerSource', label: 'PAN Name as per Source', kind: 'text' },
  { key: 'aadhaarStatus', label: 'Aadhaar Status', kind: 'text' },
  { key: 'aadhaarReference', label: 'Aadhaar Reference', kind: 'text' },
  { key: 'gstStatus', label: 'GST Status', kind: 'text' },
  { key: 'gstLegalName', label: 'GST Legal Name', kind: 'text' },
  { key: 'kycCheckedOn', label: 'KYC Checked On', kind: 'date' },
  { key: 'kycExceptionRemark', label: 'KYC Exception Remark', kind: 'text', wide: true },
];

/** Labels as in PROJECT_OVERVIEW.md 6.8 */
const APPROVAL_FIELDS: ExtraField[] = [
  { key: 'level1Approver', label: 'Level 1 Approver', kind: 'text' },
  { key: 'level1Decision', label: 'Level 1 Decision', kind: 'text' },
  { key: 'level1Time', label: 'Level 1 Time', kind: 'dateTime' },
  { key: 'level1Remarks', label: 'Level 1 Remarks', kind: 'text', wide: true, fullRow: true },
  { key: 'level2Approver', label: 'Level 2 Approver', kind: 'text' },
  { key: 'level2Decision', label: 'Level 2 Decision', kind: 'text' },
  { key: 'level2Time', label: 'Level 2 Time', kind: 'dateTime' },
  { key: 'level2Remarks', label: 'Level 2 Remarks', kind: 'text', wide: true, fullRow: true },
  { key: 'sanctionedAmount', label: 'Sanctioned Amount', kind: 'amount' },
  { key: 'sanctionDate', label: 'Sanction Date', kind: 'date' },
];

function formatExtraValue(field: ExtraField, application: HomeLoanApplication): string {
  const raw = application[field.key];
  if (field.kind === 'yesNo') return raw === true ? 'Yes' : 'No';
  if (isBlank(raw)) return '';
  switch (field.kind) {
    case 'date':
      return typeof raw === 'string' ? formatListDate(raw) : '';
    case 'dateTime':
      return typeof raw === 'string' ? formatListDateTime(raw) : '';
    case 'amount':
      return typeof raw === 'number' ? rupees(raw) : '';
    case 'percent':
      return typeof raw === 'number' ? `${raw}%` : '';
    default:
      return typeof raw === 'string' ? raw : String(raw);
  }
}

const extraFields = (specs: ExtraField[], application: HomeLoanApplication): SheetField[] =>
  specs.map((spec) => ({
    id: spec.key,
    label: spec.label,
    value: formatExtraValue(spec, application),
    wide: spec.wide ?? false,
    ...(spec.fullRow ? { fullRow: true } : {}),
  }));

/** A form field is wide when the form gives it more than a third of the row. */
const isWide = (field: FieldSchema) => field.width !== undefined && field.width !== 'third';

/**
 * The fields of one tab, with their values written for reading. The Application, Applicant,
 * Identity, Property and Sureties tabs take their labels from the form's own schema.
 */
export function sheetFields(application: HomeLoanApplication, tab: SheetTabId): SheetField[] {
  switch (tab) {
    case 'kyc': {
      const { result, tone } = kycBlock(application);
      return [
        {
          id: 'kycOverallResult',
          label: 'KYC Overall Result',
          value: result,
          wide: false,
          badge: tone,
        },
        ...extraFields(KYC_FIELDS, application),
      ];
    }
    case 'approval':
      return extraFields(APPROVAL_FIELDS, application);
    default: {
      const fields = (FORM_TAB_KEYS[tab] ?? [])
        .map((key) => SCHEMA_FIELDS.get(key))
        .filter((field): field is FieldSchema => field !== undefined)
        // GSTIN is asked of Business and Professional applicants only. The co-applicant is shown with a
        // dash when there is none: the tab says what the loan has, not what the form asked for.
        .filter((field) => field.key !== 'gstin' || isFieldVisible(field, application))
        .map((field) => ({
          id: field.key,
          label: field.label,
          value: formatFormValue(field, application),
          wide: isWide(field),
        }));
      return tab === 'identity' ? [...fields, ...extraFields(CONSENT_FIELDS, application)] : fields;
    }
  }
}

/** The fields whose label or value has the text in it, in any case. No text keeps them all. */
export function filterFields<T extends { label: string; value: string }>(
  fields: T[],
  query: string,
): T[] {
  const text = query.trim().toLowerCase();
  if (text === '') return fields;
  return fields.filter(
    (field) => field.label.toLowerCase().includes(text) || field.value.toLowerCase().includes(text),
  );
}

// ---------------------------------------------------------------------------
// The banner under the tabs
// ---------------------------------------------------------------------------

export interface SheetBanner {
  variant: BannerVariant;
  title: string;
  /** The reviewer's comment or the reason, when there is one to show */
  message: string;
}

/** The decision (Returned or Rejected) the application stands on: the latest level that made it. */
function decisionBehind(
  application: HomeLoanApplication,
  decision: 'Returned' | 'Rejected',
): { level: 1 | 2; by: string; comment: string } | null {
  if (application.level2Decision === decision) {
    return { level: 2, by: application.level2Approver, comment: application.level2Remarks };
  }
  if (application.level1Decision === decision) {
    return { level: 1, by: application.level1Approver, comment: application.level1Remarks };
  }
  return null;
}

/**
 * What the sheet says about where the application stands: pending at Level 1 or 2, why it was
 * returned or rejected, or that it is not submitted yet. An approved application has no banner.
 */
export function sheetBanner(application: HomeLoanApplication): SheetBanner | null {
  switch (application.status) {
    case ApplicationStatus.Draft:
    case ApplicationStatus.KycDone:
      return { variant: 'info', title: 'Not submitted yet', message: '' };
    case ApplicationStatus.Submitted:
    case ApplicationStatus.InLevel1:
      return { variant: 'info', title: 'Pending approval at Level 1', message: '' };
    case ApplicationStatus.InLevel2:
      return { variant: 'info', title: 'Pending approval at Level 2', message: '' };
    case ApplicationStatus.Returned:
    case ApplicationStatus.Rejected: {
      const returned = application.status === ApplicationStatus.Returned;
      const behind = decisionBehind(application, returned ? 'Returned' : 'Rejected');
      const word = returned ? 'Returned for correction' : 'Rejected';
      return {
        variant: returned ? 'warning' : 'error',
        title: behind?.by ? `${word} by ${behind.by} (Level ${behind.level})` : word,
        message: behind?.comment.trim() || 'No comment was given.',
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// View workflow
// ---------------------------------------------------------------------------

export interface WorkflowAccess {
  /** The workflow instance to open, or null when there is none to open */
  instance: WorkflowInstance | null;
  /** Why the button is off; null when the user may open it */
  reason: string | null;
}

/**
 * May this user open the workflow of the application? There must be one (a draft has none), and the
 * user must be on it (they submitted it, or a step is theirs, or was) or be the administrator: the
 * same rule as the list "All Workflows".
 */
export function workflowAccess(
  state: { workflowInstances: WorkflowInstance[] },
  user: DemoUser,
  applicationId: string,
): WorkflowAccess {
  const instance = instanceByApplication(state, applicationId);
  if (!instance) {
    return {
      instance: null,
      reason: 'This application has not been submitted, so it has no workflow yet.',
    };
  }
  if (!instancesFor(state, user).some((i) => i.id === instance.id)) {
    return {
      instance: null,
      reason: 'Only the people on this workflow, and the administrator, can open it.',
    };
  }
  return { instance, reason: null };
}
