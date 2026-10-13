/**
 * Demo data. Everything here is dummy: no real PAN, Aadhaar or GSTIN.
 * Users: PROJECT_OVERVIEW.md section 5. Scenarios: section 13.
 */
import {
  applyCalculatedFields,
  computeEligibleAmount,
  createBlankApplication,
  requiredDocTypes,
  toApplicationDocuments,
} from './application';
import { maskAadhaar, maskedFromLast4 } from './aadhaar';
import { DEMO_USERS } from './users';
import { fileDocuments } from './workflow';
import {
  ApplicationStatus,
  CheckStatus,
  KycResult,
  SUPPORTING_DOCUMENT,
  type ApplicationDocument,
  type ApprovalDecision,
  type DocType,
  type DocumentMimeType,
  type HomeLoanApplication,
  type Occupation,
  type Scenario,
  type ScenarioDocument,
  type ScenarioKey,
} from './types';

// The users (section 5) live in users.ts; they are re-exported here because most code imports them from seed.
export { DEFAULT_USER_ID, DEMO_USERS } from './users';

// ---------------------------------------------------------------------------
// Mock files
// ---------------------------------------------------------------------------

/** Placeholder scans: a base name and a typical size for each DocType. */
const MOCK_FILES: Record<
  DocType,
  { base: string; ext: 'pdf' | 'jpg'; sizeBytes: number; salariedBase?: string }
> = {
  'PAN Card': { base: 'PAN_Card', ext: 'pdf', sizeBytes: 184_320 },
  'Aadhaar (Masked Copy)': { base: 'Aadhaar_Masked_Copy', ext: 'pdf', sizeBytes: 212_992 },
  Photograph: { base: 'Passport_Photo', ext: 'jpg', sizeBytes: 98_304 },
  'Address Proof': { base: 'Address_Proof_Electricity_Bill', ext: 'pdf', sizeBytes: 356_352 },
  'Income Proof': {
    base: 'ITR_Acknowledgement_FY2025-26',
    salariedBase: 'Salary_Slips_Last_3_Months',
    ext: 'pdf',
    sizeBytes: 512_000,
  },
  'GST Certificate or Business Licence': {
    base: 'GST_Registration_Certificate',
    ext: 'pdf',
    sizeBytes: 276_480,
  },
  'Surety Documents': { base: 'Surety_Documents', ext: 'pdf', sizeBytes: 640_000 },
  'Sale or Gift Deed': { base: 'Sale_Deed', ext: 'pdf', sizeBytes: 2_150_400 },
  'Records of Rights': { base: 'RTC_Record_of_Rights', ext: 'pdf', sizeBytes: 884_736 },
  'Encumbrance Certificate': { base: 'Encumbrance_Certificate_EC', ext: 'pdf', sizeBytes: 421_888 },
  'Building Permission': { base: 'Building_Permission_Order', ext: 'pdf', sizeBytes: 1_126_400 },
  'Valuation Certificate': { base: 'Valuation_Certificate', ext: 'pdf', sizeBytes: 1_572_864 },
  'Tax Paid Receipt': { base: 'Property_Tax_Paid_Receipt', ext: 'pdf', sizeBytes: 198_656 },
};

/** One placeholder file per required DocType, named after the applicant, for example PAN_Card_Ramesh_Patil.pdf */
function mockDocuments(occupation: Occupation, applicantName: string): ScenarioDocument[] {
  const owner = applicantName.trim().replace(/\s+/g, '_');
  return requiredDocTypes(occupation).map((docType) => {
    const file = MOCK_FILES[docType];
    const base = occupation === 'Salaried' && file.salariedBase ? file.salariedBase : file.base;
    return {
      docType,
      fileName: `${base}_${owner}.${file.ext}`,
      mimeType: file.ext === 'jpg' ? 'image/jpeg' : 'application/pdf',
      sizeBytes: file.sizeBytes,
    };
  });
}

// ---------------------------------------------------------------------------
// Scenarios (section 13)
// ---------------------------------------------------------------------------

const PROPERTY_ADDRESS = 'Plot 21, Shivaji Nagar, Belagavi, Karnataka';
const HOME_ADDRESS = 'House 7, Tilakwadi, Belagavi, Karnataka';

