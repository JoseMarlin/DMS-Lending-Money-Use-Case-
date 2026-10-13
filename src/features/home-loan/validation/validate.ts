import type { HomeLoanApplication } from '@/data/types';
import { isFieldVisible } from '../form/formState';
import { fieldId, type FieldSchema, type SectionSchema } from '../form/schema';
import { validateDuplicatePan } from './rules';

/** One problem found in the form, in the order the fields appear. */
export interface ValidationIssue {
  /** See fieldId() in form/schema.ts */
  fieldId: string;
  field: FieldSchema;
  /** Label of the field, for the summary at the top */
  label: string;
  message: string;
}

/** True when the field has nothing in it. Numbers count 0 as empty, a checkbox as not ticked. */
export function isFieldEmpty(field: FieldSchema, values: HomeLoanApplication): boolean {
  if (field.type === 'attachment') {
    return !values.documents.some((d) => d.docType === field.docType);
  }
  const value = values[field.key];
  if (field.type === 'checkbox' || field.type === 'toggle') return value !== true;
  if (field.type === 'number') return value === null || value === undefined || value === 0;
  return typeof value !== 'string' || value.trim() === '';
}

function requiredMessage(field: FieldSchema): string {
  if (field.requiredMessage) return field.requiredMessage;
  if (field.type === 'attachment') return `Upload ${field.label}`;
  if (field.type === 'dropdown') return `Select ${field.label}`;
  return `Enter ${field.label}`;
}

/** The error for one field, or null: hidden fields are never wrong, then required, then its rule. */
export function validateField(field: FieldSchema, values: HomeLoanApplication): string | null {
  if (!isFieldVisible(field, values)) return null;
  if (isFieldEmpty(field, values)) return field.required ? requiredMessage(field) : null;
  return field.validate?.(values) ?? null;
}

interface ValidateOptions {
  /** Saved applications, for the duplicate PAN check */
  applications?: Pick<HomeLoanApplication, 'applicationId' | 'pan'>[];
  /** Also check that no other application has this PAN (done when moving to Step 2) */
  checkDuplicatePan?: boolean;
}

/** Every problem in the sections, in schema order. Empty when Step 1 can be submitted. */
export function validateStep1(
  sections: SectionSchema[],
  values: HomeLoanApplication,
  { applications = [], checkDuplicatePan = false }: ValidateOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      let message = validateField(field, values);
      // Duplicate PAN belongs to the applicant's PAN field, and only if the PAN is otherwise fine
      if (!message && checkDuplicatePan && field.key === 'pan') {
        message = validateDuplicatePan(values.pan, applications, values.applicationId);
      }
      if (message) {
        issues.push({
          fieldId: fieldId(field),
          field,
          label: field.summaryLabel ?? field.label,
          message,
        });
      }
    }
  }
  return issues;
}
