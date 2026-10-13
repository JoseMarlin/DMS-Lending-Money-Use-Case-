import { SearchIcon } from './icons';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** What the box is for, read out by screen readers; also the placeholder: "Search Record" */
  label: string;
  /** The grey hint inside the box, when it should say less than the label ("Search") */
  placeholder?: string;
  /** Width classes. A box of the list toolbars is 32px high and about 220 to 388px wide. */
  className?: string;
  /** sm is 32px high (the list toolbars), md is 38px (the Files & Folders screen) */
  size?: 'sm' | 'md';
}

/** A search box that filters as you type: a 32px high bordered box with a magnifier at the left. */
export default function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  className = 'max-w-[388px]',
  size = 'sm',
}: SearchInputProps) {
  return (
    <label className={`relative block w-full min-w-[180px] ${className}`}>
      <span className="sr-only">{label}</span>
      <SearchIcon
        size={16}
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle ${
          size === 'md' ? 'left-4' : 'left-3'
        }`}
      />
      <input
        type="text"
        name="search"
        autoComplete="off"
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${size === 'md' ? 'h-[38px] pl-[42px]' : 'h-8 pl-9'} w-full rounded-field border border-field-border bg-white pr-3 text-body-m text-ink placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      />
    </label>
  );
}
