import type {
  CoApplicantRelation,
  DocType,
  DocTypeGroup,
  LoanProduct,
  LoanPurpose,
  Occupation,
  SecurityType,
} from './types';

/** Branch names are dummy. The bank has about 100 branches; the demo uses a few. */
export const BRANCHES = [
  'Belagavi Main Branch (demo)',
  'Gokak Branch (demo)',
  'Athani Branch (demo)',
  'Bailhongal Branch (demo)',
] as const;

export const LOAN_PRODUCTS: LoanProduct[] = ['Home Loan'];

export const LOAN_PURPOSES: LoanPurpose[] = [
  'Construction of house',
  'Purchase of flat',
  'Purchase of plot',
  'Takeover of housing loan',
  'Property mortgage',
];

export const OCCUPATIONS: Occupation[] = ['Salaried', 'Business', 'Professional', 'Agriculturist'];

export const SECURITY_TYPES: SecurityType[] = ['Mortgage of unencumbered immovable property'];

export const CO_APPLICANT_RELATIONS: CoApplicantRelation[] = ['Spouse', 'Son', 'Father', 'Mother'];

/** Section 10, in display order, grouped as in the folder structure. */
export const DOC_TYPE_GROUPS: Record<DocTypeGroup, DocType[]> = {
  KYC: ['PAN Card', 'Aadhaar (Masked Copy)', 'Photograph', 'Address Proof'],
  Income: ['Income Proof', 'GST Certificate or Business Licence', 'Surety Documents'],
  Property: [
    'Sale or Gift Deed',
    'Records of Rights',
    'Encumbrance Certificate',
    'Building Permission',
    'Valuation Certificate',
    'Tax Paid Receipt',
  ],
};

export const DOC_TYPES: DocType[] = Object.values(DOC_TYPE_GROUPS).flat();

/** Business rules from section 7 (bank values, to be confirmed by the bank). */
export const LIMITS = {
  maxLoanAmount: 3_000_000,
  maxTenureMonths: 240,
  eligiblePercent: 75,
  minAge: 18,
  maxAge: 55,
  coApplicantAboveAge: 60,
  maxUploadBytes: 5 * 1024 * 1024,
} as const;

/** Section 7 upload rule: PDF, JPG or PNG. */
export const ALLOWED_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/** What a supporting attachment may be besides the three above: a Word document (DOCX). */
export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const;

/** Section 8: how the name match decides the KYC result. */
export const KYC_THRESHOLDS = {
  /** at least this: Pass (with everything else verified) */
  passNameMatch: 95,
  /** below this: Fail; from here up to the pass limit: Exception */
  failNameMatch: 70,
} as const;
