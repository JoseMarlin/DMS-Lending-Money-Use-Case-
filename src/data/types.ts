/**
 * Data model for the master "Home Loan Application" (PROJECT_OVERVIEW.md section 6).
 *
 * Keys are camelCase versions of the field labels. Empty form values are '' (text, dropdown,
 * date) or null (number), so a blank draft is a valid HomeLoanApplication.
 *
 * Dates: date-only fields are 'YYYY-MM-DD'. Fields that hold a moment in time (consentTime,
 * level1Time, level2Time, createdAt, updatedAt) are ISO 8601 timestamps.
 */

// ---------------------------------------------------------------------------
// Enums (const object + union type with the same name, so both
// `ApplicationStatus.InLevel1` and the literal 'In Level 1' type-check)
// ---------------------------------------------------------------------------

/** 6.9 Status values */
export const ApplicationStatus = {
  Draft: 'Draft',
  KycDone: 'KYC Done',
  Submitted: 'Submitted',
  InLevel1: 'In Level 1',
  InLevel2: 'In Level 2',
  Returned: 'Returned',
  Approved: 'Approved',
  Rejected: 'Rejected',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

/** 6.7 Check status values (PAN Status, Aadhaar Status, GST Status) */
export const CheckStatus = {
  Pending: 'Pending',
  Checking: 'Checking',
  Verified: 'Verified',
  Failed: 'Failed',
  Unavailable: 'Unavailable',
  NotApplicable: 'Not applicable',
  OtpRequired: 'OTP required',
} as const;
export type CheckStatus = (typeof CheckStatus)[keyof typeof CheckStatus];

/** 6.7 KYC Overall Result */
export const KycResult = {
  Pass: 'Pass',
  Exception: 'Exception',
  Fail: 'Fail',
} as const;
export type KycResult = (typeof KycResult)[keyof typeof KycResult];

// ---------------------------------------------------------------------------
// Dropdown value types (the option lists live in options.ts)
// ---------------------------------------------------------------------------

export type LoanProduct = 'Home Loan';

export type LoanPurpose =
  | 'Construction of house'
  | 'Purchase of flat'
  | 'Purchase of plot'
  | 'Takeover of housing loan'
  | 'Property mortgage';

export type Occupation = 'Salaried' | 'Business' | 'Professional' | 'Agriculturist';

export type SecurityType = 'Mortgage of unencumbered immovable property';

export type CoApplicantRelation = 'Spouse' | 'Son' | 'Father' | 'Mother';

export type DateOfBirthMatch = 'Exact' | 'Mismatch';

/** GSTIN Status as returned by the (mock) GST source. Values are an assumption. */
export type GstinStatus = 'Active' | 'Cancelled' | 'Not applicable';

/** Level 1 Decision and Level 2 Decision */
export type ApprovalDecision = 'Approved' | 'Returned' | 'Rejected';

/** Section 10: each DocType is tied 1:1 to a file. */
export type DocType =
  // KYC
  | 'PAN Card'
  | 'Aadhaar (Masked Copy)'
  | 'Photograph'
  | 'Address Proof'
  // Income
  | 'Income Proof'
  | 'GST Certificate or Business Licence'
  | 'Surety Documents'
  // Property
  | 'Sale or Gift Deed'
  | 'Records of Rights'
  | 'Encumbrance Certificate'
  | 'Building Permission'
  | 'Valuation Certificate'
  | 'Tax Paid Receipt';

export type DocTypeGroup = 'KYC' | 'Income' | 'Property';

/**
 * Allowed upload types (section 7: PDF, JPG or PNG, up to 5 MB). A supporting attachment may also be
 * a Word document (DOCX).
 */
export type DocumentMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The DocType tag of a file that is attached to an application beside its 13 documents (any number of them). */
export const SUPPORTING_DOCUMENT = 'Supporting Document' as const;
export type SupportingDocument = typeof SUPPORTING_DOCUMENT;

/** An uploaded file, tagged with its DocType. Only metadata is kept; there is no real storage. */
export interface ApplicationDocument {
  id: string;
  /** One of the DocTypes of the form (1:1 with its file), or 'Supporting Document' for an attachment */
  docType: DocType | SupportingDocument;
  fileName: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  /**
   * Local preview link (a blob: URL made from the chosen file). It only works in the browser tab
   * that made it, so it is not saved to localStorage. Scenario placeholder files have none.
   */
  previewUrl?: string;
  /** 'v1.0', and the next one ('v1.1') each time the file is replaced; absent on a file of the seed (the first) */
  version?: string;
  /** What the person who attached a supporting file wrote about it (optional) */
  note?: string;
  /**
   * Set when the application gets its final approval and its files are filed (section 10): the
   * DocType tag the file carries and the folder it is stored in. Absent until then, while the file
   * is still inside the workflow. No file is moved anywhere: this only records where it belongs.
   */
  filing?: DocumentFiling;
}

export interface DocumentFiling {
  /** The DocType tag applied on approval (the name of the DocType) */
  docTypeTag: DocType | SupportingDocument;
  /** For example 'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0006 Ramesh Patil/01 KYC' */
  folderPath: string;
  /** ISO date and time of filing */
  storedAt: string;
}

// ---------------------------------------------------------------------------
// The master record
// ---------------------------------------------------------------------------

type OrEmpty<T> = T | '';

export interface HomeLoanApplication {
  // 6.1 Application
  /** auto, format HL-2026-0001 */
  applicationId: string;
  branch: string;
  loanProduct: LoanProduct;
  loanPurpose: OrEmpty<LoanPurpose>;
  /** Maximum 30,00,000 */
  loanAmountRequested: number | null;
  /** Tenure (months). Maximum 240 */
  tenureMonths: number | null;
  /** auto, today */
  applicationDate: string;

  // 6.2 Applicant
  /** Full Name (as per PAN) */
  fullNameAsPerPan: string;
  dateOfBirth: string;
  /** 10 digits */
  mobile: string;
  email: string;
  occupation: OrEmpty<Occupation>;
  monthlyIncome: number | null;
  address: string;
  /** 6 digits */
  pinCode: string;

  // 6.3 Identity
  pan: string;
  /**
   * ALWAYS masked: 'XXXX XXXX 4821' (or ''). The full number exists only in form input state.
   * Everything written through the store is passed through maskAadhaar().
   */
  aadhaar: string;
  /** Shown only when occupation is Business or Professional */
  gstin: string;

  // 6.4 Property and security
  propertyAddress: string;
  /** Must match the applicant */
  propertyOwnerName: string;
  estimatedCost: number | null;
  /** calculated: see computeEligibleAmount(). null until a Loan Purpose is chosen. */
  eligibleAmount: number | null;
  securityType: OrEmpty<SecurityType>;

  // 6.5 Co-applicant and sureties (captured as data only, no KYC)
  /** The "Add a co-applicant" toggle (not a section 6 field). Forced on when coApplicantRequired is Yes. */
  addCoApplicant: boolean;
  /** calculated: 'Yes' if applicant age is above 60 (rule unclear, section 16) */
  coApplicantRequired: 'Yes' | 'No';
  coApplicantName: string;
  coApplicantRelation: OrEmpty<CoApplicantRelation>;
  surety1Name: string;
  surety1Mobile: string;
  surety1Pan: string;
  surety2Name: string;
  surety2Mobile: string;
  surety2Pan: string;

  // 6.6 Consent
  /** Mandatory before Step 2 */
  consentGiven: boolean;
  /** auto, system timestamp ('' until consent is given) */
  consentTime: string;

  // 6.7 KYC validation (Step 2, system-written, read-only)
  panStatus: CheckStatus;
  panNameAsPerSource: string;
  aadhaarStatus: CheckStatus;
  /** Mock reference ID. Never the Aadhaar number. */
  aadhaarReference: string;
  gstStatus: CheckStatus;
  gstLegalName: string;
  gstinStatus: OrEmpty<GstinStatus>;
  nameMatchPercent: number | null;
  dateOfBirthMatch: OrEmpty<DateOfBirthMatch>;
  /** Date of birth on the source's record, ISO (not a section 6.7 field; the comparison table shows it) */
  dateOfBirthAsPerSource: string;
  /** '' until the checks have run */
  kycOverallResult: OrEmpty<KycResult>;
  /** Required when kycOverallResult is Exception */
  kycExceptionRemark: string;
  kycCheckedOn: string;
  retryCount: number;

  // 6.8 Approval fields (filled in the workflow)
  level1Approver: string;
  level1Decision: OrEmpty<ApprovalDecision>;
  level1Remarks: string;
  level1Time: string;
  level2Approver: string;
  level2Decision: OrEmpty<ApprovalDecision>;
  level2Remarks: string;
  level2Time: string;
  /** Defaults to the requested amount, cannot exceed eligibleAmount */
  sanctionedAmount: number | null;
  /** Defaults to today */
  sanctionDate: string;

  // 6.9 Status and attachments
  status: ApplicationStatus;
  documents: ApplicationDocument[];

  // Bookkeeping (not part of section 6)
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Demo users (section 5) and scenarios (section 13)
// ---------------------------------------------------------------------------

export type UserRole = 'loanOfficer' | 'branchManager' | 'creditApprover' | 'admin';

export type DemoUserId = 'priya' | 'mahesh' | 'sunita' | 'admin';

/**
 * Things a demo user can do. Which role can do what is in `roles.ts`. The overview does not say
 * this in one place; the table follows sections 4 and 5 and is an assumption to confirm.
 */
export type UserAction =
  | 'createApplication'
  | 'resubmitApplication'
  | 'reviewLevel1'
  | 'reviewLevel2'
  | 'viewAllApplications'
  | 'viewWorkflow';

/**
 * A task waiting for an approver. The workflow step creates these when an application reaches
 * Level 1 or Level 2; until then the list is empty.
 */
export interface ApprovalTask {
  id: string;
  applicationId: string;
  applicantName: string;
  /** 1 for the Branch Manager, 2 for the Credit approver */
  level: 1 | 2;
  /** The demo user it waits for */
  assignedTo: DemoUserId;
  /** ISO date and time it arrived */
  receivedAt: string;
}

export interface DemoUser {
  id: DemoUserId;
  name: string;
  role: UserRole;
  /** Title shown next to the name, for example "Level 1 approver, Branch Manager" */
  roleLabel: string;
  /** Branch or office, exactly as in section 5 */
  branch: string;
}

export type ScenarioKey = 'A' | 'B' | 'C';

/** Which step of the master form is showing: 1 application, 2 KYC validation, 3 review and submit. */
export type FormStep = 1 | 2 | 3;

/** The three checks of Step 2 */
export type KycCheckKey = 'pan' | 'aadhaar' | 'gst';

/**
 * Presets for the demo to simulate a government source being down (set from the demo controls).
 * An Unavailable source is retried up to three times, then counts as an Exception.
 */
export type KycOutage = 'none' | 'pan-once' | 'pan-down' | 'gst-down';

/** A file to attach when a scenario is filled. The store adds id, time and uploader. */
export type ScenarioDocument = Pick<ApplicationDocument, 'fileName' | 'mimeType' | 'sizeBytes'> & {
  docType: DocType;
};

/** What the mocked government sources return for a scenario's applicant (used by the mock KYC). */
export interface ScenarioKycSource {
  panNameAsPerSource: string;
  panActive: boolean;
  /** Fixed per scenario so the demo always gives the same result */
  nameMatchPercent: number;
  /** Date of birth on the source's record, ISO. Same as entered unless a scenario says otherwise. */
  dateOfBirth: string;
  /** null when the applicant has no GSTIN */
  gstLegalName: string | null;
  /** Registration status at the GST source; null when the applicant has no GSTIN */
  gstinStatus: 'Active' | 'Cancelled' | null;
}

export interface Scenario {
  key: ScenarioKey;
  /** Short label, for example "Clean pass" */
  label: string;
  description: string;
  /** Step 1 values. Everything not listed stays at its blank default. */
  application: Partial<HomeLoanApplication>;
  documents: ScenarioDocument[];
  /**
   * Dummy, Verhoeff-valid number used ONLY to prefill the Aadhaar form input. It is never put in
   * the store or in localStorage (the store holds the masked value).
   */
  aadhaarInput: string;
  kycSource: ScenarioKycSource;
}

// ---------------------------------------------------------------------------
// Workflow "Home Loan Approval" (section 9) and the audit trail (section 11)
// ---------------------------------------------------------------------------

/** What a node of a workflow instance is doing. */
export const WorkflowNodeStatus = {
  /** The step is finished and there was no decision to take (the Initiator, and the filing step) */
  Done: 'Done',
  /** It is this node's turn: the person it is assigned to has to act */
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Returned: 'Returned',
  /** Not reached yet */
  Waiting: 'Waiting',
} as const;
export type WorkflowNodeStatus = (typeof WorkflowNodeStatus)[keyof typeof WorkflowNodeStatus];

/** How the whole instance stands. */
export const WorkflowInstanceStatus = {
  InProgress: 'In Progress',
  Completed: 'Completed',
  Rejected: 'Rejected',
  Returned: 'Returned',
} as const;
export type WorkflowInstanceStatus =
  (typeof WorkflowInstanceStatus)[keyof typeof WorkflowInstanceStatus];

export interface WorkflowNode {
  /** 1 to 4: Initiator, Level 1, Level 2, Record creation and filing */
  index: number;
  name: string;
  /** Who may act on it. 'system' for the automatic filing step. */
  role: UserRole | 'system';
  /** The person it is assigned to (a demo user's name), or 'System' */
  assignee: string;
  status: WorkflowNodeStatus;
  /** Who acted ('' until someone has) */
  actedBy: string;
  /** ISO date and time of the action ('' until then) */
  actedAt: string;
  /** What the person wrote with the decision ('' if nothing) */
  comment: string;
}

export interface WorkflowInstance {
  /** WI- and eight digits, for example WI-23445213 */
  id: string;
  workflowName: 'Home Loan Approval';
  applicationId: string;
  /** The loan officer who submitted (a name) */
  initiatedBy: string;
  /** ISO date and time of the submission */
  initiatedAt: string;
  status: WorkflowInstanceStatus;
  /** `index` of the node that is, or was last, in play */
  currentNodeIndex: number;
  nodes: WorkflowNode[];
}

/** The events of section 11. */
export type AuditEventName =
  | 'Application created'
  | 'Field changed'
  | 'Document uploaded'
  | 'Consent given'
  | 'KYC check run'
  | 'KYC result set'
  | 'Submitted'
  | 'Workflow started'
  | 'Level 1 decision'
  | 'Returned'
  | 'Resubmitted'
  | 'Level 2 decision'
  | 'Record created'
  | 'Files stored'
  | 'Rejected'
  | 'Comment added'
  | 'Document replaced'
  | 'Document removed'
  | 'Attachment added'
  | 'Attachment removed';

/**
 * One line of the audit trail of an application. The Aadhaar number never appears here: a KYC
 * check carries its mock reference ID, not the number.
 */
export interface AuditEvent {
  id: string;
  applicationId: string;
  event: AuditEventName;
  /** Who did it (a name, or 'System') */
  user: string;
  /** ISO date and time */
  at: string;
  /** What the person wrote, for a decision */
  comment: string;
  /** For a change of a value: the field and what it was and what it became */
  field: string;
  oldValue: string;
  newValue: string;
  /** For example the mock reference ID of a KYC check */
  reference: string;
}

/**
 * A comment on an application, written in the record sheet's side panel (a loan note). The decisions of
 * the approvers are not here: the panel takes their comments from the audit trail.
 */
export interface RecordComment {
  /** CM- and five digits, for example CM-00007 */
  id: string;
  applicationId: string;
  /** Who wrote it: a demo user's name, or another officer's */
  author: string;
  /** What the person is, as the chip says it: Loan officer, Branch Manager, Credit approver, Administrator */
  authorRole: string;
  /** The text. The Aadhaar number is never in it: it was masked on its way in. */
  text: string;
  /** ISO date and time */
  at: string;
}

/** A message for a user, shown in the bell. The loan officer gets one when a decision is made. */
export interface AppNotification {
  id: string;
  userId: DemoUserId;
  applicationId: string;
  instanceId: string;
  message: string;
  at: string;
  read: boolean;
}
