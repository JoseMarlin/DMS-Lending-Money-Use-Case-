import { GridIcon, ListIcon } from '@/components/ui/icons';
import type { FilesView } from './filesPageModel';

const OPTIONS: { id: FilesView; label: string; Icon: typeof ListIcon }[] = [
  { id: 'list', label: 'List view', Icon: ListIcon },
  { id: 'grid', label: 'Grid view', Icon: GridIcon },
];

/** The list/grid switch beside the search box: two icon buttons, the one in use filled blue-grey. */
export default function ViewToggle({
  value,
  onChange,
}: {
  value: FilesView;
  onChange: (value: FilesView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex h-[38px] shrink-0 overflow-hidden rounded-field border border-field-border bg-white"
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={on}
            onClick={() => onChange(id)}
            className={`flex w-[35px] items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
              on
                ? 'bg-view-toggle-on text-view-toggle-ink forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]'
                : 'text-label hover:bg-field-disabled'
            }`}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
