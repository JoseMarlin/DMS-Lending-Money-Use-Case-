import { createBlankApplication } from '@/data/application';
import { OCCUPATIONS } from '@/data/options';
import { SCENARIOS, SCENARIO_KEYS, SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import type { HomeLoanApplication, ScenarioKey } from '@/data/types';
import { STEP1_SECTIONS } from '../form/step1Schema';
import { MESSAGES } from './rules';
import { validateField, validateStep1 } from './validate';

const allFields = STEP1_SECTIONS.flatMap((s) => s.fields);
const field = (key: string, docType?: string) =>
  allFields.find((f) => f.key === key && (!docType || f.docType === docType))!;

const blank = () =>
  createBlankApplication({ applicationId: 'HL-2026-0008', branch: 'b', createdBy: 'u' });

/** A scenario as the store fills it, with consent ticked, as it is when the user presses Next */
function filled(key: ScenarioKey, patch: Partial<HomeLoanApplication> = {}): HomeLoanApplication {
  const store = useAppStore.getState();
  store.resetDemo();
  store.fillScenario(key);
  store.updateDraft({ consentGiven: true, ...patch });
  return useAppStore.getState().draft;
}

describe('validateField: required', () => {
  it('asks for an empty required field, with a message that names it', () => {
    expect(validateField(field('fullNameAsPerPan'), blank())).toBe('Enter Full Name (as per PAN)');
    expect(validateField(field('loanAmountRequested'), blank())).toBe(
      'Enter Loan Amount Requested',
    );
    expect(validateField(field('dateOfBirth'), blank())).toBe('Enter Date of Birth');
    expect(validateField(field('surety2Mobile'), blank())).toBe('Enter Surety 2 Mobile');
  });

  it('says Select for a dropdown and Upload for a document', () => {
    expect(validateField(field('occupation'), blank())).toBe('Select Occupation');
    expect(validateField(field('loanPurpose'), blank())).toBe('Select Loan Purpose');
    expect(validateField(field('documents', 'PAN Card'), blank())).toBe('Upload PAN Card');
  });

  it('asks for the consent in its own words', () => {
    expect(validateField(field('consentGiven'), blank())).toBe('Tick the consent to continue');
    expect(validateField(field('consentGiven'), { ...blank(), consentGiven: true })).toBeNull();
  });

  it('treats blank spaces and a zero amount as empty', () => {
    expect(validateField(field('fullNameAsPerPan'), { ...blank(), fullNameAsPerPan: '   ' })).toBe(
      'Enter Full Name (as per PAN)',
    );
    expect(validateField(field('tenureMonths'), { ...blank(), tenureMonths: 0 })).toBe(
      'Enter Tenure (months)',
    );
  });

  it('does not ask for fields that are not required', () => {
    ['monthlyIncome', 'address', 'pinCode', 'branch'].forEach((key) => {
      expect(validateField(field(key), blank())).toBeNull();
    });
  });

  it('asks for the Loan Purpose, which the Eligible Amount and the list of documents depend on', () => {
    expect(validateField(field('loanPurpose'), blank())).toBe('Select Loan Purpose');
    expect(
      validateField(field('loanPurpose'), { ...blank(), loanPurpose: 'Construction of house' }),
    ).toBeNull();
  });

  it('asks for the GSTIN once it shows: for Business and Professional, not for the others', () => {
    OCCUPATIONS.forEach((occupation) => {
      const values = { ...blank(), occupation };
      const shown = occupation === 'Business' || occupation === 'Professional';
      expect(validateField(field('gstin'), values)).toBe(shown ? 'Enter GSTIN' : null);
    });
    // nothing chosen yet: the field is not showing, so it is not asked for
    expect(validateField(field('gstin'), blank())).toBeNull();
    expect(validateField(field('gstin'), { ...blank(), occupation: 'Business', gstin: '  ' })).toBe(
      'Enter GSTIN',
    );
  });

  it('does not ask for a hidden field: GSTIN and the GST certificate for a salaried applicant', () => {
    const salaried = { ...blank(), occupation: 'Salaried' as const };
    expect(validateField(field('gstin'), salaried)).toBeNull();
    expect(
      validateField(field('documents', 'GST Certificate or Business Licence'), salaried),
    ).toBeNull();
    const business = { ...blank(), occupation: 'Business' as const };
    expect(validateField(field('documents', 'GST Certificate or Business Licence'), business)).toBe(
      'Upload GST Certificate or Business Licence',
    );
  });

  it('does not ask for the co-applicant details unless the toggle is on', () => {
    expect(validateField(field('coApplicantName'), blank())).toBeNull();
  });
});

describe('validateField: rules', () => {
  it('runs the rule of a filled-in field', () => {
    expect(validateField(field('pan'), { ...blank(), pan: 'ABCDE1234F' })).toBe(MESSAGES.pan);
    expect(validateField(field('mobile'), { ...blank(), mobile: '12345' })).toBe(MESSAGES.mobile);
    expect(validateField(field('tenureMonths'), { ...blank(), tenureMonths: 241 })).toBe(
      MESSAGES.tenure,
    );
    expect(validateField(field('pinCode'), { ...blank(), pinCode: '12' })).toBe(MESSAGES.pinCode);
  });

  it('checks the Aadhaar through its masked value', () => {
    expect(validateField(field('aadhaar'), { ...blank(), aadhaar: 'XXXX XXXX 4821' })).toBeNull();
    expect(validateField(field('aadhaar'), { ...blank(), aadhaar: 'XXXX XXXX XXXX' })).toBe(
      MESSAGES.aadhaar,
    );
    expect(validateField(field('aadhaar'), blank())).toBe('Enter Aadhaar');
  });

  it('checks the GSTIN against the PAN entered', () => {
    const values = { ...blank(), occupation: 'Business' as const, pan: 'ABCPD5678K' };
    expect(validateField(field('gstin'), { ...values, gstin: '29ABCPP1234F1Z5' })).toBe(
      MESSAGES.gstin,
    );
    expect(validateField(field('gstin'), { ...values, gstin: '29ABCPD5678K1Z5' })).toBeNull();
  });

  it('checks the owner against the applicant name, and the age against the application date', () => {
    expect(
      validateField(field('propertyOwnerName'), {
        ...blank(),
        fullNameAsPerPan: 'Ramesh Patil',
        propertyOwnerName: 'Suresh Patil',
      }),
    ).toBe(MESSAGES.ownerName);
    expect(
      validateField(field('dateOfBirth'), {
        ...blank(),
        applicationDate: '2026-10-08',
        dateOfBirth: '1960-01-01',
      }),
    ).toBe(MESSAGES.age);
  });

  it('checks the loan amount against the Eligible Amount that the store works out', () => {
    const values = {
      ...blank(),
      loanPurpose: 'Construction of house' as const,
      estimatedCost: 2_600_000,
      eligibleAmount: 1_950_000,
      loanAmountRequested: 2_200_000,
    };
    expect(validateField(field('loanAmountRequested'), values)).toBe(
      'Amount exceeds 75% of the estimate. Maximum 19,50,000',
    );
  });
});

describe('validateStep1', () => {
  it('lists every required field of a blank form, in the order of the form', () => {
    const issues = validateStep1(STEP1_SECTIONS, blank());
    expect(issues.map((i) => i.label)).toEqual([
      'Loan Purpose',
      'Loan Amount Requested',
      'Tenure (months)',
      'Full Name (as per PAN)',
      'Date of Birth',
      'Mobile',
      'Email',
      'Occupation',
      'PAN',
      'Aadhaar',
      'Property Address',
      'Property Owner Name',
      'Estimated Cost',
      'Surety 1 Name',
      'Surety 1 Mobile',
      'Surety 1 PAN',
      'Surety 2 Name',
      'Surety 2 Mobile',
      'Surety 2 PAN',
      'PAN Card',
      'Aadhaar (Masked Copy)',
      'Photograph',
      'Address Proof',
      'Income Proof',
      'Surety Documents',
      'Sale or Gift Deed',
      'Records of Rights',
      'Encumbrance Certificate',
      'Building Permission',
      'Valuation Certificate',
      'Tax Paid Receipt',
      'Consent',
    ]);
  });

  it('gives each issue the field, its id and its message', () => {
    const issues = validateStep1(STEP1_SECTIONS, blank());
    expect(issues[0]).toMatchObject({
      fieldId: 'loanPurpose',
      label: 'Loan Purpose',
      message: 'Select Loan Purpose',
    });
    expect(issues[1]).toMatchObject({
      fieldId: 'loanAmountRequested',
      label: 'Loan Amount Requested',
      message: 'Enter Loan Amount Requested',
    });
    const docIssue = validateStep1(STEP1_SECTIONS, blank()).find((i) => i.label === 'PAN Card');
    expect(docIssue?.fieldId).toBe('documents.PAN Card');
  });

  it('asks for the GSTIN and the GST certificate of a business applicant: 32 problems on a blank form, 33 once Business is chosen', () => {
    expect(validateStep1(STEP1_SECTIONS, blank())).toHaveLength(32);
    const business = { ...blank(), occupation: 'Business' as const };
    const labels = validateStep1(STEP1_SECTIONS, business).map((i) => i.label);
    // Occupation is answered, GSTIN and the GST certificate now show and are asked for
    expect(labels).toHaveLength(33);
    expect(labels).toContain('GSTIN');
    expect(labels).toContain('GST Certificate or Business Licence');
    expect(labels).not.toContain('Occupation');
    // GSTIN is in the Identity section, after the Aadhaar
    expect(labels.indexOf('GSTIN')).toBe(labels.indexOf('Aadhaar') + 1);
  });

  it('asks for the GSTIN of a professional applicant too, and not of a salaried one', () => {
    const labelsOf = (occupation: 'Professional' | 'Salaried') =>
      validateStep1(STEP1_SECTIONS, { ...blank(), occupation }).map((i) => i.label);
    expect(labelsOf('Professional')).toContain('GSTIN');
    expect(labelsOf('Professional')).toContain('GST Certificate or Business Licence');
    expect(labelsOf('Salaried')).not.toContain('GSTIN');
    expect(labelsOf('Salaried')).toHaveLength(31);
  });

  it.each(SCENARIO_KEYS)('scenario %s is valid once the consent is ticked', (key) => {
    expect(validateStep1(STEP1_SECTIONS, filled(key))).toEqual([]);
  });

  it.each(SCENARIO_KEYS)('scenario %s only misses the consent until it is ticked', (key) => {
    const store = useAppStore.getState();
    store.resetDemo();
    store.fillScenario(key);
    const issues = validateStep1(STEP1_SECTIONS, useAppStore.getState().draft);
    expect(issues.map((i) => i.message)).toEqual(['Tick the consent to continue']);
  });

  it('scenario A with 22,00,000 requested: only the loan amount is wrong, with the 75% message', () => {
    const issues = validateStep1(STEP1_SECTIONS, filled('A', { loanAmountRequested: 2_200_000 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      fieldId: 'loanAmountRequested',
      message: 'Amount exceeds 75% of the estimate. Maximum 19,50,000',
    });
  });

  it('follows the estimate: raising it makes 22,00,000 acceptable', () => {
    const draft = filled('A', { loanAmountRequested: 2_200_000, estimatedCost: 3_000_000 });
    expect(draft.eligibleAmount).toBe(2_250_000);
    expect(validateStep1(STEP1_SECTIONS, draft)).toEqual([]);
  });

  it('finds several problems at once, each on its own field', () => {
    const issues = validateStep1(
      STEP1_SECTIONS,
      filled('A', {
        pan: 'ABCDE1234F',
        mobile: '123',
        tenureMonths: 300,
        propertyOwnerName: 'Suresh Patil',
        dateOfBirth: '1960-01-01',
      }),
    );
    expect(Object.fromEntries(issues.map((i) => [i.fieldId, i.message]))).toEqual({
      tenureMonths: MESSAGES.tenure,
      dateOfBirth: MESSAGES.age,
      mobile: MESSAGES.mobile,
      pan: MESSAGES.pan,
      // GSTIN no longer matches the PAN that was typed
      gstin: MESSAGES.gstin,
      propertyOwnerName: MESSAGES.ownerName,
    });
  });

  it('asks for both sureties', () => {
    const issues = validateStep1(
      STEP1_SECTIONS,
      filled('A', { surety2Name: '', surety2Mobile: '', surety2Pan: '' }),
    );
    expect(issues.map((i) => i.label)).toEqual([
      'Surety 2 Name',
      'Surety 2 Mobile',
      'Surety 2 PAN',
    ]);
  });

  it('asks for a document that was removed', () => {
    const draft = filled('A');
    const without = {
      ...draft,
      documents: draft.documents.filter((d) => d.docType !== 'Photograph'),
    };
    expect(validateStep1(STEP1_SECTIONS, without).map((i) => i.message)).toEqual([
      'Upload Photograph',
    ]);
  });

  it('flags an Aadhaar that failed the checksum', () => {
    const issues = validateStep1(STEP1_SECTIONS, filled('A', { aadhaar: 'XXXX XXXX XXXX' }));
    expect(issues.map((i) => i.message)).toEqual([MESSAGES.aadhaar]);
  });
});

describe('validateStep1: duplicate PAN', () => {
  const saved = [{ applicationId: 'HL-2026-0003', pan: SCENARIOS.A.application.pan! }];

  it('is not checked unless asked', () => {
    expect(validateStep1(STEP1_SECTIONS, filled('A'), { applications: saved })).toEqual([]);
  });

  it('puts the duplicate on the PAN field with the existing Application ID', () => {
    const issues = validateStep1(STEP1_SECTIONS, filled('A'), {
      applications: saved,
      checkDuplicatePan: true,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      fieldId: 'pan',
      message: 'An application for this PAN already exists: HL-2026-0003',
    });
  });

  it('keeps the PAN format error instead of the duplicate message', () => {
    const issues = validateStep1(STEP1_SECTIONS, filled('A', { pan: 'BAD' }), {
      applications: saved,
      checkDuplicatePan: true,
    });
    expect(issues.find((i) => i.fieldId === 'pan')?.message).toBe(MESSAGES.pan);
  });

  it('does not count the draft itself, and passes on the seeded data for every scenario', () => {
    const draft = filled('A');
    expect(
      validateStep1(STEP1_SECTIONS, draft, {
        applications: [{ applicationId: draft.applicationId, pan: draft.pan }],
        checkDuplicatePan: true,
      }),
    ).toEqual([]);
    SCENARIO_KEYS.forEach((key) => {
      expect(
        validateStep1(STEP1_SECTIONS, filled(key), {
          applications: SEED_APPLICATIONS,
          checkDuplicatePan: true,
        }),
      ).toEqual([]);
    });
  });
});
