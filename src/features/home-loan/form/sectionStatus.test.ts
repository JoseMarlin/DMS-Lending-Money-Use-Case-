import { createBlankApplication } from '@/data/application';
import { SCENARIOS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import { sectionIdOf, sectionStatus } from './sectionStatus';
import { STEP1_SECTIONS } from './step1Schema';

const section = (id: string) => STEP1_SECTIONS.find((s) => s.id === id)!;
const blank = () =>
  createBlankApplication({ applicationId: 'HL-2026-0008', branch: 'b', createdBy: 'u' });

function filledScenarioA() {
  useAppStore.getState().resetDemo();
  useAppStore.getState().fillScenario('A');
  return useAppStore.getState().draft;
}

describe('sectionStatus', () => {
  it('counts the required fields of each section on a blank form', () => {
    const counts = Object.fromEntries(
      STEP1_SECTIONS.map((s) => [s.id, sectionStatus(s, blank(), {}).required]),
    );
    expect(counts).toEqual({
      application: 3,
      applicant: 5,
      identity: 2,
      property: 3,
      'co-applicant': 0,
      sureties: 6,
      documents: 12,
      consent: 1,
    });
  });

  it('counts the GSTIN as required only when it shows: Business and Professional', () => {
    const identity = section('identity');
    expect(sectionStatus(identity, blank(), {}).required).toBe(2);
    expect(sectionStatus(identity, { ...blank(), occupation: 'Salaried' }, {}).required).toBe(2);
    expect(sectionStatus(identity, { ...blank(), occupation: 'Business' }, {}).required).toBe(3);
    expect(sectionStatus(identity, { ...blank(), occupation: 'Professional' }, {}).required).toBe(
      3,
    );
  });

  it('counts a filled GSTIN, and Loan Purpose in the Application section', () => {
    const business = { ...blank(), occupation: 'Business' as const };
    expect(sectionStatus(section('identity'), business, {}).filled).toBe(0);
    expect(
      sectionStatus(section('identity'), { ...business, gstin: '29ABCPD5678K1Z5' }, {}).filled,
    ).toBe(1);
    expect(sectionStatus(section('application'), blank(), {}).filled).toBe(0);
    expect(
      sectionStatus(section('application'), { ...blank(), loanPurpose: 'Purchase of flat' }, {})
        .filled,
    ).toBe(1);
  });

  it('counts a required GSTIN-dependent document only when it shows', () => {
    expect(sectionStatus(section('documents'), blank(), {}).required).toBe(12);
    expect(
      sectionStatus(section('documents'), { ...blank(), occupation: 'Business' }, {}).required,
    ).toBe(13);
  });

  it('nothing is filled on a blank form', () => {
    STEP1_SECTIONS.forEach((s) => {
      expect(sectionStatus(s, blank(), {}).filled).toBe(0);
    });
  });

  it('scenario A fills every section except the consent', () => {
    const draft = filledScenarioA();
    STEP1_SECTIONS.forEach((s) => {
      const status = sectionStatus(s, draft, {});
      expect(status.filled).toBe(s.id === 'consent' ? 0 : status.required);
    });
    expect(SCENARIOS.A.application.fullNameAsPerPan).toBe('Ramesh Patil');
  });

  it('counts the errors that show in the section, by field id', () => {
    const errors = {
      pan: 'Enter a valid PAN, for example ABCPP1234F',
      aadhaar: 'Enter a valid 12-digit Aadhaar',
      fullNameAsPerPan: 'Enter Full Name (as per PAN)',
    };
    expect(sectionStatus(section('identity'), blank(), errors).errors).toBe(2);
    expect(sectionStatus(section('applicant'), blank(), errors).errors).toBe(1);
    expect(sectionStatus(section('sureties'), blank(), errors).errors).toBe(0);
  });

  it('counts a document error through its DocType id', () => {
    const errors = { 'documents.PAN Card': 'Upload PAN Card' };
    expect(sectionStatus(section('documents'), blank(), errors).errors).toBe(1);
  });

  it('ignores an error of a field that is not showing', () => {
    const errors = { gstin: 'GSTIN does not match the PAN entered' };
    expect(sectionStatus(section('identity'), blank(), errors).errors).toBe(0);
    expect(
      sectionStatus(section('identity'), { ...blank(), occupation: 'Business' }, errors).errors,
    ).toBe(1);
  });
});

describe('sectionIdOf', () => {
  const field = (id: string, key: string) =>
    section(id).fields.find((f) => f.key === key && !f.docType)!;

  it('finds the section a field is in', () => {
    expect(sectionIdOf(STEP1_SECTIONS, field('identity', 'pan'))).toBe('identity');
    expect(sectionIdOf(STEP1_SECTIONS, field('sureties', 'surety2Pan'))).toBe('sureties');
    expect(sectionIdOf(STEP1_SECTIONS, field('consent', 'consentGiven'))).toBe('consent');
  });

  it('finds the section of a document by its DocType', () => {
    const doc = section('documents').fields.find((f) => f.docType === 'Photograph')!;
    expect(sectionIdOf(STEP1_SECTIONS, doc)).toBe('documents');
  });
});
