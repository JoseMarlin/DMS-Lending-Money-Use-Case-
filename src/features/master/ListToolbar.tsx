import { Button } from '@/components/ui';
import { ExportIcon } from '@/components/ui/icons';
import SearchInput from '@/components/ui/SearchInput';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

/** "Search Record": filters the table as you type. 32px high, as in the design. */
export function SearchBox({ value, onChange }: SearchBoxProps) {
  return <SearchInput value={value} onChange={onChange} label="Search Record" />;
}

interface ExportButtonProps {
  /** Rows that would be written. With none the button is off. */
  count: number;
  onExport: () => void;
}

export function ExportButton({ count, onExport }: ExportButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={count === 0}
      title={count === 0 ? 'There are no rows to export' : undefined}
      onClick={onExport}
    >
      <ExportIcon size={16} />
      Export
    </Button>
  );
}
