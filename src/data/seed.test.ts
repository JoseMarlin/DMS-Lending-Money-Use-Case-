import { ageOn } from './application';
import { isMaskedAadhaar, isValidAadhaar } from './aadhaar';
import { DEMO_USERS, SCENARIOS, SCENARIO_KEYS, SEED_APPLICATIONS } from './seed';
import { ApplicationStatus, SUPPORTING_DOCUMENT } from './types';

const PAN_FORMAT = /^[A-Z]{5}\d{4}[A-Z]$/;
const FULL_AADHAAR = /\d{12}|\b\d{4}[ -]\d{4}[ -]\d{4}\b/;

describe('demo users (section 5)', () => {
  it('has the four users with the exact names and branches', () => {
    expect(DEMO_USERS.priya).toMatchObject({
      name: 'Priya Kulkarni',
      role: 'loanOfficer',
      branch: 'Belagavi Main Branch (demo)',
    });
    expect(DEMO_USERS.mahesh).toMatchObject({
      name: 'Mahesh Joshi',
      role: 'branchManager',
      branch: 'Belagavi Main Branch (demo)',
    });
    expect(DEMO_USERS.sunita).toMatchObject({
      name: 'Sunita Hegde',
      role: 'creditApprover',
      branch: 'Head Office, Credit (demo)',
    });
    expect(DEMO_USERS.admin).toMatchObject({ name: 'Admin', role: 'admin', branch: 'Head Office' });
  });

  it('keeps the maker and both approvers as different people', () => {
    const names = [DEMO_USERS.priya, DEMO_USERS.mahesh, DEMO_USERS.sunita].map((u) => u.name);
    expect(new Set(names).size).toBe(3);
  });
});

describe('scenarios (section 13)', () => {
  it('scenario A: Ramesh Patil, Business, clean pass', () => {
    const a = SCENARIOS.A.application;
    expect(a).toMatchObject({
      fullNameAsPerPan: 'Ramesh Patil',
      occupation: 'Business',
      dateOfBirth: '1984-03-14',
      pan: 'ABCPP1234F',
      gstin: '29ABCPP1234F1Z5',
      loanAmountRequested: 1_800_000,
      tenureMonths: 180,
      loanPurpose: 'Construction of house',
      estimatedCost: 2_600_000,
      eligibleAmount: 1_950_000,
      aadhaar: 'XXXX XXXX 4821',
    });
    expect(SCENARIOS.A.kycSource).toMatchObject({ nameMatchPercent: 100, panActive: true });
  });

  it('scenario B: Anita Desai, Salaried, name matches 86%', () => {
    const b = SCENARIOS.B.application;
    expect(b).toMatchObject({
      fullNameAsPerPan: 'Anita Desai',
      occupation: 'Salaried',
      dateOfBirth: '1990-09-02',
      pan: 'ABCPD5678K',
      loanAmountRequested: 1_200_000,
      tenureMonths: 120,
      estimatedCost: 1_650_000,
      eligibleAmount: 1_237_500,
      aadhaar: 'XXXX XXXX 7733',
    });
    expect(b.gstin ?? '').toBe('');
    expect(SCENARIOS.B.kycSource).toMatchObject({
      panNameAsPerSource: 'ANITA R DESAI',
      nameMatchPercent: 86,
    });
  });

  it('scenario C: Kiran Naik, Salaried, PAN inactive', () => {
    const c = SCENARIOS.C.application;
    expect(c).toMatchObject({
      fullNameAsPerPan: 'Kiran Naik',
      occupation: 'Salaried',
      dateOfBirth: '1988-06-21',
      pan: 'ABCPD9012L',
      loanAmountRequested: 1_000_000,
      tenureMonths: 120,
      estimatedCost: 1_400_000,
      eligibleAmount: 1_050_000,
      aadhaar: 'XXXX XXXX 2290',
    });
    expect(c.gstin ?? '').toBe('');
    expect(SCENARIOS.C.kycSource.panActive).toBe(false);
  });

  it('scenario A fires the 75% rule at 22,00,000', () => {
    const eligible = SCENARIOS.A.application.eligibleAmount!;
    expect(2_200_000).toBeGreaterThan(eligible);
    expect(SCENARIOS.A.application.loanAmountRequested!).toBeLessThanOrEqual(eligible);
  });

  it('each scenario has a Verhoeff-valid dummy Aadhaar ending in the right digits', () => {
    expect(isValidAadhaar(SCENARIOS.A.aadhaarInput)).toBe(true);
    expect(isValidAadhaar(SCENARIOS.B.aadhaarInput)).toBe(true);
    expect(isValidAadhaar(SCENARIOS.C.aadhaarInput)).toBe(true);
    expect(SCENARIOS.A.aadhaarInput.endsWith('4821')).toBe(true);
    expect(SCENARIOS.B.aadhaarInput.endsWith('7733')).toBe(true);
    expect(SCENARIOS.C.aadhaarInput.endsWith('2290')).toBe(true);
  });

  it('prefills a valid PAN, mobile, PIN and two sureties', () => {
    SCENARIO_KEYS.forEach((key) => {
      const a = SCENARIOS[key].application;
      expect(a.pan).toMatch(PAN_FORMAT);
      expect(a.pan![3]).toBe('P');
      expect(a.mobile).toMatch(/^\d{10}$/);
      expect(a.pinCode).toMatch(/^\d{6}$/);
      expect(a.surety1Name && a.surety2Name).toBeTruthy();
      expect(a.propertyOwnerName).toBe(a.fullNameAsPerPan);
      expect(ageOn(a.dateOfBirth!, '2026-10-08')).toBeGreaterThanOrEqual(18);
      expect(ageOn(a.dateOfBirth!, '2026-10-08')).toBeLessThanOrEqual(55);
    });
  });

  it('GSTIN contains the PAN (scenario A)', () => {
    const a = SCENARIOS.A.application;
    expect(a.gstin).toHaveLength(15);
    expect(a.gstin!.includes(a.pan!)).toBe(true);
  });

  it('attaches one file per DocType: 13 for Business, 12 for Salaried', () => {
    expect(SCENARIOS.A.documents).toHaveLength(13);
    expect(SCENARIOS.B.documents).toHaveLength(12);
    expect(SCENARIOS.C.documents).toHaveLength(12);
    SCENARIO_KEYS.forEach((key) => {
      const types = SCENARIOS[key].documents.map((d) => d.docType);
      expect(new Set(types).size).toBe(types.length);
      SCENARIOS[key].documents.forEach((d) =>
        expect(d.sizeBytes).toBeLessThanOrEqual(5 * 1024 * 1024),
      );
    });
  });

  it('does not put a full Aadhaar number in the application values', () => {
    SCENARIO_KEYS.forEach((key) => {
      const json = JSON.stringify({ ...SCENARIOS[key], aadhaarInput: undefined });
      expect(json).not.toMatch(FULL_AADHAAR);
    });
  });
});

