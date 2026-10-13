export interface RadioOption<V extends string> {
  value: V;
  label: string;
}

interface RadioGroupProps<V extends string> {
  /** The question the group answers: read out with the group, and drawn above the options */
  legend: string;
  /** Radios with the same name move with the arrow keys, as native radios do */
  name: string;
  /** The chosen value, or '' while nothing is chosen */
  value: V | '';
  onChange: (value: V) => void;
  options: RadioOption<V>[];
  className?: string;
}

/**
 * A group of radio buttons in a row, as in the Take Action panel of the Workflow design: a small
 * semibold legend, then round buttons with a 14px label. They are native radio inputs (so the
 * keyboard and screen readers work as for any radio) drawn with a grey ring, and a blue ring with
 * a dot when chosen.
 */
export default function RadioGroup<V extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  className = '',
}: RadioGroupProps<V>) {
  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="text-[12px] leading-4 font-semibold text-subtle">{legend}</legend>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex cursor-pointer items-center gap-3 py-0.5 pl-1 text-body-m text-ink"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-muted bg-white checked:border-primary checked:bg-primary checked:shadow-[inset_0_0_0_3px_#fff] forced-colors:checked:border-[5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
