import { SEED_APPLICATIONS } from '@/data/seed';
import type { HomeLoanApplication } from '@/data/types';
import { SCHEMA_FIELDS, SHEET_TABS, type SheetTabId } from './recordSheetModel';
import {
  EDIT_SECTIONS,
  HINT_APPROVAL,
  HINT_CALCULATED,
  HINT_KYC,
  HINT_SYSTEM,
  applyFieldChange,
  changedFields,
  correctedSinceReturn,
  editItems,
  filesInError,
  identityTouched,
  issueSummary,
  tabOfField,
  tabsWithIssues,
  validateEdit,
} from './editModel';

const [VIJAY, SHOBHA, , SAVITA, BASAVARAJ, , PRAKASH] = SEED_APPLICATIONS;
const field = (key: string) => SCHEMA_FIELDS.get(key as never)!;
const kinds = (app: HomeLoanApplication, tab: SheetTabId) =>
  editItems(app, tab).map((i) => `${i.id}:${i.kind}`);
const change = (app: HomeLoanApplication, key: string, raw: string) =>
  applyFieldChange(app, field(key), raw);

describe('the sections the tabs edit', () => {
  it("are the form's, without the documents", () => {
    expect(EDIT_SECTIONS.map((s) => s.id)).toEqual([
      'application',
      'applicant',
      'identity',
      'property',
      'co-applicant',
      'sureties',
      'consent',
    ]);
  });
});

describe('editItems', () => {
  it('Application: the ID, the product and the date are locked, the rest are inputs', () => {
    expect(kinds(VIJAY, 'application')).toEqual([
      'applicationId:locked',
      'branch:field',
      'loanProduct:locked',
      'loanPurpose:field',
      'loanAmountRequested:field',
      'tenureMonths:field',
      'applicationDate:locked',
    ]);
  });

  it('says why a field is locked: set by the system, or worked out from the others', () => {
    const items = editItems(VIJAY, 'property');
    const eligible = items.find((i) => i.id === 'eligibleAmount')!;
    expect(eligible).toMatchObject({ kind: 'locked', hint: HINT_CALCULATED });
    const id = editItems(VIJAY, 'application').find((i) => i.id === 'applicationId')!;
    expect(id).toMatchObject({ kind: 'locked', hint: HINT_SYSTEM, value: VIJAY.applicationId });
  });

  it('Applicant: every field is an input, and the address takes two columns', () => {
    const items = editItems(VIJAY, 'applicant');
    expect(items.every((i) => i.kind === 'field')).toBe(true);
    expect(items.find((i) => i.id === 'address')?.wide).toBe('two');
    expect(items.find((i) => i.id === 'mobile')?.wide).toBe('one');
  });

  it('Identity: the GSTIN only for a Business or Professional applicant, then the consent and its time', () => {
    expect(kinds(VIJAY, 'identity')).toEqual([
      'pan:field',
      'aadhaar:field',
      'consentGiven:field',
      'consentTime:locked',
    ]);
    expect(kinds(SHOBHA, 'identity')).toContain('gstin:field');
    const consent = editItems(VIJAY, 'identity').find((i) => i.id === 'consentGiven')!;
    expect(consent.wide).toBe('row');
  });

  it('Identity: the Aadhaar item is the masked field of the schema, never a number', () => {
    const aadhaar = editItems(VIJAY, 'identity').find((i) => i.id === 'aadhaar')!;
    expect(aadhaar.kind === 'field' && aadhaar.field.mask).toBe('aadhaar');
    expect(JSON.stringify(editItems(VIJAY, 'identity'))).not.toMatch(/\d{12}/);
  });

  it('Sureties: the toggle first, the name and relation of the co-applicant only when one is added', () => {
    const without = kinds(
      { ...VIJAY, addCoApplicant: false, dateOfBirth: '1990-01-01' },
      'sureties',
    );
    expect(without.slice(0, 2)).toEqual(['addCoApplicant:field', 'coApplicantRequired:locked']);
    expect(without).not.toContain('coApplicantName:field');
    const withOne = kinds({ ...VIJAY, addCoApplicant: true }, 'sureties');
    expect(withOne).toContain('coApplicantName:field');
    expect(withOne).toContain('coApplicantRelation:field');
    expect(withOne.filter((k) => k.startsWith('surety'))).toHaveLength(6);
  });

  it('KYC and Approval: every field is locked, with its hint', () => {
    for (const [tab, hint] of [
      ['kyc', HINT_KYC],
      ['approval', HINT_APPROVAL],
    ] as const) {
      const items = editItems(VIJAY, tab);
      expect(items.length).toBeGreaterThan(5);
      expect(items.every((i) => i.kind === 'locked')).toBe(true);
      expect(items.every((i) => i.kind === 'locked' && i.hint === hint)).toBe(true);
    }
  });

  it('keeps the badge of the KYC result and the full rows of the approval remarks', () => {
    const kyc = editItems({ ...VIJAY, kycOverallResult: 'Pass' }, 'kyc')[0];
    expect(kyc).toMatchObject({ kind: 'locked', label: 'KYC Overall Result', badge: 'success' });
    const remarks = editItems(VIJAY, 'approval').find((i) => i.id === 'level1Remarks');
    expect(remarks?.wide).toBe('row');
  });

  it('shows no field that is not on a tab: all fields of the form are on one', () => {
    const shown = new Set(
      SHEET_TABS.flatMap((tab) =>
        editItems({ ...VIJAY, addCoApplicant: true, occupation: 'Business' }, tab.id),
      ).map((i) => i.id),
    );
    for (const section of EDIT_SECTIONS) {
      for (const f of section.fields) expect(shown.has(f.key)).toBe(true);
    }
  });
});

