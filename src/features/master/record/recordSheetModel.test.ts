import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import { ApplicationStatus, type HomeLoanApplication } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import { STEP1_SECTIONS } from '@/features/home-loan/form/step1Schema';
import {
  DEFAULT_SHEET_TAB,
  SHEET_TABS,
  filterFields,
  isSheetTab,
  sheetBanner,
  sheetFields,
  workflowAccess,
  type SheetTabId,
} from './recordSheetModel';

const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ] = SEED_APPLICATIONS;
const labels = (app: HomeLoanApplication, tab: SheetTabId) =>
  sheetFields(app, tab).map((f) => f.label);
const field = (app: HomeLoanApplication, tab: SheetTabId, label: string) =>
  sheetFields(app, tab).find((f) => f.label === label)!;

describe('the tabs', () => {
  it('are Application, Applicant, Identity, Property, Sureties, KYC and Approval, with their headings', () => {
    expect(SHEET_TABS.map((t) => t.label)).toEqual([
      'Application',
      'Applicant',
      'Identity',
      'Property',
      'Sureties',
      'KYC',
      'Approval',
    ]);
    expect(SHEET_TABS.map((t) => t.heading)).toEqual([
      'Application Details',
      'Applicant Details',
      'Identity and Consent',
      'Property and Security',
      'Co-applicant and Sureties',
      'KYC Validation',
      'Approval',
    ]);
  });

  it('start on Application', () => {
    expect(DEFAULT_SHEET_TAB).toBe('application');
  });

  it('know which values of the address are tabs', () => {
    expect(isSheetTab('kyc')).toBe(true);
    expect(isSheetTab('approval')).toBe(true);
    expect(isSheetTab('files')).toBe(false);
    expect(isSheetTab('')).toBe(false);
    expect(isSheetTab(null)).toBe(false);
  });
});

describe('the fields come from the form schema, with its labels', () => {
  const formLabels = new Set(
    STEP1_SECTIONS.flatMap((s) => s.fields)
      .filter((f) => f.type !== 'attachment')
      .map((f) => f.label),
  );

  it('Application: ID, Branch, Product, Purpose, Amount, Tenure, Date', () => {
    expect(labels(VIJAY, 'application')).toEqual([
      'Application ID',
      'Branch',
      'Loan Product',
      'Loan Purpose',
      'Loan Amount Requested',
      'Tenure (months)',
      'Application Date',
    ]);
  });

  it('Applicant: the eight fields of 6.2', () => {
    expect(labels(VIJAY, 'applicant')).toEqual([
      'Full Name (as per PAN)',
      'Date of Birth',
      'Mobile',
      'Email',
      'Occupation',
      'Monthly Income',
      'Address',
      'PIN Code',
    ]);
  });

  it('Property: the five fields of 6.4', () => {
    expect(labels(VIJAY, 'property')).toEqual([
      'Property Address',
      'Property Owner Name',
      'Estimated Cost',
      'Eligible Amount',
      'Security Type',
    ]);
  });

  it('Sureties: the co-applicant, then Surety 1 and Surety 2 with name, mobile and PAN', () => {
    expect(labels(VIJAY, 'sureties')).toEqual([
      'Co-applicant Required',
      'Co-applicant Name',
      'Relation',
      'Surety 1 Name',
      'Surety 1 Mobile',
      'Surety 1 PAN',
      'Surety 2 Name',
      'Surety 2 Mobile',
      'Surety 2 PAN',
    ]);
  });

  it('use only labels of the form, except the consent, the KYC and the approval fields', () => {
    for (const tab of ['application', 'applicant', 'property', 'sureties'] as const) {
      for (const label of labels(VIJAY, tab)) expect(formLabels.has(label)).toBe(true);
    }
    for (const label of labels(VIJAY, 'identity').slice(0, 2))
      expect(formLabels.has(label)).toBe(true);
  });

  it('Identity: PAN, Aadhaar, GSTIN only when it applies, then the consent', () => {
    expect(labels(VIJAY, 'identity')).toEqual(['PAN', 'Aadhaar', 'Consent Given', 'Consent Time']); // Salaried
    expect(labels(SHOBHA, 'identity')).toEqual([
      'PAN',
      'Aadhaar',
      'GSTIN',
      'Consent Given',
      'Consent Time',
    ]); // Business
  });

  it('KYC: the overall result first, then what 6.7 says about the three checks', () => {
    expect(labels(VIJAY, 'kyc')).toEqual([
      'KYC Overall Result',
      'Name Match Percent',
      'PAN Status',
      'PAN Name as per Source',
      'Aadhaar Status',
      'Aadhaar Reference',
      'GST Status',
      'GST Legal Name',
      'KYC Checked On',
      'KYC Exception Remark',
    ]);
  });

  it('Approval: both levels, then the sanction', () => {
    expect(labels(VIJAY, 'approval')).toEqual([
      'Level 1 Approver',
      'Level 1 Decision',
      'Level 1 Time',
      'Level 1 Remarks',
      'Level 2 Approver',
      'Level 2 Decision',
      'Level 2 Time',
      'Level 2 Remarks',
      'Sanctioned Amount',
      'Sanction Date',
    ]);
  });
});

