import { maskAadhaar, maskAadhaarInText } from './aadhaar';
import { DOC_TYPES, LIMITS } from './options';
import {
  ApplicationStatus,
  CheckStatus,
  type ApplicationDocument,
  type DocType,
  type HomeLoanApplication,
  type ScenarioDocument,
} from './types';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Local date as YYYY-MM-DD. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Age in whole years on a given date. Returns null if either date is missing or invalid. */
export function ageOn(dateOfBirth: string, onDate: string): number | null {
  const dob = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  const on = /^(\d{4})-(\d{2})-(\d{2})$/.exec(onDate);
  if (!dob || !on) return null;
  let age = Number(on[1]) - Number(dob[1]);
  const beforeBirthday =
    Number(on[2]) < Number(dob[2]) ||
    (Number(on[2]) === Number(dob[2]) && Number(on[3]) < Number(dob[3]));
  if (beforeBirthday) age -= 1;
  return age;
}

// ---------------------------------------------------------------------------
// Calculated fields (section 6)
// ---------------------------------------------------------------------------

/**
 * Eligible Amount.
 * - Construction of house: 75% of Estimated Cost, capped at 30,00,000 (null until a cost is entered).
 * - Any other Loan Purpose: just the 30,00,000 cap.
 * - No Loan Purpose chosen yet: null.
 */
export function computeEligibleAmount(
  loanPurpose: HomeLoanApplication['loanPurpose'],
  estimatedCost: number | null,
): number | null {
  if (loanPurpose === '') return null;
  if (loanPurpose !== 'Construction of house') return LIMITS.maxLoanAmount;
  if (estimatedCost === null || !(estimatedCost > 0)) return null;
  return Math.min(Math.floor((estimatedCost * LIMITS.eligiblePercent) / 100), LIMITS.maxLoanAmount);
}

/** Co-applicant Required: Yes if the applicant is above 60 (rule unclear, see section 16). */
export function computeCoApplicantRequired(
  dateOfBirth: string,
  applicationDate: string,
): HomeLoanApplication['coApplicantRequired'] {
  const age = ageOn(dateOfBirth, applicationDate);
  return age !== null && age > LIMITS.coApplicantAboveAge ? 'Yes' : 'No';
}

/**
 * Recomputes the calculated and auto fields. The store calls this on every draft change.
 * - When a co-applicant is required (applicant above 60) the "Add a co-applicant" toggle is forced on.
 * - Consent Time is set the moment Consent Given is ticked, kept while it stays ticked, and
 *   cleared when it is unticked.
 */
export function applyCalculatedFields<
  T extends Pick<
    HomeLoanApplication,
    | 'loanPurpose'
    | 'estimatedCost'
    | 'eligibleAmount'
    | 'dateOfBirth'
    | 'applicationDate'
    | 'coApplicantRequired'
    | 'addCoApplicant'
    | 'consentGiven'
    | 'consentTime'
  >,
>(app: T, now: Date = new Date()): T {
  const coApplicantRequired = computeCoApplicantRequired(app.dateOfBirth, app.applicationDate);
  return {
    ...app,
    eligibleAmount: computeEligibleAmount(app.loanPurpose, app.estimatedCost),
    coApplicantRequired,
    addCoApplicant: coApplicantRequired === 'Yes' ? true : Boolean(app.addCoApplicant),
    consentTime: app.consentGiven ? app.consentTime || now.toISOString() : '',
  };
}

/**
 * Documents that must be uploaded. The overview says the full list is required for Construction
 * of house. The GST Certificate or Business Licence is only asked for Business and Professional
 * applicants (assumption, to be confirmed).
 */
export function requiredDocTypes(occupation: HomeLoanApplication['occupation']): DocType[] {
  const needsGst = occupation === 'Business' || occupation === 'Professional';
  return DOC_TYPES.filter((t) => needsGst || t !== 'GST Certificate or Business Licence');
}

/** Fields that KYC checks. If one of them changes after a result, the result no longer applies. */
export const KYC_IDENTITY_KEYS = [
  'pan',
  'aadhaar',
  'gstin',
  'fullNameAsPerPan',
  'dateOfBirth',
] as const satisfies readonly (keyof HomeLoanApplication)[];

/** True when any identity field differs between two versions of an application. */
export function identityChanged(
  before: Pick<HomeLoanApplication, (typeof KYC_IDENTITY_KEYS)[number]>,
  after: Pick<HomeLoanApplication, (typeof KYC_IDENTITY_KEYS)[number]>,
): boolean {
  return KYC_IDENTITY_KEYS.some((key) => before[key] !== after[key]);
}

/** True once KYC has produced anything for the application (a result, or a check that finished). */
export function hasKycResult(app: HomeLoanApplication): boolean {
  return (
    app.kycOverallResult !== '' ||
    app.panStatus !== CheckStatus.Pending ||
    app.aadhaarStatus !== CheckStatus.Pending ||
    app.gstStatus !== CheckStatus.Pending
  );
}

