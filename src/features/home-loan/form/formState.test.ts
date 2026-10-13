import { createBlankApplication } from '@/data/application';
import {
  buildPatch,
  emptyValueFor,
  getFieldValue,
  isFieldVisible,
  toFieldValue,
} from './formState';
import type { FieldSchema, SectionSchema } from './schema';
import { STEP1_SECTIONS } from './step1Schema';

const blank = () =>
  createBlankApplication({ applicationId: 'HL-2026-0008', branch: 'b', createdBy: 'u' });

const allFields = STEP1_SECTIONS.flatMap((section) => section.fields);
const field = (key: string) => allFields.find((f) => f.key === key)!;
const [fullName, occupation, gstin] = [
  field('fullNameAsPerPan'),
  field('occupation'),
  field('gstin'),
];

describe('getFieldValue', () => {
  it('returns text, numbers as text, and empty for null', () => {
    const values = { ...blank(), fullNameAsPerPan: 'Ramesh Patil', loanAmountRequested: 1800000 };
    expect(getFieldValue(values, fullName)).toBe('Ramesh Patil');
    expect(getFieldValue(values, { key: 'loanAmountRequested', label: 'x', type: 'number' })).toBe(
      '1800000',
    );
    expect(getFieldValue(values, { key: 'tenureMonths', label: 'x', type: 'number' })).toBe('');
  });
});

describe('toFieldValue', () => {
  it('keeps digits only for number fields and returns null when empty', () => {
    expect(toFieldValue('number', '18,00,000')).toBe(1800000);
    expect(toFieldValue('number', 'abc')).toBeNull();
    expect(toFieldValue('number', '')).toBeNull();
  });

  it('keeps text as typed', () => {
    expect(toFieldValue('text', ' Ramesh ')).toBe(' Ramesh ');
    expect(toFieldValue('dropdown', 'Business')).toBe('Business');
  });
});

describe('buildPatch: documents', () => {
  const doc = (docType: 'PAN Card' | 'GST Certificate or Business Licence') => ({
    id: docType,
    docType,
    fileName: 'a.pdf',
    mimeType: 'application/pdf' as const,
    sizeBytes: 1,
    uploadedAt: '2026-10-08T10:00:00.000Z',
    uploadedBy: 'Priya Kulkarni',
  });

  it('removes only the GST certificate when Occupation stops being Business', () => {
    const values = {
      ...blank(),
      occupation: 'Business' as const,
      documents: [doc('PAN Card'), doc('GST Certificate or Business Licence')],
    };
    const patch = buildPatch(STEP1_SECTIONS, values, occupation, 'Salaried');
    expect(patch.documents?.map((d) => d.docType)).toEqual(['PAN Card']);
  });

  it('keeps the GST certificate while the slot stays visible', () => {
    const values = {
      ...blank(),
      occupation: 'Business' as const,
      documents: [doc('GST Certificate or Business Licence')],
    };
    expect(
      buildPatch(STEP1_SECTIONS, values, occupation, 'Professional').documents,
    ).toBeUndefined();
  });
});

describe('toggle values', () => {
  it('turns the text of a toggle into a boolean', () => {
    expect(toFieldValue('toggle', 'true')).toBe(true);
    expect(toFieldValue('toggle', 'false')).toBe(false);
    expect(toFieldValue('toggle', '')).toBe(false);
  });

  it('clears the co-applicant details when the toggle is turned off', () => {
    const toggle = field('addCoApplicant');
    const values = {
      ...blank(),
      addCoApplicant: true,
      coApplicantName: 'Sunanda Patil',
      coApplicantRelation: 'Spouse' as const,
    };
    expect(buildPatch(STEP1_SECTIONS, values, toggle, 'false')).toEqual({
      addCoApplicant: false,
      coApplicantName: '',
      coApplicantRelation: '',
    });
  });

  it('keeps them when the toggle is turned on', () => {
    expect(buildPatch(STEP1_SECTIONS, blank(), field('addCoApplicant'), 'true')).toEqual({
      addCoApplicant: true,
    });
  });
});

describe('emptyValueFor', () => {
  it('matches the blank record', () => {
    expect(emptyValueFor('toggle')).toBe(false);
    expect(emptyValueFor('text')).toBe('');
    expect(emptyValueFor('dropdown')).toBe('');
    expect(emptyValueFor('number')).toBeNull();
    expect(emptyValueFor('checkbox')).toBe(false);
  });
});

describe('isFieldVisible', () => {
  it('shows GSTIN only for Business and Professional', () => {
    expect(isFieldVisible(gstin, { ...blank(), occupation: 'Business' })).toBe(true);
    expect(isFieldVisible(gstin, { ...blank(), occupation: 'Professional' })).toBe(true);
    expect(isFieldVisible(gstin, { ...blank(), occupation: 'Salaried' })).toBe(false);
    expect(isFieldVisible(gstin, blank())).toBe(false);
    expect(isFieldVisible(fullName, blank())).toBe(true);
  });
});

describe('buildPatch', () => {
  it('changes just the field that was edited', () => {
    expect(buildPatch(STEP1_SECTIONS, blank(), fullName, 'Anita Desai')).toEqual({
      fullNameAsPerPan: 'Anita Desai',
    });
  });

  it('does not clear GSTIN while it stays visible', () => {
    const values = { ...blank(), occupation: 'Business' as const, gstin: '29ABCPP1234F1Z5' };
    expect(buildPatch(STEP1_SECTIONS, values, occupation, 'Professional')).toEqual({
      occupation: 'Professional',
    });
  });

  it('clears GSTIN when Occupation changes so it is hidden', () => {
    const values = { ...blank(), occupation: 'Business' as const, gstin: '29ABCPP1234F1Z5' };
    expect(buildPatch(STEP1_SECTIONS, values, occupation, 'Salaried')).toEqual({
      occupation: 'Salaried',
      gstin: '',
      documents: [], // the GST certificate slot is hidden too
    });
  });

  it('clears hidden number fields to null', () => {
    const sections: SectionSchema[] = [
      {
        id: 's',
        title: 'S',
        fields: [
          { key: 'occupation', label: 'Occupation', type: 'dropdown' },
          {
            key: 'monthlyIncome',
            label: 'Monthly Income',
            type: 'number',
            visibleWhen: (v) => v.occupation === 'Salaried',
          },
        ],
      },
    ];
    const trigger: FieldSchema = sections[0].fields[0];
    const values = { ...blank(), occupation: 'Salaried' as const, monthlyIncome: 85000 };
    expect(buildPatch(sections, values, trigger, 'Business')).toEqual({
      occupation: 'Business',
      monthlyIncome: null,
    });
  });
});
