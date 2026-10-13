import { maskAadhaar } from '@/data/aadhaar';
import type { HomeLoanApplication } from '@/data/types';
import { formatIndianNumber, isoToDisplay } from '@/lib/format';
import { isFieldVisible } from '../form/formState';
import { fieldId, type FieldSchema, type SectionSchema } from '../form/schema';

export interface ReviewRow {
  id: string;
  label: string;
  value: string;
  /** Nothing was entered */
  empty: boolean;
}

export interface ReviewGroup {
  id: string;
  title: string;
  rows: ReviewRow[];
}

/** A field's value the way a person reads it: DD/MM/YYYY, 18,00,000, Yes or No, a masked Aadhaar. */
export function formatFieldValue(field: FieldSchema, values: HomeLoanApplication): string {
  const raw = values[field.key];
  if (field.mask === 'aadhaar') return maskAadhaar(typeof raw === 'string' ? raw : '');
  if (raw === null || raw === undefined || raw === '') return '';
  switch (field.type) {
    case 'number':
      return typeof raw === 'number' ? formatIndianNumber(raw) : '';
    case 'date':
      return typeof raw === 'string' ? isoToDisplay(raw) : '';
    case 'toggle':
      return raw === true ? 'Yes' : 'No';
    default:
      return typeof raw === 'string' ? raw : String(raw);
  }
}

/**
 * The read-only summary of the application, built from the same schema as the form, so a field
 * added to the form shows up here too. Documents and consent have their own blocks.
 */
export function buildReviewGroups(
  sections: SectionSchema[],
  values: HomeLoanApplication,
): ReviewGroup[] {
  return sections
    .filter((section) => section.id !== 'documents' && section.id !== 'consent')
    .map((section) => ({
      id: section.id,
      title: section.title,
      rows: section.fields
        .filter((field) => isFieldVisible(field, values))
        .filter((field) => field.type !== 'attachment' && field.type !== 'checkbox')
        .map((field) => {
          const value = formatFieldValue(field, values);
          return {
            id: fieldId(field),
            label: field.label,
            value: value || '—',
            empty: value === '',
          };
        }),
    }))
    .filter((group) => group.rows.length > 0);
}