/** The KYC fields as they are before any check has run (section 6.7). */
export function blankKycFields(): Pick<
  HomeLoanApplication,
  | 'panStatus'
  | 'panNameAsPerSource'
  | 'aadhaarStatus'
  | 'aadhaarReference'
  | 'gstStatus'
  | 'gstLegalName'
  | 'gstinStatus'
  | 'nameMatchPercent'
  | 'dateOfBirthMatch'
  | 'dateOfBirthAsPerSource'
  | 'kycOverallResult'
  | 'kycExceptionRemark'
  | 'kycCheckedOn'
  | 'retryCount'
> {
  return {
    panStatus: CheckStatus.Pending,
    panNameAsPerSource: '',
    aadhaarStatus: CheckStatus.Pending,
    aadhaarReference: '',
    gstStatus: CheckStatus.Pending,
    gstLegalName: '',
    gstinStatus: '',
    nameMatchPercent: null,
    dateOfBirthMatch: '',
    dateOfBirthAsPerSource: '',
    kycOverallResult: '',
    kycExceptionRemark: '',
    kycCheckedOn: '',
    retryCount: 0,
  };
}

/** Clears the KYC result, and moves "KYC Done" back to Draft. */
export function resetKyc<T extends HomeLoanApplication>(app: T): T {
  return {
    ...app,
    ...blankKycFields(),
    status: app.status === ApplicationStatus.KycDone ? ApplicationStatus.Draft : app.status,
  };
}