describe('how a value is written', () => {
  it('amounts in the Indian way with a rupee sign, the tenure plain', () => {
    expect(field(VIJAY, 'application', 'Loan Amount Requested').value).toBe('₹ 20,00,000');
    expect(field(VIJAY, 'application', 'Tenure (months)').value).toBe('200');
    expect(field(VIJAY, 'property', 'Estimated Cost').value).toBe('₹ 28,00,000');
    expect(field(VIJAY, 'property', 'Eligible Amount').value).toMatch(/^₹ \d{1,2},\d{2},\d{3}$/);
    expect(field(VIJAY, 'approval', 'Sanctioned Amount').value).toBe('₹ 20,00,000');
  });

  it('dates as DD MMM YYYY, and moments with the time', () => {
    expect(field(VIJAY, 'application', 'Application Date').value).toBe('18 Aug 2026');
    expect(field(VIJAY, 'applicant', 'Date of Birth').value).toBe('22 Jul 1979');
    expect(field(VIJAY, 'approval', 'Sanction Date').value).toBe('26 Aug 2026');
    expect(field(VIJAY, 'approval', 'Level 1 Time').value).toBe('21 Aug 2026, 11:00 AM');
    expect(field(VIJAY, 'approval', 'Level 2 Time').value).toBe('26 Aug 2026, 3:00 PM');
  });

  it('the Aadhaar only masked, and never 12 digits anywhere in the sheet', () => {
    expect(field(VIJAY, 'identity', 'Aadhaar').value).toBe('XXXX XXXX 3345');
    for (const tab of SHEET_TABS) {
      for (const f of sheetFields(VIJAY, tab.id))
        expect(f.value).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
    }
  });

  it('an Aadhaar that was never entered is empty, not a mask', () => {
    expect(field({ ...VIJAY, aadhaar: '' }, 'identity', 'Aadhaar').value).toBe('');
  });

  it('nothing is an empty string, so the sheet can draw a dash', () => {
    expect(field({ ...VIJAY, monthlyIncome: null }, 'applicant', 'Monthly Income').value).toBe('');
    expect(field({ ...VIJAY, loanPurpose: '' }, 'application', 'Loan Purpose').value).toBe('');
    expect(field(MANJUNATH, 'approval', 'Level 2 Approver').value).toBe('');
    expect(field(MANJUNATH, 'approval', 'Sanctioned Amount').value).toBe('');
    expect(field(MANJUNATH, 'approval', 'Sanction Date').value).toBe('');
  });

  it('a value of only spaces is empty too, so that the sheet draws its dash', () => {
    expect(field({ ...VIJAY, address: '   ' }, 'applicant', 'Address').value).toBe('');
    expect(field({ ...VIJAY, pinCode: ' ' }, 'applicant', 'PIN Code').value).toBe('');
    expect(field({ ...VIJAY, level1Remarks: '  \n ' }, 'approval', 'Level 1 Remarks').value).toBe(
      '',
    );
    expect(field({ ...VIJAY, address: ' 12 Main Road ' }, 'applicant', 'Address').value).toBe(
      ' 12 Main Road ',
    );
  });

  it('the consent as Yes or No, with the time it was given', () => {
    const given = { ...VIJAY, consentGiven: true, consentTime: '2026-08-18T10:05:00+05:30' };
    expect(field(given, 'identity', 'Consent Given').value).toBe('Yes');
    expect(field(given, 'identity', 'Consent Time').value).toBe('18 Aug 2026, 10:05 AM');
    const none = { ...VIJAY, consentGiven: false, consentTime: '' };
    expect(field(none, 'identity', 'Consent Given').value).toBe('No');
    expect(field(none, 'identity', 'Consent Time').value).toBe('');
  });

  it('wide fields: the addresses and the security type, and the long remarks', () => {
    expect(field(VIJAY, 'applicant', 'Address').wide).toBe(true);
    expect(field(VIJAY, 'property', 'Property Address').wide).toBe(true);
    expect(field(VIJAY, 'property', 'Security Type').wide).toBe(true);
    expect(field(VIJAY, 'approval', 'Level 1 Remarks').wide).toBe(true);
    expect(field(VIJAY, 'approval', 'Level 1 Remarks').fullRow).toBe(true);
    expect(field(VIJAY, 'approval', 'Level 2 Remarks').fullRow).toBe(true);
    expect(field(VIJAY, 'kyc', 'KYC Exception Remark').fullRow).toBeUndefined();
    expect(field(VIJAY, 'kyc', 'KYC Exception Remark').wide).toBe(true);
    expect(field(VIJAY, 'applicant', 'Mobile').wide).toBe(false);
    expect(field(VIJAY, 'application', 'Application ID').wide).toBe(false);
  });
});

