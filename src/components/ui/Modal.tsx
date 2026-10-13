import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';

export interface ModalProps {
  open: boolean;
  title: string;
  /** Called for the close button, the Escape key and a click on the backdrop */
  onClose: () => void;
  children: ReactNode;
  /** Buttons at the bottom */
  footer?: ReactNode;
  /**
   * default: the plain dialog (420px). panel: the look of the Take Action panel of the Workflow
   * design: 494px, a 48px header with a 16px semibold title, 20px sides, a 60px footer.
   */
  variant?: 'default' | 'panel';
}

const LOOKS = {
  default: {
    panel: 'max-w-[420px]',
    header: 'px-6 py-4',
    title: 'text-heading-s text-label',
    body: 'px-6 py-5',
    footer: 'justify-end px-6 py-4',
    close: 'text-muted',
    closeSize: 16,
  },
  panel: {
    panel: 'max-w-[494px]',
    header: 'h-12 pr-3 pl-5',
    title: 'text-[16px] leading-6 font-semibold text-ink',
    body: 'px-5 py-4',
    footer: 'h-[60px] items-center justify-end bg-panel-footer px-4',
    close: 'text-label',
    closeSize: 20,
  },
} as const;

/**
 * Dialog over a dimmed page. Not in the Figma form file: built from the same tokens, so it is
 * provisional. Keeps the keyboard inside it, closes on Escape, and gives focus back when it closes.
 */
export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  variant = 'default',
}: ModalProps) {
  const look = LOOKS[variant];
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef, onClose);

  if (!open) return null;

  return createPortal(
    // the whole thing scrolls when the window is shorter than the dialog (a small screen, a zoomed page)
    <div className="fixed inset-0 z-[10000] overflow-y-auto">
      <div className="relative flex min-h-full items-start justify-center p-4 pt-[14vh]">
        <div aria-hidden className="absolute inset-0 bg-header/60" onClick={() => onClose()} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`relative w-full rounded-card bg-card shadow-card outline-none ${look.panel}`}
        >
          <div
            className={`flex items-center justify-between gap-3 border-b border-line ${look.header}`}
          >
            <h2 id={titleId} className={`min-w-0 [overflow-wrap:anywhere] ${look.title}`}>
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onClose()}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-field hover:bg-field-disabled ${look.close} focus-visible:outline-2 focus-visible:outline-primary`}
            >
              <svg
                aria-hidden
                width={look.closeSize}
                height={look.closeSize}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className={look.body}>{children}</div>
          {footer ? (
            <div className={`flex gap-2 border-t border-line ${look.footer}`}>{footer}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
