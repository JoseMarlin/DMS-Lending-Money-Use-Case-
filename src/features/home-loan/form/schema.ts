import type { DocType, HomeLoanApplication } from '@/data/types';

/** Input types from PROJECT_OVERVIEW.md section 6. `auto` and `calculated` are flags, see below. */
export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'multiLine'
  | 'dropdown'
  | 'date'
  | 'checkbox'
  | 'toggle'
  | 'attachment';

/**
 * How much of the row a field takes. The form is a grid of three columns:
 * third = one column (the usual), half = one and a half, twoThirds = two columns, full = the row.
 */
export type FieldWidth = 'third' | 'half' | 'twoThirds' | 'full';

/** Key of a field in the master record */
export type FieldKey = keyof HomeLoanApplication;

export interface FieldSchema {
  /** Key in HomeLoanApplication (camelCase of the label). Every attachment uses 'documents'. */
  key: FieldKey;
  /** Label exactly as in the overview */
  label: string;
  /** Short name for the error summary, when the label is a whole sentence (the consent) */
  summaryLabel?: string;
  type: FieldType;
  required?: boolean;
  /** Choices for a dropdown */
  options?: readonly string[];
  /** For an attachment: the DocType the file is tagged with (one file per DocType) */
  docType?: DocType;
  /** Width in the form grid. Default: third (three fields in a row). */
  width?: FieldWidth;
  /** Small heading shown above the first field of a group, for example "KYC" */
  group?: string;
  placeholder?: string;
  /** Grey hint under the field. A function can use the current values. */
  helperText?: string | ((values: HomeLoanApplication) => string | undefined);
  /** Field is shown but cannot be changed while this returns true */
  disabledWhen?: (values: HomeLoanApplication) => boolean;
  /** Field is shown only when this returns true. Hidden fields are cleared. */
  visibleWhen?: (values: HomeLoanApplication) => boolean;
  /** Text is turned into capitals as it is typed (PAN, GSTIN) */
  uppercase?: boolean;
  /**
   * 'aadhaar': typed in groups of four, masked to XXXX XXXX 1234 when the user leaves the field.
   * The store only gets the masked value; the real number stays in the input's own state.
   */
  mask?: 'aadhaar';
  /** Message when a required field is left empty. Default: "Enter <label>" ("Select" for dropdowns). */
  requiredMessage?: string;
  /**
   * Rule for a filled-in value (see features/home-loan/validation/rules.ts). Returns the error
   * message or null. Leave empty values to `required`.
   */
  validate?: (values: HomeLoanApplication) => string | null;
  /** Shown but not editable (auto fields such as Application ID) */
  readOnly?: boolean;
  /** Value is worked out by the store (Eligible Amount, Co-applicant Required). Always read only. */
  calculated?: boolean;
}

export interface SectionSchema {
  id: string;
  /** Section heading, for example "Applicant" */
  title: string;
  /** Short note under the heading, for example "Two sureties are required." */
  note?: string;
  fields: FieldSchema[];
}

/** Unique id of a field in the schema. Attachments share the key 'documents', so they use the DocType. */
export function fieldId(field: FieldSchema): string {
  return field.docType ? `documents.${field.docType}` : field.key;
}

/** id of the field's control in the page, for example 'field-fullNameAsPerPan' or 'field-doc-pan-card' */
export function fieldDomId(field: FieldSchema): string {
  return field.docType
    ? `field-doc-${field.docType
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`
    : `field-${field.key}`;
}