describe('the KYC tab', () => {
  it('draws the overall result as a badge: green for Pass, amber for Exception, red for Fail', () => {
    const tone = (result: HomeLoanApplication['kycOverallResult']) =>
      field({ ...VIJAY, kycOverallResult: result }, 'kyc', 'KYC Overall Result');
    expect(tone('Pass')).toMatchObject({ value: 'Pass', badge: 'success' });
    expect(tone('Exception')).toMatchObject({ value: 'Exception', badge: 'warning' });
    expect(tone('Fail')).toMatchObject({ value: 'Fail', badge: 'error' });
    expect(tone('')).toMatchObject({ value: 'Not checked', badge: 'neutral' });
  });

  it('writes the name match as a percentage and the check date as a date', () => {
    const app = { ...VIJAY, nameMatchPercent: 86, kycCheckedOn: '2026-10-09' };
    expect(field(app, 'kyc', 'Name Match Percent').value).toBe('86%');
    expect(field(app, 'kyc', 'KYC Checked On').value).toBe('9 Oct 2026');
    expect(field({ ...app, nameMatchPercent: null }, 'kyc', 'Name Match Percent').value).toBe('');
  });

  it('shows the exception remark, and a dash when there is none', () => {
    expect(field(BASAVARAJ, 'kyc', 'KYC Exception Remark').value).toContain('Middle initial');
    expect(field(VIJAY, 'kyc', 'KYC Exception Remark').value).toBe('');
  });
});

describe('the approval tab', () => {
  it('shows who decided, what, when and why', () => {
    expect(field(BASAVARAJ, 'approval', 'Level 1 Approver').value).toBe('Mahesh Joshi');
    expect(field(BASAVARAJ, 'approval', 'Level 1 Decision').value).toBe('Approved');
    expect(field(BASAVARAJ, 'approval', 'Level 2 Approver').value).toBe('Sunita Hegde');
    expect(field(BASAVARAJ, 'approval', 'Level 2 Decision').value).toBe('Rejected');
    expect(field(BASAVARAJ, 'approval', 'Level 2 Remarks').value).toContain('Repayment capacity');
  });
});

describe('filterFields', () => {
  const fields = sheetFields(VIJAY, 'applicant');

  it('keeps every field for no text or spaces', () => {
    expect(filterFields(fields, '')).toEqual(fields);
    expect(filterFields(fields, '   ')).toEqual(fields);
  });

  it('keeps the fields whose label has the text, in any case', () => {
    expect(filterFields(fields, 'MOBILE').map((f) => f.label)).toEqual(['Mobile']);
    expect(filterFields(fields, 'name').map((f) => f.label)).toEqual(['Full Name (as per PAN)']);
  });

  it('keeps the fields whose value has the text', () => {
    expect(filterFields(fields, 'salaried').map((f) => f.label)).toEqual(['Occupation']);
    expect(filterFields(fields, '22 jul').map((f) => f.label)).toEqual(['Date of Birth']);
  });

  it('keeps none when nothing has it', () => {
    expect(filterFields(fields, 'zzzz')).toEqual([]);
  });
});