/**
 * All three scenarios use Construction of house (the overview does not name a purpose for B and C,
 * but their eligible amounts in section 13 follow the construction rule).
 * Co-applicant Required depends on the application date, so the store works it out on fill.
 */
function scenarioApplication(values: Partial<HomeLoanApplication>): Partial<HomeLoanApplication> {
  return {
    ...values,
    loanPurpose: 'Construction of house',
    eligibleAmount: computeEligibleAmount('Construction of house', values.estimatedCost ?? null),
  };
}

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
  A: {
    key: 'A',
    label: 'Clean pass',
    description: 'Ramesh Patil, Business. All checks verified. Both levels approve.',
    application: scenarioApplication({
      loanAmountRequested: 1_800_000,
      tenureMonths: 180,
      fullNameAsPerPan: 'Ramesh Patil',
      dateOfBirth: '1984-03-14',
      mobile: '9876500011',
      email: 'ramesh.patil@example.com',
      occupation: 'Business',
      monthlyIncome: 150_000,
      address: HOME_ADDRESS,
      pinCode: '590006',
      pan: 'ABCPP1234F',
      aadhaar: maskAadhaar('234500074821'),
      gstin: '29ABCPP1234F1Z5',
      propertyAddress: PROPERTY_ADDRESS,
      propertyOwnerName: 'Ramesh Patil',
      estimatedCost: 2_600_000,
      surety1Name: 'Mohan Joshi',
      surety1Mobile: '9876500111',
      surety1Pan: 'ABCPS1101A',
      surety2Name: 'Sanjay Shinde',
      surety2Mobile: '9876500112',
      surety2Pan: 'ABCPS1102B',
    }),
    documents: mockDocuments('Business', 'Ramesh Patil'),
    aadhaarInput: '234500074821',
    kycSource: {
      panNameAsPerSource: 'RAMESH PATIL',
      panActive: true,
      nameMatchPercent: 100,
      dateOfBirth: '1984-03-14',
      gstLegalName: 'RAMESH PATIL',
      gstinStatus: 'Active',
    },
  },
  B: {
    key: 'B',
    label: 'Exception',
    description: 'Anita Desai, Salaried. Name matches 86%, so the officer adds a remark.',
    application: scenarioApplication({
      loanAmountRequested: 1_200_000,
      tenureMonths: 120,
      fullNameAsPerPan: 'Anita Desai',
      dateOfBirth: '1990-09-02',
      mobile: '9876500012',
      email: 'anita.desai@example.com',
      occupation: 'Salaried',
      monthlyIncome: 85_000,
      address: HOME_ADDRESS,
      pinCode: '590001',
      pan: 'ABCPD5678K',
      aadhaar: maskAadhaar('234500037733'),
      propertyAddress: PROPERTY_ADDRESS,
      propertyOwnerName: 'Anita Desai',
      estimatedCost: 1_650_000,
      surety1Name: 'Rekha Desai',
      surety1Mobile: '9876500113',
      surety1Pan: 'ABCPS1103C',
      surety2Name: 'Prakash Kamat',
      surety2Mobile: '9876500114',
      surety2Pan: 'ABCPS1104D',
    }),
    documents: mockDocuments('Salaried', 'Anita Desai'),
    aadhaarInput: '234500037733',
    kycSource: {
      panNameAsPerSource: 'ANITA R DESAI',
      panActive: true,
      nameMatchPercent: 86,
      dateOfBirth: '1990-09-02',
      gstLegalName: null,
      gstinStatus: null,
    },
  },
  C: {
    key: 'C',
    label: 'Fail',
    description: 'Kiran Naik, Salaried. PAN is inactive, so submit is blocked.',
    application: scenarioApplication({
      loanAmountRequested: 1_000_000,
      tenureMonths: 120,
      fullNameAsPerPan: 'Kiran Naik',
      dateOfBirth: '1988-06-21',
      mobile: '9876500013',
      email: 'kiran.naik@example.com',
      occupation: 'Salaried',
      monthlyIncome: 60_000,
      address: HOME_ADDRESS,
      pinCode: '590003',
      pan: 'ABCPD9012L',
      aadhaar: maskAadhaar('234500042290'),
      propertyAddress: PROPERTY_ADDRESS,
      propertyOwnerName: 'Kiran Naik',
      estimatedCost: 1_400_000,
      surety1Name: 'Deepak Naik',
      surety1Mobile: '9876500115',
      surety1Pan: 'ABCPS1105E',
      surety2Name: 'Sunil Gaonkar',
      surety2Mobile: '9876500116',
      surety2Pan: 'ABCPS1106F',
    }),
    documents: mockDocuments('Salaried', 'Kiran Naik'),
    aadhaarInput: '234500042290',
    kycSource: {
      panNameAsPerSource: 'KIRAN NAIK',
      panActive: false,
      nameMatchPercent: 100,
      dateOfBirth: '1988-06-21',
      gstLegalName: null,
      gstinStatus: null,
    },
  },
};

