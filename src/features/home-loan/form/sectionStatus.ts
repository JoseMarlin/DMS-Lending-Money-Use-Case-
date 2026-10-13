import type { HomeLoanApplication } from '@/data/types';
import { isFieldEmpty, validateField } from '../validation/validate';
import { isFieldVisible } from './formState';
import { fieldId, type SectionSchema } from './schema';

export interface SectionStatus {
  /** Required fields that are showing */
  required: number;
  /** How many of them have something in them */
  filled: number;
  /** Fields of the section that show an error right now */
  errors: number;
  /** Filled-in fields that break a rule, whether or not their error shows yet */
  invalid: number;
}

/** What the header of a section says: how far it is filled in and whether it has errors. */
export function sectionStatus(
  section: SectionSchema,
  values: HomeLoanApplication,
  errors: Partial<Record<string, string>>,
): SectionStatus {
  const visible = section.fields.filter((field) => isFieldVisible(field, values));
  const required = visible.filter((field) => field.required);
  return {
    required: required.length,
    filled: required.filter((field) => !isFieldEmpty(field, values)).length,
    errors: visible.filter((field) => errors[fieldId(field)]).length,
    invalid: visible.filter(
      (field) => !isFieldEmpty(field, values) && validateField(field, values) !== null,
    ).length,
  };
}

/** The id of the section a field belongs to. */
export function sectionIdOf(sections: SectionSchema[], field: { key: string; docType?: string }) {
  return sections.find((section) =>
    section.fields.some((f) => f.key === field.key && f.docType === field.docType),
  )?.id;
}
