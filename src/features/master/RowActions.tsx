import { Link, useSearchParams } from 'react-router-dom';
import { usePopover } from '@/components/ui/usePopover';
import { ChevronRightIcon, KebabIcon } from '@/components/ui/icons';
import { recordSheetPath } from './paths';

interface RowActionsProps {
  applicationId: string;
  /** Who the row is about, so that each link and menu has its own name for a screen reader */
  name: string;
}

/**
 * The Action cell: a "View" link with a chevron, and a kebab menu. The menu has only View for now
 * (the brief), so it is a small dropdown, not a full menu widget.
 */
export default function RowActions({ applicationId, name }: RowActionsProps) {
  const { open, toggle, close, rootRef, triggerRef, panelRef } = usePopover();
  const who = name || applicationId;
  const [params] = useSearchParams();
  const to = recordSheetPath(applicationId, params);

  return (
    <div className="flex items-center justify-between">
      <Link
        to={to}
        aria-label={`View ${who}`}
        className="inline-flex items-center gap-1 rounded text-button-s text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        View
        <ChevronRightIcon size={14} />
      </Link>

      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`More actions for ${who}`}
          aria-expanded={open}
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-full text-subtle hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <KebabIcon size={18} />
        </button>
        {open ? (
          <div
            ref={panelRef}
            className="absolute top-full right-0 z-20 mt-1 w-36 overflow-hidden rounded-card border border-line bg-white py-1 shadow-card"
          >
            <Link
              to={to}
              onClick={() => close()}
              data-autofocus
              className="flex h-9 items-center px-3 text-body-m text-ink hover:bg-primary-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              View
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
