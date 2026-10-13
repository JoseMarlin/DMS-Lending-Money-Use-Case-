import type { ReactNode } from 'react';

interface FieldMessageProps {
  /** id of the control this message belongs to; the message gets `${id}-message` */
  id: string;
  /** Grey text under the control */
  helperText?: string;
  /** Red text under the control. Replaces the helper text. */
  error?: string;
}

/** Helper or error text under a control. Renders nothing when there is no text. */
export function FieldMessage({ id, helperText, error }: FieldMessageProps) {
  const message = error || helperText;
  if (!message) return null;
  return (
    <p
      id={`${id}-message`}
      role={error ? 'alert' : undefined}
      className={`text-xs leading-4 ${error ? 'text-error-text' : 'text-subtle'}`}
    >
      {message}
    </p>
  );
}

interface FormFieldProps extends Omit<FieldMessageProps, 'id'> {
  /** id of the control inside, so the label points at it */
  htmlFor: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}

/** Label (with red asterisk when required), the control, and helper or error text under it. */
export default function FormField({
  htmlFor,
  label,
  required,
  helperText,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-link-s text-label">
        {label}
        {required ? (
          <span aria-hidden className="text-error-text">
            *
          </span>
        ) : null}
      </label>
      {children}
      <FieldMessage id={htmlFor} helperText={helperText} error={error} />
    </div>
  );
}