describe("applyFieldChange: the form's own rules", () => {
  it('works out the Eligible Amount as the cost is changed', () => {
    const next = change(
      { ...VIJAY, loanPurpose: 'Construction of house' },
      'estimatedCost',
      '4000000',
    );
    expect(next.estimatedCost).toBe(4_000_000);
    expect(next.eligibleAmount).toBe(3_000_000); // 75% is 30,00,000, the limit
    expect(change(next, 'estimatedCost', '1000000').eligibleAmount).toBe(750_000);
  });

  it('follows the Loan Purpose too', () => {
    expect(change(VIJAY, 'loanPurpose', 'Purchase of flat').eligibleAmount).toBe(3_000_000);
  });

  it('clears the GSTIN when the applicant is no longer Business or Professional', () => {
    expect(SHOBHA.gstin).not.toBe('');
    const next = change(SHOBHA, 'occupation', 'Salaried');
    expect(next.occupation).toBe('Salaried');
    expect(next.gstin).toBe('');
    expect(change(next, 'occupation', 'Business').gstin).toBe('');
  });

  it('turns the co-applicant on and locks it for an applicant above 60', () => {
    const next = change({ ...VIJAY, addCoApplicant: false }, 'dateOfBirth', '1950-01-01');
    expect(next.coApplicantRequired).toBe('Yes');
    expect(next.addCoApplicant).toBe(true);
  });

  it("clears the co-applicant's name and relation when the toggle is turned off", () => {
    const on = {
      ...VIJAY,
      dateOfBirth: '1990-01-01',
      addCoApplicant: true,
      coApplicantName: 'A',
      coApplicantRelation: 'Spouse' as const,
    };
    const off = change(on, 'addCoApplicant', 'false');
    expect(off).toMatchObject({
      addCoApplicant: false,
      coApplicantName: '',
      coApplicantRelation: '',
    });
  });

  it('sets the consent time when the consent is given and clears it when it is taken back', () => {
    const none = { ...VIJAY, consentGiven: false, consentTime: '' };
    const given = change(none, 'consentGiven', 'true');
    expect(given.consentGiven).toBe(true);
    expect(given.consentTime).not.toBe('');
    expect(change(given, 'consentGiven', 'false').consentTime).toBe('');
  });

  it('keeps an Aadhaar masked, and a number that is typed into a text field masked', () => {
    expect(change(VIJAY, 'aadhaar', 'XXXX XXXX 1234').aadhaar).toBe('XXXX XXXX 1234');
    expect(change(VIJAY, 'address', 'Plot 12, 2345 6789 0123').address).toBe(
      'Plot 12, XXXX XXXX 0123',
    );
  });

  it('keeps only the digits of a number and an empty box as nothing', () => {
    expect(change(VIJAY, 'monthlyIncome', '1,20,000').monthlyIncome).toBe(120000);
    expect(change(VIJAY, 'monthlyIncome', '').monthlyIncome).toBeNull();
  });

  it('does not change the record it was given', () => {
    const snapshot = JSON.stringify(VIJAY);
    change(VIJAY, 'mobile', '9000000001');
    expect(JSON.stringify(VIJAY)).toBe(snapshot);
  });
});

