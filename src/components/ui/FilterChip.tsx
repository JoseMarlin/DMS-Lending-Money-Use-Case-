interface FilterChipProps {
  label: string;
  /** The live count shown after the label */
  count: number;
  selected: boolean;
  onClick: () => void;
}

/** A pill that filters a list: label and count, light blue when it is the one in use. */
export default function FilterChip({ label, count, selected, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-body-m whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        selected
          ? 'border-primary-200 bg-primary-50 text-tab-active'
          : 'border-line bg-white text-label hover:bg-primary-50'
      }`}
    >
      {label} <span className="font-semibold">{count}</span>
    </button>
  );
}
