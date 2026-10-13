import {
  Checkbox,
  DatePicker,
  FieldMessage,
  FileUploadRow,
  FormField,
  NumberInput,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from '@/components/ui';
import type { ReactNode } from 'react';
import type { HomeLoanApplication } from '@/data/types';
import AadhaarField from './AadhaarField';
import { getFieldValue, getHelperText, isFieldDisabled } from './formState';
import { fieldDomId, type FieldSchema } from './schema';

interface FieldRendererProps {
  field: FieldSchema;
  values: HomeLoanApplication;
  /** Error text from validation, shown in red under the control */
  error?: string;
  /** Called with the text typed or the option chosen */
  onChange: (field: FieldSchema, raw: string) => void;
  /** The user left the field (used to show its error) */
  onBlur?: (field: FieldSchema) => void;
  /** A file was chosen for an attachment field */
  onFileSelect?: (field: FieldSchema, file: File) => void;
  /** The file of an attachment field was removed */
  onFileRemove?: (field: FieldSchema) => void;
  /** False where the number of the active scenario must never be put in the Aadhaar input (the record sheet) */
  scenarioPrefill?: boolean;
}

/** Draws one field from its schema: label, the right control for its type, helper or error text. */
export default function FieldRenderer({
  field,
  values,
  error,
  onChange,
  onBlur,
  onFileSelect,
  onFileRemove,
  scenarioPrefill = true,
}: FieldRendererProps) {
  const id = fieldDomId(field);
  const value = getFieldValue(values, field);
  const helperText = getHelperText(field, values);
  const disabled = isFieldDisabled(field, values);
  const common = {
    id,
    name: field.key,
    disabled,
    required: field.required,
    invalid: Boolean(error),
    'aria-describedby': error || helperText ? `${id}-message` : undefined,
    onBlur: () => onBlur?.(field),
  };
  const change = (raw: string) => onChange(field, field.uppercase ? raw.toUpperCase() : raw);

  // One upload slot per DocType; the parent keeps the file's details in the record
  if (field.type === 'attachment') {
    const doc = values.documents.find((d) => d.docType === field.docType);
    return (
      <FileUploadRow
        id={id}
        label={field.label}
        required={field.required}
        disabled={disabled}
        error={error}
        file={
          doc && {
            name: doc.fileName,
            sizeBytes: doc.sizeBytes,
            mimeType: doc.mimeType,
            previewUrl: doc.previewUrl,
          }
        }
        onSelect={(file) => onFileSelect?.(field, file)}
        onRemove={() => onFileRemove?.(field)}
      />
    );
  }

  // The checkbox carries its own label next to the box
  if (field.type === 'checkbox') {
    return (
      <div className="flex flex-col gap-1.5">
        <Checkbox
          id={id}
          name={field.key}
          label={field.label}
          checked={values[field.key] === true}
          disabled={disabled}
          required={field.required}
          invalid={Boolean(error)}
          aria-describedby={common['aria-describedby']}
          onCheckedChange={(on) => {
            onChange(field, String(on));
            onBlur?.(field); // a tick is a decision: show its error straight away
          }}
        />
        <div className="pl-[30px]">
          <FieldMessage id={id} helperText={helperText} error={error} />
        </div>
      </div>
    );
  }

  // The toggle carries its own label next to the switch
  if (field.type === 'toggle') {
    return (
      <div className="flex flex-col gap-1.5">
        <Toggle
          id={id}
          name={field.key}
          label={field.label}
          checked={values[field.key] === true}
          disabled={disabled}
          aria-describedby={common['aria-describedby']}
          onCheckedChange={(on) => onChange(field, String(on))}
        />
        <FieldMessage id={id} helperText={helperText} error={error} />
      </div>
    );
  }

  let control: ReactNode = null;
  if (field.mask === 'aadhaar') {
    control = (
      <AadhaarField {...common} value={value} onCommit={change} scenarioPrefill={scenarioPrefill} />
    );
  } else {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        control = (
          <TextInput
            {...common}
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
            inputMode={field.type === 'phone' ? 'numeric' : undefined}
            autoComplete="off"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => change(e.target.value)}
          />
        );
        break;
      case 'number': {
        const raw = values[field.key];
        control = (
          <NumberInput
            {...common}
            autoComplete="off"
            placeholder={field.placeholder}
            value={typeof raw === 'number' ? raw : null}
            onValueChange={(n) => change(n === null ? '' : String(n))}
          />
        );
        break;
      }
      case 'date':
        control = <DatePicker {...common} value={value} onValueChange={change} />;
        break;
      case 'multiLine':
        control = (
          <TextArea
            {...common}
            autoComplete="off"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => change(e.target.value)}
          />
        );
        break;
      case 'dropdown':
        control = (
          <Select
            {...common}
            autoComplete="off"
            options={field.options ?? []}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => change(e.target.value)}
          />
        );
        break;
    }
  }

  return (
    <FormField
      htmlFor={id}
      label={field.label}
      required={field.required}
      helperText={helperText}
      error={error}
    >
      {control}
    </FormField>
  );
}