describe("validateEdit: the form's rules", () => {
  const others = SEED_APPLICATIONS;

  it('finds nothing wrong with any of the submitted seed records, so each of them can be edited and saved', () => {
    const submitted = SEED_APPLICATIONS.filter((a) => a.status !== 'Draft');
    expect(submitted).toHaveLength(6);
    for (const app of submitted) {
      expect(validateEdit(app, others).map((i) => `${app.applicationId} ${i.message}`)).toEqual([]);
    }
  });

  it('finds in the seed draft (Prakash Naik) only what it still lacks: the consent and the 9 documents not uploaded yet', () => {
    const issues = validateEdit(PRAKASH, others);
    expect(issues.map((i) => [i.tab, i.message])).toEqual([
      ['identity', 'Tick the consent to continue'],
      ['files', 'Upload Address Proof'],
      ['files', 'Upload Income Proof'],
      ['files', 'Upload Surety Documents'],
      ['files', 'Upload Sale or Gift Deed'],
      ['files', 'Upload Records of Rights'],
      ['files', 'Upload Encumbrance Certificate'],
      ['files', 'Upload Building Permission'],
      ['files', 'Upload Valuation Certificate'],
      ['files', 'Upload Tax Paid Receipt'],
    ]);
  });

  it('gives the messages of the form for an empty or wrong field, with the tab they are on', () => {
    const issues = validateEdit(
      { ...VIJAY, email: '', mobile: '123', consentGiven: false },
      others,
    );
    const byField = Object.fromEntries(issues.map((i) => [i.fieldId, i]));
    expect(byField.email).toMatchObject({ message: 'Enter Email', tab: 'applicant' });
    expect(byField.mobile).toMatchObject({
      message: 'Enter a valid mobile number',
      tab: 'applicant',
    });
    expect(byField.consentGiven).toMatchObject({
      message: 'Tick the consent to continue',
      tab: 'identity',
    });
  });

  it('asks for each required document that is missing, in the Files and Attachments panel and not on a tab', () => {
    const issues = validateEdit({ ...VIJAY, documents: [] }, others);
    // Vijay is Salaried: 12 documents are required (the GST Certificate is not)
    expect(issues).toHaveLength(12);
    expect(issues.every((i) => i.tab === 'files' && i.message.startsWith('Upload '))).toBe(true);
    expect(issues.map((i) => i.message)).not.toContain(
      'Upload GST Certificate or Business Licence',
    );
    expect(issues[0]).toMatchObject({ fieldId: 'documents.PAN Card', message: 'Upload PAN Card' });
    expect(filesInError(issues)).toBe(true);
    expect(tabsWithIssues(issues)).toEqual([]);
    expect(issueSummary(issues)).toBe('12 fields need attention: Files and Attachments (12)');
    // a Business applicant needs the GST Certificate or Business Licence too
    expect(validateEdit({ ...SHOBHA, documents: [] }, others)).toHaveLength(13);
  });

  it('does not take an attachment for a required document, and does not ask for one', () => {
    const attachmentsOnly = VIJAY.documents.filter((d) => d.docType === 'Supporting Document');
    expect(attachmentsOnly).toHaveLength(2);
    expect(validateEdit({ ...VIJAY, documents: attachmentsOnly }, others)).toHaveLength(12);
    const noAttachments = VIJAY.documents.filter((d) => d.docType !== 'Supporting Document');
    expect(validateEdit({ ...VIJAY, documents: noAttachments }, others)).toEqual([]);
    expect(filesInError([])).toBe(false);
  });

  it('flags a PAN that another application has, and leaves the record itself out', () => {
    const duplicate = { ...VIJAY, pan: SHOBHA.pan };
    const found = validateEdit(duplicate, others);
    expect(found.map((i) => i.fieldId)).toEqual(['pan']);
    expect(found[0].tab).toBe('identity');
    // the record's own PAN, which is in the list with its own ID, is not a duplicate
    expect(validateEdit(VIJAY, others).filter((i) => i.fieldId === 'pan')).toEqual([]);
  });

  it('does not check duplicates before Save', () => {
    expect(validateEdit({ ...VIJAY, pan: SHOBHA.pan }, others, false)).toEqual([]);
  });

  it('asks for a GSTIN rule only when the field is there', () => {
    const issues = validateEdit({ ...SHOBHA, gstin: 'NOT-A-GSTIN' }, others);
    expect(issues.map((i) => i.fieldId)).toEqual(['gstin']);
    expect(issues[0].tab).toBe('identity');
    expect(validateEdit({ ...VIJAY, gstin: 'NOT-A-GSTIN' }, others)).toEqual([]); // hidden: never wrong
  });

  it('requires the Loan Purpose, and the GSTIN of a Business or Professional applicant', () => {
    const noPurpose = validateEdit({ ...VIJAY, loanPurpose: '' }, others);
    expect(noPurpose.map((i) => [i.fieldId, i.message, i.tab])).toEqual([
      ['loanPurpose', 'Select Loan Purpose', 'application'],
    ]);
    const noGstin = validateEdit({ ...SHOBHA, gstin: '' }, others);
    expect(noGstin.map((i) => [i.fieldId, i.message, i.tab])).toEqual([
      ['gstin', 'Enter GSTIN', 'identity'],
    ]);
    // a Salaried applicant has no GSTIN field, so none is asked for
    expect(validateEdit({ ...VIJAY, gstin: '' }, others)).toEqual([]);
  });

  it('puts every field of the form on a tab', () => {
    for (const section of EDIT_SECTIONS) {
      for (const f of section.fields) {
        expect(SHEET_TABS.map((t) => t.id)).toContain(tabOfField(f.key));
      }
    }
    expect(tabOfField('addCoApplicant')).toBe('sureties');
    expect(tabOfField('consentGiven')).toBe('identity');
    expect(tabOfField('surety2Pan')).toBe('sureties');
    expect(tabOfField('nothing')).toBe('application');
  });
});

