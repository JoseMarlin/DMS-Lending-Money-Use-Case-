import { useLayoutEffect, useRef, useState } from 'react';
import { TextInput } from '@/components/ui';
import { aadhaarDigits, formatAadhaarInput, maskAadhaar, maskForRecord } from '@/data/aadhaar';
import { SCENARIOS } from '@/data/seed';
import { useAppStore } from '@/data/store';

interface AadhaarInputProps {
  id: string;
  name: string;
  /** What the record holds: always masked, 'XXXX XXXX 4821', or '' */
  value: string;
  /** Dummy number of the active scenario, to fill the input with (see AadhaarField) */
  prefill: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
  /** Called with the masked value when the user leaves the field */
  onCommit: (masked: string) => void;
  /** Called when the user leaves the field, after the value was committed */
  onBlur?: () => void;
}

/**
 * Aadhaar rule: the full number is kept only in this component's state. While the field has focus
 * it shows the number in groups of four; when focus leaves it shows XXXX XXXX 4821 and only that
 * masked value is passed on to the store.
 */
function AadhaarInput({ value, prefill, onCommit, onBlur, ...props }: AadhaarInputProps) {
  const [entered, setEntered] = useState(aadhaarDigits(prefill));
  const [focused, setFocused] = useState(false);
  const [changed, setChanged] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const digitsBeforeCaret = useRef<number | null>(null);

  // Away from the field, show what the record holds: XXXX XXXX 4821, or XXXX XXXX XXXX if the
  // number was not a valid Aadhaar
  const shown = focused ? formatAadhaarInput(entered) : value;
  // After a reload the number is gone from memory; show what the record holds as a hint
  const placeholder = focused && !entered && value ? value : '0000 0000 0000';

  // The spaces are put in again after every key, which would send the caret to the end: put it
  // back after the same number of digits
  useLayoutEffect(() => {
    const input = ref.current;
    const count = digitsBeforeCaret.current;
    digitsBeforeCaret.current = null;
    if (!input || count === null || document.activeElement !== input) return;
    let position = 0;
    let seen = 0;
    while (position < shown.length && seen < count) {
      if (/\d/.test(shown[position])) seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  });

  return (
    <TextInput
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={shown}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const text = e.target.value;
        const caret = e.target.selectionStart ?? text.length;
        digitsBeforeCaret.current = text.slice(0, caret).replace(/\D/g, '').length;
        setEntered(aadhaarDigits(text));
        setChanged(true);
      }}
      onBlur={() => {
        setFocused(false);
        if (changed) {
          onCommit(maskForRecord(entered));
          setChanged(false);
        }
        onBlur?.();
      }}
    />
  );
}

type AadhaarFieldProps = Omit<AadhaarInputProps, 'prefill'> & {
  /** False where the number of the active scenario must never be put in the input (the record sheet) */
  scenarioPrefill?: boolean;
};

/**
 * Wraps AadhaarInput for the schema renderer. When the whole draft is replaced (scenario fill, new
 * draft, reset) the input starts over, and for a filled scenario it gets that scenario's dummy
 * number, so the presenter can show the real value while the field has focus.
 */
export default function AadhaarField({ scenarioPrefill = true, ...props }: AadhaarFieldProps) {
  const draftResetCount = useAppStore((s) => s.draftResetCount);
  const activeScenario = useAppStore((s) => s.activeScenario);

  const scenarioNumber = activeScenario ? SCENARIOS[activeScenario].aadhaarInput : '';
  // Only use it if it still matches what the record holds (the user may have typed another number)
  const prefill =
    scenarioPrefill && maskAadhaar(scenarioNumber) === props.value ? scenarioNumber : '';

  return <AadhaarInput key={draftResetCount} prefill={prefill} {...props} />;
}