describe('existing applications (list screen)', () => {
  it('has 7 applications in mixed statuses: two approved, and one draft', () => {
    expect(SEED_APPLICATIONS).toHaveLength(7);
    expect(SEED_APPLICATIONS.map((a) => a.status).sort()).toEqual(
      [
        ApplicationStatus.Approved,
        ApplicationStatus.Approved,
        ApplicationStatus.InLevel1,
        ApplicationStatus.InLevel2,
        ApplicationStatus.Rejected,
        ApplicationStatus.Returned,
        ApplicationStatus.Draft,
      ].sort(),
    );
  });

  it('numbers them HL-2026-0001 to HL-2026-0007', () => {
    expect(SEED_APPLICATIONS.map((a) => a.applicationId)).toEqual([
      'HL-2026-0001',
      'HL-2026-0002',
      'HL-2026-0003',
      'HL-2026-0004',
      'HL-2026-0005',
      'HL-2026-0006',
      'HL-2026-0007',
    ]);
  });

  it('names them as the demo does: the sixth is Meera Joshi (approved), the seventh Prakash Naik (a draft)', () => {
    const [, , , , , meera, prakash] = SEED_APPLICATIONS;
    expect(meera).toMatchObject({
      fullNameAsPerPan: 'Meera Joshi',
      branch: 'Belagavi Main Branch (demo)',
      createdBy: 'Priya Kulkarni',
      occupation: 'Salaried',
      applicationDate: '2026-09-25',
      status: ApplicationStatus.Approved,
      level2Time: '2026-10-02T15:00:00+05:30',
    });
    expect(prakash).toMatchObject({
      fullNameAsPerPan: 'Prakash Naik',
      createdBy: 'Priya Kulkarni',
      status: ApplicationStatus.Draft,
    });
  });

  it('uses PANs that differ from the scenarios, so the duplicate-PAN check does not block the demo', () => {
    const pans = [
      ...SEED_APPLICATIONS.map((a) => a.pan),
      ...SCENARIO_KEYS.map((k) => SCENARIOS[k].application.pan!),
    ];
    expect(new Set(pans).size).toBe(pans.length);
    pans.forEach((pan) => expect(pan).toMatch(PAN_FORMAT));
  });

  it('only holds masked Aadhaar numbers', () => {
    SEED_APPLICATIONS.forEach((a) => {
      expect(a.aadhaar).toMatch(/^XXXX XXXX \d{4}$/);
      expect(isMaskedAadhaar(a.aadhaar)).toBe(true);
    });
    expect(JSON.stringify(SEED_APPLICATIONS)).not.toMatch(FULL_AADHAAR);
  });

  it('respects the bank limits and the applicant age range', () => {
    SEED_APPLICATIONS.forEach((a) => {
      expect(a.loanAmountRequested!).toBeLessThanOrEqual(3_000_000);
      expect(a.loanAmountRequested!).toBeLessThanOrEqual(a.eligibleAmount!);
      expect(a.tenureMonths!).toBeLessThanOrEqual(240);
      const age = ageOn(a.dateOfBirth, a.applicationDate)!;
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(55);
      expect(a.propertyOwnerName).toBe(a.fullNameAsPerPan);
    });
  });

  it('shows GSTIN only for Business and Professional applicants, and it contains the PAN', () => {
    SEED_APPLICATIONS.forEach((a) => {
      if (a.occupation === 'Business' || a.occupation === 'Professional') {
        expect(a.gstin.includes(a.pan)).toBe(true);
      } else {
        expect(a.gstin).toBe('');
      }
    });
  });

  it('fills the approval fields to match each status', () => {
    const byStatus = Object.fromEntries(SEED_APPLICATIONS.map((a) => [a.status, a]));
    const approvedOnes = SEED_APPLICATIONS.filter((a) => a.status === ApplicationStatus.Approved);

    // two were approved: Vijay Kulkarni (0001) and Meera Joshi (0006), each for what was asked
    expect(approvedOnes.map((a) => [a.applicationId, a.sanctionedAmount])).toEqual([
      ['HL-2026-0001', 2_000_000],
      ['HL-2026-0006', 1_600_000],
    ]);
    for (const approved of approvedOnes) {
      expect(approved).toMatchObject({
        level1Decision: 'Approved',
        level1Approver: 'Mahesh Joshi',
        level2Decision: 'Approved',
        level2Approver: 'Sunita Hegde',
        sanctionedAmount: approved.loanAmountRequested,
      });
      expect(approved.sanctionedAmount!).toBeLessThanOrEqual(approved.eligibleAmount!);
    }

    expect(byStatus[ApplicationStatus.InLevel2]).toMatchObject({
      level1Decision: 'Approved',
      level2Decision: '',
    });
    expect(byStatus[ApplicationStatus.InLevel1]).toMatchObject({
      level1Decision: '',
      level2Decision: '',
    });

    const returned = byStatus[ApplicationStatus.Returned];
    expect(returned.level1Decision).toBe('Returned');
    expect(returned.level1Remarks).not.toBe('');

    const rejected = byStatus[ApplicationStatus.Rejected];
    expect(rejected.level2Decision).toBe('Rejected');
    expect(rejected.level2Remarks).not.toBe('');
    expect(rejected.sanctionedAmount).toBeNull();

    // the draft was never submitted: no decision, no sanction, no consent and no KYC result yet
    const draft = byStatus[ApplicationStatus.Draft];
    expect(draft).toMatchObject({
      level1Decision: '',
      level2Decision: '',
      sanctionedAmount: null,
      consentGiven: false,
      kycOverallResult: '',
    });
  });

  it('includes one KYC exception with a remark', () => {
    const exceptions = SEED_APPLICATIONS.filter((a) => a.kycOverallResult === 'Exception');
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].kycExceptionRemark).not.toBe('');
  });

  it('gives every submitted application one file per required DocType, and the draft its first three', () => {
    SEED_APPLICATIONS.forEach((a) => {
      const formFiles = a.documents.filter((d) => d.docType !== SUPPORTING_DOCUMENT);
      if (a.status === ApplicationStatus.Draft) {
        expect(formFiles.map((d) => d.docType)).toEqual([
          'PAN Card',
          'Aadhaar (Masked Copy)',
          'Photograph',
        ]);
        return;
      }
      const expected = a.occupation === 'Business' || a.occupation === 'Professional' ? 13 : 12;
      expect(formFiles).toHaveLength(expected);
      expect(new Set(formFiles.map((d) => d.docType)).size).toBe(expected);
    });
  });

  it('has one or two supporting attachments on every application, each with a note', () => {
    SEED_APPLICATIONS.forEach((a) => {
      const attachments = a.documents.filter((d) => d.docType === SUPPORTING_DOCUMENT);
      expect(attachments.length, a.applicationId).toBeGreaterThanOrEqual(1);
      expect(attachments.length, a.applicationId).toBeLessThanOrEqual(2);
      attachments.forEach((d) => expect(d.note ?? '').not.toBe(''));
      // they come after the documents of the form
      expect(a.documents.slice(-attachments.length)).toEqual(attachments);
    });
    const vijay = SEED_APPLICATIONS[0];
    expect(vijay.documents).toHaveLength(14); // 12 documents and 2 attachments
    expect(
      vijay.documents.filter((d) => d.docType === SUPPORTING_DOCUMENT).map((d) => d.fileName),
    ).toEqual(['Salary_Slip_Aug.pdf', 'Electricity_Bill.pdf']);
  });
});