describe('tabsWithIssues and issueSummary', () => {
  const issues = validateEdit(
    { ...VIJAY, email: '', mobile: '123', consentGiven: false, surety1Name: '' },
    SEED_APPLICATIONS,
  );

  it('lists the tabs that have an error, in the order of the tabs', () => {
    expect(tabsWithIssues(issues)).toEqual(['applicant', 'identity', 'sureties']);
    expect(tabsWithIssues([])).toEqual([]);
  });

  it('says how many fields need attention and where', () => {
    expect(issueSummary(issues)).toBe(
      '4 fields need attention: Applicant (2), Identity (1), Sureties (1)',
    );
    expect(issueSummary(issues.slice(0, 1))).toBe('1 field needs attention: Applicant (1)');
    expect(issueSummary([])).toBe('');
  });
});

describe('changedFields', () => {
  it('is empty when nothing changed', () => {
    expect(changedFields(VIJAY, { ...VIJAY })).toEqual([]);
  });

  it('gives the label and the old and new value as text, in the style of the sheet', () => {
    const next = change(change(VIJAY, 'mobile', '9000000001'), 'monthlyIncome', '120000');
    expect(changedFields(VIJAY, next)).toEqual([
      { label: 'Mobile', oldValue: VIJAY.mobile, newValue: '9000000001' },
      { label: 'Monthly Income', oldValue: '₹ 75,000', newValue: '₹ 1,20,000' },
    ]);
  });

  it('writes an empty value as nothing', () => {
    const next = change(VIJAY, 'monthlyIncome', '');
    expect(changedFields(VIJAY, next)).toEqual([
      { label: 'Monthly Income', oldValue: '₹ 75,000', newValue: '' },
    ]);
  });

  it('writes the date as the sheet does', () => {
    const next = change(VIJAY, 'dateOfBirth', '1980-08-09');
    expect(changedFields(VIJAY, next)).toEqual([
      { label: 'Date of Birth', oldValue: '22 Jul 1979', newValue: '9 Aug 1980' },
    ]);
  });

  it('includes what a change calculated: the Eligible Amount that followed the cost', () => {
    const next = change(VIJAY, 'estimatedCost', '2000000');
    expect(changedFields(VIJAY, next).map((c) => c.label)).toEqual([
      'Estimated Cost',
      'Eligible Amount',
    ]);
  });

  it('includes what a change cleared: the GSTIN', () => {
    const next = change(SHOBHA, 'occupation', 'Salaried');
    const labels = changedFields(SHOBHA, next).map((c) => c.label);
    expect(labels).toEqual(['Occupation', 'GSTIN']);
  });

  it('says an Aadhaar "changed" and never writes a number, not even the last four digits', () => {
    const next = { ...VIJAY, aadhaar: 'XXXX XXXX 9999' };
    const found = changedFields(VIJAY, next);
    expect(found).toEqual([{ label: 'Aadhaar', oldValue: '', newValue: 'changed' }]);
    expect(JSON.stringify(found)).not.toMatch(/\d{4}/);
  });

  it('counts a re-entered Aadhaar even when it ends in the same four digits', () => {
    expect(changedFields(VIJAY, { ...VIJAY }, true)).toEqual([
      { label: 'Aadhaar', oldValue: '', newValue: 'changed' },
    ]);
  });

  it('includes the consent time with the consent', () => {
    const none = { ...VIJAY, consentGiven: false, consentTime: '' };
    const next = change(none, 'consentGiven', 'true');
    expect(changedFields(VIJAY, none).map((c) => c.label)).toEqual(['Consent', 'Consent Time']);
    expect(changedFields(none, next).map((c) => c.label)).toEqual(['Consent', 'Consent Time']);
  });

  it("does not look at the KYC and approval fields: only the sheet's own fields", () => {
    const next = {
      ...VIJAY,
      kycOverallResult: 'Fail' as const,
      level1Remarks: 'x',
      sanctionedAmount: 1,
    };
    expect(changedFields(VIJAY, next)).toEqual([]);
  });
});

