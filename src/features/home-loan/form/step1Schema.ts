import {
  BRANCHES,
  CO_APPLICANT_RELATIONS,
  DOC_TYPE_GROUPS,
  LIMITS,
  LOAN_PRODUCTS,
  LOAN_PURPOSES,
  OCCUPATIONS,
  SECURITY_TYPES,
} from '@/data/options';
import type { HomeLoanApplication } from '@/data/types';
import { formatDateTime, formatIndianNumber } from '@/lib/format';
import {
  validateAge,
  validateEmail,
  validateGstin,
  validateLoanAmount,
  validateMaskedAadhaar,
  validateMobile,
  validateOwnerName,
  validatePan,
  validatePinCode,
  validateTenure,
} from '../validation/rules';
import type { FieldSchema, SectionSchema } from './schema';

const MAX_LOAN = formatIndianNumber(LIMITS.maxLoanAmount); // 30,00,000

/** GSTIN, and the GST certificate, are asked only of Business and Professional applicants */
const isBusinessOrProfessional = (values: HomeLoanApplication) =>
  values.occupation === 'Business' || values.occupation === 'Professional';

/** One upload slot per DocType, grouped KYC / Income / Property (PROJECT_OVERVIEW.md section 10) */
const documentFields: FieldSchema[] = Object.entries(DOC_TYPE_GROUPS).flatMap(([group, types]) =>
  types.map((docType): FieldSchema => ({
    key: 'documents',
    label: docType,
    type: 'attachment',
    docType,
    group,
    width: 'half',
    required: true,
    visibleWhen:
      docType === 'GST Certificate or Business Licence' ? isBusinessOrProfessional : undefined,
  })),
);

export const CONSENT_TEXT =
  'I authorise the bank to verify my PAN, Aadhaar and GST details with government sources for this loan application.';

/**
 * Step 1 as schema (PROJECT_OVERVIEW.md 6.1 to 6.6 and the documents of section 10), with no
 * hand-written form JSX. `required` draws the red asterisk and is checked; `validate` holds the
 * rule from section 7 (see validation/rules.ts).
 */