describe('sheetBanner', () => {
  const as = (status: ApplicationStatus, over: Partial<HomeLoanApplication> = {}) =>
    sheetBanner({ ...VIJAY, status, ...over });

  it('has none for an approved application', () => {
    expect(as(ApplicationStatus.Approved)).toBeNull();
  });

  it('says a draft is not submitted yet', () => {
    expect(as(ApplicationStatus.Draft)).toMatchObject({
      variant: 'info',
      title: 'Not submitted yet',
    });
    expect(as(ApplicationStatus.KycDone)).toMatchObject({ title: 'Not submitted yet' });
  });

  it('says where an application in progress is waiting', () => {
    expect(sheetBanner(MANJUNATH)).toMatchObject({
      variant: 'info',
      title: 'Pending approval at Level 1',
    });
    expect(sheetBanner(SHOBHA)).toMatchObject({
      variant: 'info',
      title: 'Pending approval at Level 2',
    });
    expect(as(ApplicationStatus.Submitted)).toMatchObject({ title: 'Pending approval at Level 1' });
  });

  it("gives the reviewer's comment for a returned application, and who returned it", () => {
    expect(sheetBanner(SAVITA)).toEqual({
      variant: 'warning',
      title: 'Returned for correction by Mahesh Joshi (Level 1)',
      message: 'Income Proof is not readable. Upload a clear copy and resubmit.',
    });
  });

  it('gives the reason for a rejected application, from the level that rejected it', () => {
    expect(sheetBanner(BASAVARAJ)).toEqual({
      variant: 'error',
      title: 'Rejected by Sunita Hegde (Level 2)',
      message: 'Repayment capacity is not enough for the requested amount.',
    });
  });

  it('says so when a reviewer left no comment', () => {
    const banner = as(ApplicationStatus.Rejected, {
      level1Decision: '',
      level2Decision: 'Rejected',
      level2Remarks: '   ',
    });
    expect(banner?.message).toBe('No comment was given.');
  });

  it('does not make up a reviewer when no decision is recorded', () => {
    const banner = as(ApplicationStatus.Returned, {
      level1Decision: '',
      level2Decision: '',
      level1Approver: '',
      level2Approver: '',
    });
    expect(banner).toMatchObject({
      title: 'Returned for correction',
      message: 'No comment was given.',
    });
  });
});

describe('workflowAccess', () => {
  const state = () => ({ workflowInstances: useAppStore.getState().workflowInstances });

  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetDemo();
  });

  it('opens the workflow for the loan officer who submitted it', () => {
    const access = workflowAccess(state(), DEMO_USERS.priya, SAVITA.applicationId);
    expect(access.reason).toBeNull();
    expect(access.instance?.applicationId).toBe(SAVITA.applicationId);
  });

  it('opens it for the approver whose step it is, and for the administrator', () => {
    expect(
      workflowAccess(state(), DEMO_USERS.mahesh, MANJUNATH.applicationId).instance,
    ).not.toBeNull();
    expect(
      workflowAccess(state(), DEMO_USERS.sunita, SHOBHA.applicationId).instance,
    ).not.toBeNull();
    expect(
      workflowAccess(state(), DEMO_USERS.admin, BASAVARAJ.applicationId).instance,
    ).not.toBeNull();
  });

  it('does not open it for a user who is not on the workflow, and says why', () => {
    // Manjunath's application was submitted by the Gokak loan officer, not by Priya
    const access = workflowAccess(state(), DEMO_USERS.priya, MANJUNATH.applicationId);
    expect(access.instance).toBeNull();
    expect(access.reason).toMatch(/people on this workflow/);
  });

  it('has nothing to open for an application that was never submitted', () => {
    const access = workflowAccess(state(), DEMO_USERS.admin, 'HL-2026-0099');
    expect(access.instance).toBeNull();
    expect(access.reason).toMatch(/not been submitted/);
  });
});
