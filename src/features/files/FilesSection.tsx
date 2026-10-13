import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';

/**
 * A section of the Files & Folders screen with a heading that opens and closes it ("Folders ⌄"), a
 * hairline that runs to the right, and room at the right end for a control (the zoom of the files).
 */
export default function FilesSection({
  title,
  actions,
  children,
}: {
  title: string;
  /** Drawn at the right end of the heading, kept while the section is closed */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const panelId = useId();
  return (
    <section aria-label={title}>
      <div className="flex items-center gap-3">
        <h2 className="text-[14px] leading-5 font-semibold text-subtle">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-1.5 rounded py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {title}
            <ChevronDownIcon
              size={14}
              className={`transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
            />
          </button>
        </h2>
        <div aria-hidden className="h-px flex-1 bg-line" />
        {actions}
      </div>
      <div id={panelId} hidden={!open} className="mt-3.5">
        {children}
      </div>
    </section>
  );
}