describe('identityTouched', () => {
  it('is true for a changed PAN, GSTIN, name or date of birth', () => {
    expect(identityTouched(VIJAY, { ...VIJAY, pan: 'ZZZZZ9999Z' }, false)).toBe(true);
    expect(identityTouched(SHOBHA, { ...SHOBHA, gstin: '' }, false)).toBe(true);
    expect(identityTouched(VIJAY, { ...VIJAY, fullNameAsPerPan: 'Vijay K' }, false)).toBe(true);
    expect(identityTouched(VIJAY, { ...VIJAY, dateOfBirth: '1980-01-01' }, false)).toBe(true);
  });

  it('is true for an Aadhaar that was typed, and false for what is not checked', () => {
    expect(identityTouched(VIJAY, { ...VIJAY }, true)).toBe(true);
    expect(
      identityTouched(
        VIJAY,
        { ...VIJAY, mobile: '9000000001', address: 'Elsewhere', monthlyIncome: 1 },
        false,
      ),
    ).toBe(false);
  });
});

describe('correctedSinceReturn', () => {
  const ev = (event: string, at: string, applicationId = SAVITA.applicationId) => ({
    applicationId,
    event,
    at,
  });

  it('is false until a field is saved after the return', () => {
    const events = [
      ev('Submitted', '2026-09-22T10:00:00Z'),
      ev('Returned', '2026-09-25T11:00:00Z'),
    ];
    expect(correctedSinceReturn(events, SAVITA.applicationId)).toBe(false);
  });

  it('is true once a field was changed after the return', () => {
    const events = [
      ev('Returned', '2026-09-25T11:00:00Z'),
      ev('Field changed', '2026-09-26T09:00:00Z'),
    ];
    expect(correctedSinceReturn(events, SAVITA.applicationId)).toBe(true);
  });

  it.each(['Document uploaded', 'Document replaced', 'Document removed'])(
    'is true once a document was corrected after the return (%s), with no field changed',
    (event) => {
      const events = [ev('Returned', '2026-09-25T11:00:00Z'), ev(event, '2026-09-26T09:00:00Z')];
      expect(correctedSinceReturn(events, SAVITA.applicationId)).toBe(true);
    },
  );

  it('does not count an attachment: a file that is only attached is not a correction', () => {
    const events = [
      ev('Returned', '2026-09-25T11:00:00Z'),
      ev('Attachment added', '2026-09-26T09:00:00Z'),
      ev('Comment added', '2026-09-26T09:05:00Z'),
    ];
    expect(correctedSinceReturn(events, SAVITA.applicationId)).toBe(false);
  });

  it('does not count a change from before the return, nor one of another application', () => {
    const events = [
      ev('Field changed', '2026-09-24T09:00:00Z'),
      ev('Returned', '2026-09-25T11:00:00Z'),
      ev('Field changed', '2026-09-26T09:00:00Z', BASAVARAJ.applicationId),
    ];
    expect(correctedSinceReturn(events, SAVITA.applicationId)).toBe(false);
  });

  it('starts again after a second return', () => {
    const events = [
      ev('Returned', '2026-09-25T11:00:00Z'),
      ev('Field changed', '2026-09-26T09:00:00Z'),
      ev('Resubmitted', '2026-09-26T10:00:00Z'),
      ev('Returned', '2026-09-28T11:00:00Z'),
    ];
    expect(correctedSinceReturn(events, SAVITA.applicationId)).toBe(false);
  });
});
