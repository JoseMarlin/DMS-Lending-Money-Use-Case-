import { useId } from 'react';
import type { ReactNode } from 'react';

export interface AccordionProps {
  /** id of the heading, so the section can be found and labelled */
  id?: string;
  title: ReactNode;
  /** At the right of the title, for example "3 of 5 required" */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Level of the heading the button sits in (2 for a section of a form, 3 inside a review) */
  headingLevel?: 2 | 3;
  /** The panel stays in the page while closed (hidden), so what it holds keeps its state */
  children: ReactNode;
  panelClassName?: string;
}

/**
 * A collapsible block. The button is the heading, so it works from the keyboard and tells screen
 * readers whether it is open. Not in the Figma form file: built from the same tokens, so it is
 * provisional.
 */
export default function Accordion({
  id,
  title,
  summary,
  open,
  onToggle,
  headingLevel = 3,
  children,
  panelClassName = 'px-4 py-3',
}: AccordionProps) {
  const generated = useId();
  const headingId = id ?? generated;
  const panelId = `${headingId}-panel`;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section aria-labelledby={headingId} className="rounded-field border border-line">
      <Heading id={headingId}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        >
          <span className="text-link-s text-label">{title}</span>
          <span className="flex items-center gap-2 text-xs text-subtle">
            {summary}
            <svg
              aria-hidden
              className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </Heading>
      <div id={panelId} hidden={!open} className={`border-t border-line ${panelClassName}`}>
        {children}
      </div>
    </section>
  );
}
