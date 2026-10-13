export interface ToggleProps {
  id: string;
  name?: string;
  /** Text next to the switch */
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-describedby'?: string;
}

/**
 * On/off switch, 35 x 20 with a 16px gap to its label, as in the Figma design. On colour is
 * Form+/Primary 2/Primary-600 and the knob is white. The off colour is provisional.
 */
export default function Toggle({
  id,
  name,
  label,
  checked,
  onCheckedChange,
  disabled,
  'aria-describedby': describedBy,
}: ToggleProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        role="switch"
        id={id}
        name={name}
        aria-checked={checked}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`relative h-5 w-[35px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toggle-on disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-toggle-on' : 'bg-toggle-off'
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-[15px]' : 'translate-x-0'
          }`}
        />
      </button>
      <label
        htmlFor={id}
        className={`text-body-m text-ink ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {label}
      </label>
    </div>
  );
}
