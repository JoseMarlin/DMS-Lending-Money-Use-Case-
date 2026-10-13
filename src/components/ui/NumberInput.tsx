import { useLayoutEffect, useRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { formatIndianNumber, parseNumberInput } from '@/lib/format';
import TextInput from './TextInput';

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  invalid?: boolean;
}

/** Whole-number field shown with Indian digit grouping (18,00,000). Keeps the caret in place. */
export default function NumberInput({ value, onValueChange, invalid, ...props }: NumberInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const digitsBeforeCaret = useRef<number | null>(null);
  const display = formatIndianNumber(value);

  // Re-grouping changes the text length, so put the caret back after the same number of digits
  useLayoutEffect(() => {
    const input = ref.current;
    const count = digitsBeforeCaret.current;
    digitsBeforeCaret.current = null;
    if (!input || count === null || document.activeElement !== input) return;
    let position = 0;
    let seen = 0;
    while (position < display.length && seen < count) {
      if (/\d/.test(display[position])) seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  });

  return (
    <TextInput
      ref={ref}
      type="text"
      inputMode="numeric"
      invalid={invalid}
      value={display}
      onChange={(e) => {
        const text = e.target.value;
        const caret = e.target.selectionStart ?? text.length;
        digitsBeforeCaret.current = text.slice(0, caret).replace(/\D/g, '').length;
        onValueChange(parseNumberInput(text));
      }}
      {...props}
    />
  );
}
