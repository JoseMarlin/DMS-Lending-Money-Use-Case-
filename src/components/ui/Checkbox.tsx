import type { ReactNode } from 'react';

export interface CheckboxProps {
  id: string;
  name?: string;
  /** Text next to the box. May be a full sentence. */
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
}

/**
 * Checkbox with its label. Not in the Figma form file: designed from the same tokens (primary when
 * checked, field border and 4px radius otherwise), so it is provisional like the Stepper.
 */
export default function Checkbox({
  id,
  name,
  label,
  checked,
  onCheckedChange,
  disabled,
  required,
  invalid,
  'aria-describedby': describedBy,
}: CheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => !disabled && onCheckedChange(e.target.checked)}
          className={`peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[4px] border bg-white transition-colors checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${
            invalid ? 'border-error' : 'border-field-border'
          }`}
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12 5 5 9-10" />
        </svg>
      </span>
      <label
        htmlFor={id}
        className={`text-body-m text-ink ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {label}
        {required ? (
          <span aria-hidden className="text-error-text">
            {' '}
            *
          </span>
        ) : null}
      </label>
    </div>
  );
}