/** Stable id of the document for a DocType (DocType and file are 1:1). */
export function documentId(applicationId: string, docType: DocType): string {
  return `${applicationId}-${docType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

/** Frees the blob: preview links of documents that are no longer kept. */
export function revokePreviewUrls(
  documents: ApplicationDocument[],
  keep: ApplicationDocument[] = [],
) {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  const kept = new Set(keep.map((d) => d.previewUrl));
  documents.forEach((d) => {
    if (d.previewUrl?.startsWith('blob:') && !kept.has(d.previewUrl)) {
      URL.revokeObjectURL(d.previewUrl);
    }
  });
}

/** For saving: preview links made from local files do not survive a reload, so leave them out. */
export function withoutBlobPreviews<T extends Pick<HomeLoanApplication, 'documents'>>(app: T): T {
  if (!app.documents?.some((d) => d.previewUrl?.startsWith('blob:'))) return app;
  return {
    ...app,
    documents: app.documents.map((d) => {
      if (!d.previewUrl?.startsWith('blob:')) return d;
      const rest = { ...d };
      delete rest.previewUrl;
      return rest;
    }),
  };
}

/** Turns plain file descriptions into tagged documents. DocType and file are 1:1. */
export function toApplicationDocuments(
  applicationId: string,
  files: ScenarioDocument[],
  uploadedBy: string,
  uploadedAt: string,
): ApplicationDocument[] {
  return files.map((file) => ({
    ...file,
    id: documentId(applicationId, file.docType),
    uploadedBy,
    uploadedAt,
  }));
}

// ---------------------------------------------------------------------------
// Application ID
// ---------------------------------------------------------------------------

/** HL-2026-0001 style. Takes the highest number used so far and adds one. */
export function nextApplicationId(existingIds: string[], now: Date = new Date()): string {
  const highest = existingIds.reduce((max, id) => {
    const n = Number(/^HL-\d{4}-(\d{4,})$/.exec(id)?.[1] ?? 0);
    return Math.max(max, n);
  }, 0);
  return `HL-${now.getFullYear()}-${String(highest + 1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Blank application and the Aadhaar guard
// ---------------------------------------------------------------------------

interface BlankApplicationOptions {
  applicationId: string;
  branch: string;
  createdBy: string;
  now?: Date;
}

export function createBlankApplication({
  applicationId,
  branch,
  createdBy,
  now = new Date(),
}: BlankApplicationOptions): HomeLoanApplication {
  const timestamp = now.toISOString();
  return {
    applicationId,
    branch,
    loanProduct: 'Home Loan',
    loanPurpose: '',
    loanAmountRequested: null,
    tenureMonths: null,
    applicationDate: toISODate(now),

    fullNameAsPerPan: '',
    dateOfBirth: '',
    mobile: '',
    email: '',
    occupation: '',
    monthlyIncome: null,
    address: '',
    pinCode: '',

    pan: '',
    aadhaar: '',
    gstin: '',

    propertyAddress: '',
    propertyOwnerName: '',
    estimatedCost: null,
    eligibleAmount: null,
    securityType: 'Mortgage of unencumbered immovable property',

    addCoApplicant: false,
    coApplicantRequired: 'No',
    coApplicantName: '',
    coApplicantRelation: '',
    surety1Name: '',
    surety1Mobile: '',
    surety1Pan: '',
    surety2Name: '',
    surety2Mobile: '',
    surety2Pan: '',

    consentGiven: false,
    consentTime: '',

    panStatus: CheckStatus.Pending,
    panNameAsPerSource: '',
    aadhaarStatus: CheckStatus.Pending,
    aadhaarReference: '',
    gstStatus: CheckStatus.Pending,
    gstLegalName: '',
    gstinStatus: '',
    nameMatchPercent: null,
    dateOfBirthMatch: '',
    dateOfBirthAsPerSource: '',
    kycOverallResult: '',
    kycExceptionRemark: '',
    kycCheckedOn: '',
    retryCount: 0,

    level1Approver: '',
    level1Decision: '',
    level1Remarks: '',
    level1Time: '',
    level2Approver: '',
    level2Decision: '',
    level2Remarks: '',
    level2Time: '',
    sanctionedAmount: null,
    sanctionDate: '',

    status: ApplicationStatus.Draft,
    documents: [],

    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Fields where a person types free text, so a full Aadhaar number could end up in them. */
const FREE_TEXT_KEYS = [
  'fullNameAsPerPan',
  'email',
  'mobile',
  'pinCode',
  'pan',
  'gstin',
  'surety1Mobile',
  'surety1Pan',
  'surety2Mobile',
  'surety2Pan',
  'address',
  'propertyAddress',
  'propertyOwnerName',
  'coApplicantName',
  'surety1Name',
  'surety2Name',
  'kycExceptionRemark',
  'level1Remarks',
  'level2Remarks',
] as const;

/**
 * Makes sure an application never carries a full Aadhaar number. The store runs every write and
 * every value read back from localStorage through this. Safe to call more than once.
 */
export function sanitizeApplication<T extends Pick<HomeLoanApplication, 'aadhaar'>>(app: T): T {
  const patch: Record<string, unknown> = {};
  const masked = maskAadhaar(app.aadhaar ?? '');
  if (masked !== app.aadhaar) patch.aadhaar = masked;

  // A full number typed into free text or a file name is hidden too
  const record = app as unknown as Record<string, unknown>;
  for (const key of FREE_TEXT_KEYS) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const clean = maskAadhaarInText(value);
    if (clean !== value) patch[key] = clean;
  }
  const documents = record.documents;
  if (Array.isArray(documents)) {
    let changed = false;
    const clean = documents.map((doc: ApplicationDocument) => {
      const fileName = typeof doc?.fileName === 'string' ? maskAadhaarInText(doc.fileName) : null;
      const note = typeof doc?.note === 'string' ? maskAadhaarInText(doc.note) : undefined;
      if (fileName === null || (fileName === doc.fileName && note === doc.note)) return doc;
      changed = true;
      return { ...doc, fileName, ...(note === undefined ? {} : { note }) };
    });
    if (changed) patch.documents = clean;
  }
  return Object.keys(patch).length === 0 ? app : { ...app, ...patch };
}

/** The fields a person fills in on Step 1 (everything else is set by the system or by a default). */
const ENTERED_KEYS = [
  'loanPurpose',
  'loanAmountRequested',
  'tenureMonths',
  'fullNameAsPerPan',
  'dateOfBirth',
  'mobile',
  'email',
  'occupation',
  'monthlyIncome',
  'address',
  'pinCode',
  'pan',
  'aadhaar',
  'gstin',
  'propertyAddress',
  'propertyOwnerName',
  'estimatedCost',
  'addCoApplicant',
  'coApplicantName',
  'coApplicantRelation',
  'surety1Name',
  'surety1Mobile',
  'surety1Pan',
  'surety2Name',
  'surety2Mobile',
  'surety2Pan',
  'consentGiven',
] as const satisfies readonly (keyof HomeLoanApplication)[];

/** True when nothing has been entered yet and no document has been attached. */
export function isBlankDraft(app: HomeLoanApplication): boolean {
  if (app.documents.length > 0) return false;
  return ENTERED_KEYS.every((key) => {
    const value = app[key];
    return value === '' || value === null || value === false;
  });
}

/**
 * True once an application has been submitted and is in the workflow or past it: In Level 1,
 * In Level 2, Approved or Rejected (and the old "Submitted"). A Returned application is not: it is
 * back with the loan officer to correct. A draft is not either.
 */
export function hasBeenSubmitted(status: HomeLoanApplication['status']): boolean {
  return (
    status === ApplicationStatus.Submitted ||
    status === ApplicationStatus.InLevel1 ||
    status === ApplicationStatus.InLevel2 ||
    status === ApplicationStatus.Approved ||
    status === ApplicationStatus.Rejected
  );
}
