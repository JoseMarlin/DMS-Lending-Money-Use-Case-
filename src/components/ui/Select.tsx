import type { SelectHTMLAttributes } from 'react';
import { CONTROL_BASE, controlBorder } from './fieldStyles';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly string[];
  /** Text of the empty first option */
  placeholder?: string;
  invalid?: boolean;
}

/** Native dropdown with a right chevron. */
export default function Select({
  options,
  placeholder = 'Select',
  invalid,
  className = '',
  value,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        value={value}
        className={`h-10 appearance-none pr-9 ${CONTROL_BASE} ${controlBorder(invalid)} ${
          value === '' ? 'text-subtle' : ''
        } ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