export const STEP1_SECTIONS: SectionSchema[] = [
  {
    id: 'application',
    title: 'Application',
    fields: [
      // auto: assigned by the store (HL-2026-0001)
      { key: 'applicationId', label: 'Application ID', type: 'text', readOnly: true },
      // default comes from the current user's branch when the draft is created
      { key: 'branch', label: 'Branch', type: 'dropdown', options: BRANCHES },
      {
        key: 'loanProduct',
        label: 'Loan Product',
        type: 'dropdown',
        options: LOAN_PRODUCTS,
        readOnly: true,
      },
      {
        key: 'loanPurpose',
        label: 'Loan Purpose',
        type: 'dropdown',
        options: LOAN_PURPOSES,
        // the Eligible Amount and the list of documents depend on it
        required: true,
      },
      {
        key: 'loanAmountRequested',
        label: 'Loan Amount Requested',
        type: 'number',
        required: true,
        validate: (values) => validateLoanAmount(values.loanAmountRequested, values),
      },
      {
        key: 'tenureMonths',
        label: 'Tenure (months)',
        type: 'number',
        required: true,
        validate: (values) => validateTenure(values.tenureMonths),
      },
      // auto: today
      { key: 'applicationDate', label: 'Application Date', type: 'date', readOnly: true },
    ],
  },
  {
    id: 'applicant',
    title: 'Applicant',
    fields: [
      { key: 'fullNameAsPerPan', label: 'Full Name (as per PAN)', type: 'text', required: true },
      {
        key: 'dateOfBirth',
        label: 'Date of Birth',
        type: 'date',
        required: true,
        validate: (values) => validateAge(values.dateOfBirth, values.applicationDate),
      },
      {
        key: 'mobile',
        label: 'Mobile',
        type: 'phone',
        required: true,
        validate: (values) => validateMobile(values.mobile),
      },
      {
        key: 'email',
        label: 'Email',
        type: 'email',
        required: true,
        validate: (values) => validateEmail(values.email),
      },
      {
        key: 'occupation',
        label: 'Occupation',
        type: 'dropdown',
        required: true,
        options: OCCUPATIONS,
      },
      { key: 'monthlyIncome', label: 'Monthly Income', type: 'number' },
      { key: 'address', label: 'Address', type: 'multiLine', width: 'twoThirds' },
      {
        key: 'pinCode',
        label: 'PIN Code',
        type: 'text',
        validate: (values) => validatePinCode(values.pinCode),
      },
    ],
  },
  {
    id: 'identity',
    title: 'Identity',
    fields: [
      {
        key: 'pan',
        label: 'PAN',
        type: 'text',
        required: true,
        uppercase: true,
        validate: (values) => validatePan(values.pan),
      },
      {
        key: 'aadhaar',
        label: 'Aadhaar',
        type: 'text',
        required: true,
        mask: 'aadhaar',
        // the record keeps only the masked value, which says whether a valid number was entered
        validate: (values) => validateMaskedAadhaar(values.aadhaar),
      },
      {
        key: 'gstin',
        label: 'GSTIN',
        type: 'text',
        uppercase: true,
        visibleWhen: isBusinessOrProfessional,
        // asked of a Business or Professional applicant only (it is not shown to the others), and the GST check needs it
        required: true,
        validate: (values) => validateGstin(values.gstin, values.pan),
      },
    ],
  },
  {
    id: 'property',
    title: 'Property and security',
    fields: [
      {
        key: 'propertyAddress',
        label: 'Property Address',
        type: 'multiLine',
        required: true,
        width: 'twoThirds',
      },
      {
        key: 'propertyOwnerName',
        label: 'Property Owner Name',
        type: 'text',
        required: true,
        validate: (values) => validateOwnerName(values.propertyOwnerName, values.fullNameAsPerPan),
      },
      { key: 'estimatedCost', label: 'Estimated Cost', type: 'number', required: true },
      {
        key: 'eligibleAmount',
        label: 'Eligible Amount',
        type: 'number',
        calculated: true,
        // the store recalculates it on every change (see computeEligibleAmount)
        helperText: (values) => {
          if (values.loanPurpose === '') return 'Select a Loan Purpose to see the eligible amount.';
          if (values.loanPurpose === 'Construction of house') {
            return `75% of Estimated Cost, up to ${MAX_LOAN}.`;
          }
          return `Maximum home loan amount: ${MAX_LOAN}.`;
        },
      },
      {
        key: 'securityType',
        label: 'Security Type',
        type: 'dropdown',
        width: 'twoThirds',
        options: SECURITY_TYPES,
      },
    ],
  },
  {
    id: 'co-applicant',
    title: 'Co-applicant',
    note: 'Optional.',
    fields: [
      {
        key: 'addCoApplicant',
        label: 'Add a co-applicant',
        type: 'toggle',
        width: 'full',
        // switched on and locked while the flag below is Yes
        disabledWhen: (values) => values.coApplicantRequired === 'Yes',
        helperText: (values) =>
          values.coApplicantRequired === 'Yes'
            ? 'A co-applicant is required because the applicant is above 60.'
            : undefined,
      },
      {
        key: 'coApplicantRequired',
        label: 'Co-applicant Required',
        type: 'text',
        calculated: true,
        helperText: 'Yes when the applicant is above 60.',
      },
      {
        key: 'coApplicantName',
        label: 'Co-applicant Name',
        type: 'text',
        visibleWhen: (values) => values.addCoApplicant,
      },
      {
        key: 'coApplicantRelation',
        label: 'Relation',
        type: 'dropdown',
        options: CO_APPLICANT_RELATIONS,
        visibleWhen: (values) => values.addCoApplicant,
      },
    ],
  },
  {
    id: 'sureties',
    title: 'Sureties',
    note: 'Two sureties are required.',
    fields: [
      { key: 'surety1Name', label: 'Surety 1 Name', type: 'text', required: true },
      {
        key: 'surety1Mobile',
        label: 'Surety 1 Mobile',
        type: 'phone',
        required: true,
        validate: (values) => validateMobile(values.surety1Mobile),
      },
      {
        key: 'surety1Pan',
        label: 'Surety 1 PAN',
        type: 'text',
        required: true,
        uppercase: true,
        validate: (values) => validatePan(values.surety1Pan),
      },
      { key: 'surety2Name', label: 'Surety 2 Name', type: 'text', required: true },
      {
        key: 'surety2Mobile',
        label: 'Surety 2 Mobile',
        type: 'phone',
        required: true,
        validate: (values) => validateMobile(values.surety2Mobile),
      },
      {
        key: 'surety2Pan',
        label: 'Surety 2 PAN',
        type: 'text',
        required: true,
        uppercase: true,
        validate: (values) => validatePan(values.surety2Pan),
      },
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    note: 'PDF, JPG or PNG, up to 5 MB each.',
    fields: documentFields,
  },
  {
    id: 'consent',
    title: 'Consent',
    fields: [
      {
        key: 'consentGiven',
        label: CONSENT_TEXT,
        summaryLabel: 'Consent',
        type: 'checkbox',
        width: 'full',
        required: true,
        requiredMessage: 'Tick the consent to continue',
        // Consent Time is set by the store when the box is ticked and cleared when it is unticked
        helperText: (values) =>
          values.consentGiven && values.consentTime
            ? `Consent Time: ${formatDateTime(values.consentTime)}`
            : undefined,
      },
    ],
  },
];
