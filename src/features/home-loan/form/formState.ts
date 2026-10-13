import type { HomeLoanApplication } from '@/data/types';
import type { FieldSchema, FieldType, SectionSchema } from './schema';

export function isFieldVisible(field: FieldSchema, values: HomeLoanApplication): boolean {
  return field.visibleWhen ? field.visibleWhen(values) : true;
}

/** The value of a field as the text shown in its input. */
export function getFieldValue(values: HomeLoanApplication, field: FieldSchema): string {
  const value = values[field.key];
  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value);
}

/** What an empty field holds in the record. */
export function emptyValueFor(type: FieldType): '' | null | false {
  if (type === 'number') return null;
  if (type === 'checkbox' || type === 'toggle') return false;
  return '';
}

/** Hint text of a field for the current values. */
export function getHelperText(field: FieldSchema, values: HomeLoanApplication): string | undefined {
  return typeof field.helperText === 'function' ? field.helperText(values) : field.helperText;
}

export function isFieldDisabled(field: FieldSchema, values: HomeLoanApplication): boolean {
  return Boolean(field.readOnly || field.calculated || field.disabledWhen?.(values));
}

/** Turns the text typed in an input into the value kept in the record. */
export function toFieldValue(type: FieldType, raw: string): string | number | boolean | null {
  if (type === 'checkbox' || type === 'toggle') return raw === 'true';
  if (type === 'number') {
    const digits = raw.replace(/\D/g, '');
    return digits === '' ? null : Number(digits);
  }
  return raw;
}

/**
 * The change to write to the store when one field changes. Fields that become hidden because of
 * the change (for example GSTIN when Occupation is no longer Business) are cleared, so no stale
 * value is left behind.
 */
export function buildPatch(
  sections: SectionSchema[],
  values: HomeLoanApplication,
  field: FieldSchema,
  raw: string,
): Partial<HomeLoanApplication> {
  const patch: Record<string, unknown> = { [field.key]: toFieldValue(field.type, raw) };
  const next = { ...values, ...patch } as HomeLoanApplication;

  for (const section of sections) {
    for (const other of section.fields) {
      if (isFieldVisible(other, values) && !isFieldVisible(other, next)) {
        if (other.type === 'attachment') {
          // a hidden document slot loses its file
          const kept =
            (patch.documents as HomeLoanApplication['documents'] | undefined) ?? values.documents;
          patch.documents = kept.filter((d) => d.docType !== other.docType);
        } else {
          patch[other.key] = emptyValueFor(other.type);
        }
      }
    }
  }
  return patch as Partial<HomeLoanApplication>;
}
