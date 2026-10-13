import { usePopover } from '@/components/ui';
import { KebabIcon } from '@/components/ui/icons';

export interface FileMenuItem {
  label: string;
  onSelect: () => void;
}

/**
 * The kebab at the end of a file's row: a small menu of what can be done with the file (Preview,
 * and on the Files & Folders screen Favourite). `fileName` names it for screen readers.
 */
export default function FileRowMenu({
  fileName,
  items,
  triggerId,
}: {
  fileName: string;
  items: FileMenuItem[];
  /** An id for the kebab, so that the cursor can be put on it */
  triggerId?: string;
}) {
  const { open, toggle, close, rootRef, triggerRef, panelRef } = usePopover();
  return (
    <div ref={rootRef} className="relative flex justify-center">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-label={`More actions for ${fileName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-full text-label hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <KebabIcon size={18} />
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`Actions for ${fileName}`}
          onKeyDown={(event) => {
            // Up and Down move between the items (and round the ends), Home and End go to the first and last
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]'),
            );
            const at = items.indexOf(document.activeElement as HTMLElement);
            const target = {
              ArrowDown: (at + 1) % items.length,
              ArrowUp: (at - 1 + items.length) % items.length,
              Home: 0,
              End: items.length - 1,
            }[event.key];
            if (target === undefined || items.length === 0) return;
            event.preventDefault();
            items[target].focus();
          }}
          className="absolute top-full right-0 z-20 mt-1 w-44 overflow-hidden rounded-card border border-line bg-white py-1 text-left shadow-card"
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-autofocus={index === 0 ? true : undefined}
              onClick={() => {
                // the cursor goes back to the kebab first, so that a dialog gives it back there
                close();
                item.onSelect();
              }}
              className="flex h-9 w-full items-center px-3 text-body-m text-ink hover:bg-primary-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