export const SCENARIO_KEYS: ScenarioKey[] = ['A', 'B', 'C'];

// ---------------------------------------------------------------------------
// Existing applications for the list screen (mixed statuses)
// ---------------------------------------------------------------------------

interface SeedInput {
  seq: number;
  name: string;
  branch: string;
  createdBy: string;
  occupation: Occupation;
  dateOfBirth: string;
  pan: string;
  aadhaarLast4: string;
  gstin?: string;
  loanPurpose: HomeLoanApplication['loanPurpose'];
  amount: number;
  tenure: number;
  cost: number;
  applicationDate: string;
  status: HomeLoanApplication['status'];
  sureties: [string, string];
  /** Mock name returned by the PAN source. Defaults to the applicant name in capitals. */
  sourceName?: string;
  nameMatchPercent?: number;
  kycExceptionRemark?: string;
  level1?: { decision: ApprovalDecision; remarks: string; date: string };
  level2?: { decision: ApprovalDecision; remarks: string; date: string; sanctioned?: number };
  /** A draft: no consent, no KYC result, and only the first three documents uploaded */
  draft?: boolean;
}

function seedApplication(input: SeedInput): HomeLoanApplication {
  const id = `HL-2026-${String(input.seq).padStart(4, '0')}`;
  const blank = createBlankApplication({
    applicationId: id,
    branch: input.branch,
    createdBy: input.createdBy,
    now: new Date(`${input.applicationDate}T10:00:00+05:30`),
  });
  const hasGst = input.occupation === 'Business' || input.occupation === 'Professional';
  const sourceName = input.sourceName ?? input.name.toUpperCase();
  const nameMatch = input.nameMatchPercent ?? 100;
  const isException = nameMatch < 95;
  const lastEvent = input.level2?.date ?? input.level1?.date ?? input.applicationDate;
  const uploadedAt = `${input.applicationDate}T10:30:00+05:30`;
  const n = String(input.seq).padStart(2, '0');

  const app: HomeLoanApplication = {
    ...blank,
    applicationDate: input.applicationDate,
    loanPurpose: input.loanPurpose,
    loanAmountRequested: input.amount,
    tenureMonths: input.tenure,

    fullNameAsPerPan: input.name,
    dateOfBirth: input.dateOfBirth,
    mobile: `98765002${n}`,
    email: `${input.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    occupation: input.occupation,
    monthlyIncome: 70_000 + input.seq * 5_000,
    address: HOME_ADDRESS,
    pinCode: '590001',

    pan: input.pan,
    aadhaar: maskedFromLast4(input.aadhaarLast4),
    gstin: input.gstin ?? '',

    propertyAddress: PROPERTY_ADDRESS,
    propertyOwnerName: input.name,
    estimatedCost: input.cost,

    surety1Name: input.sureties[0],
    surety1Mobile: `98765003${n}`,
    surety1Pan: `ABCPS20${n}A`,
    surety2Name: input.sureties[1],
    surety2Mobile: `98765004${n}`,
    surety2Pan: `ABCPS30${n}B`,

    consentGiven: true,
    consentTime: uploadedAt,

    panStatus: CheckStatus.Verified,
    panNameAsPerSource: sourceName,
    aadhaarStatus: CheckStatus.Verified,
    aadhaarReference: `MOCK-AAD-${input.applicationDate.replace(/-/g, '')}-${n}`,
    gstStatus: hasGst ? CheckStatus.Verified : CheckStatus.NotApplicable,
    gstLegalName: hasGst ? sourceName : '',
    gstinStatus: hasGst ? 'Active' : 'Not applicable',
    nameMatchPercent: nameMatch,
    dateOfBirthMatch: 'Exact',
    kycOverallResult: isException ? KycResult.Exception : KycResult.Pass,
    kycExceptionRemark: input.kycExceptionRemark ?? '',
    kycCheckedOn: input.applicationDate,

    status: input.status,
    documents: toApplicationDocuments(
      id,
      mockDocuments(input.occupation, input.name),
      input.createdBy,
      uploadedAt,
    ),
    updatedAt: `${lastEvent}T12:00:00+05:30`,
  };

  if (input.draft) {
    // still being filled in: no consent yet, the checks not run, three files uploaded
    Object.assign(app, {
      consentGiven: false,
      consentTime: '',
      panStatus: blank.panStatus,
      panNameAsPerSource: '',
      aadhaarStatus: blank.aadhaarStatus,
      aadhaarReference: '',
      gstStatus: blank.gstStatus,
      gstLegalName: '',
      gstinStatus: '',
      nameMatchPercent: null,
      dateOfBirthMatch: '',
      kycOverallResult: '',
      kycExceptionRemark: '',
      kycCheckedOn: '',
      documents: app.documents.slice(0, 3),
    });
  }

  if (input.level1) {
    app.level1Approver = DEMO_USERS.mahesh.name;
    app.level1Decision = input.level1.decision;
    app.level1Remarks = input.level1.remarks;
    app.level1Time = `${input.level1.date}T11:00:00+05:30`;
  }
  if (input.level2) {
    app.level2Approver = DEMO_USERS.sunita.name;
    app.level2Decision = input.level2.decision;
    app.level2Remarks = input.level2.remarks;
    app.level2Time = `${input.level2.date}T15:00:00+05:30`;
    if (input.level2.decision === 'Approved') {
      app.sanctionedAmount = input.level2.sanctioned ?? input.amount;
      app.sanctionDate = input.level2.date;
    }
  }
  return applyCalculatedFields(app);
}

const RAW_SEED_APPLICATIONS: HomeLoanApplication[] = [
  seedApplication({
    seq: 1,
    name: 'Vijay Kulkarni',
    branch: 'Belagavi Main Branch (demo)',
    createdBy: 'Priya Kulkarni',
    occupation: 'Salaried',
    dateOfBirth: '1979-07-22',
    pan: 'ABCPK2101L',
    aadhaarLast4: '3345',
    loanPurpose: 'Construction of house',
    amount: 2_000_000,
    tenure: 200,
    cost: 2_800_000,
    applicationDate: '2026-08-18',
    status: ApplicationStatus.Approved,
    sureties: ['Ganesh Kulkarni', 'Anil Deshpande'],
    level1: { decision: 'Approved', remarks: 'Documents are in order.', date: '2026-08-21' },
    level2: { decision: 'Approved', remarks: 'Sanctioned as requested.', date: '2026-08-26' },
  }),
  seedApplication({
    seq: 2,
    name: 'Shobha Gaonkar',
    branch: 'Belagavi Main Branch (demo)',
    createdBy: 'Priya Kulkarni',
    occupation: 'Business',
    dateOfBirth: '1982-11-05',
    pan: 'ABCPM3302N',
    aadhaarLast4: '5512',
    gstin: '29ABCPM3302N1Z3',
    loanPurpose: 'Construction of house',
    amount: 1_500_000,
    tenure: 150,
    cost: 2_200_000,
    applicationDate: '2026-09-14',
    status: ApplicationStatus.InLevel2,
    sureties: ['Ravi Gaonkar', 'Meena Patil'],
    level1: { decision: 'Approved', remarks: 'Business income verified.', date: '2026-09-17' },
  }),
  seedApplication({
    seq: 3,
    name: 'Manjunath Hiremath',
    branch: 'Gokak Branch (demo)',
    createdBy: 'Gokak loan officer (demo)',
    occupation: 'Salaried',
    dateOfBirth: '1986-01-30',
    pan: 'ABCPS4403Q',
    aadhaarLast4: '6620',
    loanPurpose: 'Construction of house',
    amount: 1_200_000,
    tenure: 120,
    cost: 1_600_000,
    applicationDate: '2026-10-05',
    status: ApplicationStatus.InLevel1,
    sureties: ['Shankar Hiremath', 'Lata Kulkarni'],
  }),
  seedApplication({
    seq: 4,
    name: 'Savita Patil',
    branch: 'Belagavi Main Branch (demo)',
    createdBy: 'Priya Kulkarni',
    occupation: 'Agriculturist',
    dateOfBirth: '1975-04-12',
    pan: 'ABCPT5504R',
    aadhaarLast4: '7781',
    loanPurpose: 'Construction of house',
    amount: 800_000,
    tenure: 96,
    cost: 1_200_000,
    applicationDate: '2026-09-22',
    status: ApplicationStatus.Returned,
    sureties: ['Dattatray Patil', 'Kavita Jadhav'],
    level1: {
      decision: 'Returned',
      remarks: 'Income Proof is not readable. Upload a clear copy and resubmit.',
      date: '2026-09-25',
    },
  }),
  seedApplication({
    seq: 5,
    name: 'Basavaraj Kadam',
    branch: 'Athani Branch (demo)',
    createdBy: 'Athani loan officer (demo)',
    occupation: 'Business',
    dateOfBirth: '1980-12-19',
    pan: 'ABCPJ6605H',
    aadhaarLast4: '8894',
    gstin: '29ABCPJ6605H1Z8',
    loanPurpose: 'Construction of house',
    amount: 2_500_000,
    tenure: 240,
    cost: 3_400_000,
    applicationDate: '2026-09-02',
    status: ApplicationStatus.Rejected,
    sureties: ['Mahadev Kadam', 'Pooja Hegde'],
    sourceName: 'BASAVARAJ S KADAM',
    nameMatchPercent: 88,
    kycExceptionRemark:
      'Middle initial missing in the application. Documents show the same person.',
    level1: {
      decision: 'Approved',
      remarks: 'KYC exception noted, documents match.',
      date: '2026-09-04',
    },
    level2: {
      decision: 'Rejected',
      remarks: 'Repayment capacity is not enough for the requested amount.',
      date: '2026-09-09',
    },
  }),
  // a second approved application, and a draft that has three files so far
  seedApplication({
    seq: 6,
    name: 'Meera Joshi',
    branch: 'Belagavi Main Branch (demo)',
    createdBy: 'Priya Kulkarni',
    occupation: 'Salaried',
    dateOfBirth: '1985-05-11',
    pan: 'ABCPJ7706M',
    aadhaarLast4: '9907',
    loanPurpose: 'Construction of house',
    amount: 1_600_000,
    tenure: 180,
    cost: 2_200_000,
    applicationDate: '2026-09-25',
    status: ApplicationStatus.Approved,
    sureties: ['Ramesh Joshi', 'Sunanda Kulkarni'],
    level1: { decision: 'Approved', remarks: 'Documents and income verified.', date: '2026-09-29' },
    level2: { decision: 'Approved', remarks: 'Sanctioned as requested.', date: '2026-10-02' },
  }),
  seedApplication({
    seq: 7,
    name: 'Prakash Naik',
    branch: 'Belagavi Main Branch (demo)',
    createdBy: 'Priya Kulkarni',
    occupation: 'Salaried',
    dateOfBirth: '1991-02-17',
    pan: 'ABCPK8807N',
    aadhaarLast4: '1135',
    loanPurpose: 'Purchase of plot',
    amount: 1_000_000,
    tenure: 120,
    cost: 1_500_000,
    applicationDate: '2026-10-10',
    status: ApplicationStatus.Draft,
    sureties: ['Mahesh Naik', 'Rekha Naik'],
    draft: true,
  }),
];

// ---------------------------------------------------------------------------
// Supporting files that were attached to the seed applications
// ---------------------------------------------------------------------------

interface SeedAttachment {
  fileName: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
  note: string;
  by: string;
  at: string;
}

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PRIYA = 'Priya Kulkarni';

/** One or two for each application: salary slips, a bill, a statement. Dummy names, never an Aadhaar number. */
const SEED_ATTACHMENTS: Record<string, SeedAttachment[]> = {
  'HL-2026-0001': [
    {
      fileName: 'Salary_Slip_Aug.pdf',
      mimeType: PDF,
      sizeBytes: 214_016,
      note: 'Latest salary slip, added after the first upload',
      by: PRIYA,
      at: '2026-08-19T11:00:00+05:30',
    },
    {
      fileName: 'Electricity_Bill.pdf',
      mimeType: PDF,
      sizeBytes: 143_360,
      note: 'Latest bill, the same address as the application',
      by: PRIYA,
      at: '2026-08-19T11:05:00+05:30',
    },
  ],
  'HL-2026-0002': [
    {
      fileName: 'Shop_Licence_Renewal.pdf',
      mimeType: PDF,
      sizeBytes: 276_480,
      note: 'Trade licence, renewed this year',
      by: PRIYA,
      at: '2026-09-15T12:00:00+05:30',
    },
    {
      fileName: 'Bank_Statement_Aug.pdf',
      mimeType: PDF,
      sizeBytes: 410_624,
      note: 'Business account, last six months',
      by: PRIYA,
      at: '2026-09-15T12:10:00+05:30',
    },
  ],
  'HL-2026-0003': [
    {
      fileName: 'Salary_Slip_Sept.pdf',
      mimeType: PDF,
      sizeBytes: 198_656,
      note: 'September slip, received after the first upload',
      by: 'Gokak loan officer (demo)',
      at: '2026-10-06T10:00:00+05:30',
    },
  ],
  'HL-2026-0004': [
    {
      fileName: 'Income_Certificate_Revenue_Office.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 322_560,
      note: 'Clear copy that the applicant brought after the return',
      by: PRIYA,
      at: '2026-09-26T16:50:00+05:30',
    },
  ],
  'HL-2026-0005': [
    {
      fileName: 'Bank_Statement_Aug.pdf',
      mimeType: PDF,
      sizeBytes: 398_336,
      note: 'Last six months of the business account',
      by: 'Athani loan officer (demo)',
      at: '2026-09-03T11:30:00+05:30',
    },
  ],
  'HL-2026-0006': [
    {
      fileName: 'Salary_Slip_Sept.pdf',
      mimeType: PDF,
      sizeBytes: 205_824,
      note: 'September slip',
      by: PRIYA,
      at: '2026-09-26T10:20:00+05:30',
    },
    {
      fileName: 'Property_Valuation_Notes.docx',
      mimeType: DOCX,
      sizeBytes: 48_128,
      note: 'Notes from the site visit with the valuer',
      by: 'Mahesh Joshi',
      at: '2026-09-28T12:15:00+05:30',
    },
  ],
  'HL-2026-0007': [
    {
      fileName: 'Electricity_Bill.pdf',
      mimeType: PDF,
      sizeBytes: 151_552,
      note: 'Latest bill',
      by: PRIYA,
      at: '2026-10-10T11:15:00+05:30',
    },
  ],
};

/** The application with its supporting files, tagged "Supporting Document", after its documents. */
function withAttachments(app: HomeLoanApplication): HomeLoanApplication {
  const documents: ApplicationDocument[] = (SEED_ATTACHMENTS[app.applicationId] ?? []).map(
    (file, index) => ({
      id: `${app.applicationId}-supporting-document-${index + 1}`,
      docType: SUPPORTING_DOCUMENT,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.at,
      uploadedBy: file.by,
      version: 'v1.0',
      note: file.note,
    }),
  );
  return documents.length === 0 ? app : { ...app, documents: [...app.documents, ...documents] };
}

/**
 * The seed applications. An approved one was approved some time ago, so its files are already filed
 * in their folders (each file carries its DocType tag and folder path). Its entry in the master
 * list's "All Records" tab is not made: that tab only holds records made by an approval in the demo.
 */
export const SEED_APPLICATIONS: HomeLoanApplication[] = RAW_SEED_APPLICATIONS.map(
  withAttachments,
).map((app) =>
  app.status === ApplicationStatus.Approved
    ? fileDocuments(app, new Date(Date.parse(app.level2Time) + 1000).toISOString())
    : app,
);
