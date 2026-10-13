import { useRef, useState } from 'react';
import { displayToIso, formatDateInput, isoToDisplay } from '@/lib/format';
import TextInput from './TextInput';

export interface DatePickerProps {
  id?: string;
  name?: string;
  /** ISO date, 'YYYY-MM-DD', or '' */
  value: string;
  /** Called with an ISO date, or '' while the typed date is incomplete or not a real date */
  onValueChange: (iso: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  onBlur?: () => void;
  'aria-describedby'?: string;
}

/**
 * Date field shown as DD/MM/YYYY. Type the date (slashes are added) or use the calendar icon,
 * which opens the browser's own date picker.
 */
export default function DatePicker({
  value,
  onValueChange,
  disabled,
  invalid,
  placeholder = 'DD/MM/YYYY',
  ...props
}: DatePickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => isoToDisplay(value));
  const [previousValue, setPreviousValue] = useState(value);

  // The value was changed from outside (scenario fill, reset, calendar): show it
  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== displayToIso(text)) setText(isoToDisplay(value));
  }

  const handleType = (raw: string) => {
    const next = formatDateInput(raw);
    setText(next);
    const iso = displayToIso(next);
    if (iso !== value) onValueChange(iso);
  };

  return (
    <div className="relative">
      <TextInput
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
        className="pr-10"
        value={text}
        onChange={(e) => handleType(e.target.value)}
      />
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        autoComplete="off"
        id={props.id ? `${props.id}-calendar` : undefined}
        name={props.name ? `${props.name}-calendar` : undefined}
        disabled={disabled}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
      <button
        type="button"
        aria-label="Open calendar"
        disabled={disabled}
        onClick={() => nativeRef.current?.showPicker?.()}
        className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted"
      >
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
    </div>
  );
}
