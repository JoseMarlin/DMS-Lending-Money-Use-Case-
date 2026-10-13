import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface FormCardProps {
  title: string;
  /** Fixed strip under the title bar, for example the step indicator */
  subHeader?: ReactNode;
  /** Scrollable body */
  children: ReactNode;
  /** Sticky footer, usually one or two Buttons */
  footer?: ReactNode;
  /** When this changes the body scrolls back to the top (for example the step number) */
  scrollResetKey?: string | number;
}

/** White card: title bar, optional fixed sub header, scrolling body, sticky footer. */
export default function FormCard({
  title,
  subHeader,
  children,
  footer,
  scrollResetKey,
}: FormCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [scrollResetKey]);

  return (
    <section className="flex max-h-[calc(100vh-var(--spacing-header)-40px-24px)] w-card max-w-full flex-col overflow-hidden rounded-card bg-card shadow-card">
      <div className="flex h-title-bar shrink-0 items-center border-b border-line px-6">
        <h1 className="text-heading-s text-label">{title}</h1>
      </div>
      {subHeader ? <div className="shrink-0 border-b border-line">{subHeader}</div> : null}
      {/* relative: absolutely placed content (hidden file inputs) stays inside this scroller */}
      <div ref={bodyRef} className="thin-scrollbar relative min-h-0 flex-1 overflow-y-auto p-6">
        {children}
      </div>
      {footer ? (
        <footer className="flex h-footer shrink-0 items-center justify-between gap-3 border-t border-line bg-card px-6">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
