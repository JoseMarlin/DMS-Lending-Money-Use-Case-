import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * The dialogs that are open, the last one on top. Only the one on top answers the keys: a Modal that
 * opens over the record sheet (a question, the reason for a change) takes Tab and Escape, and the
 * sheet under it waits.
 */
const OPEN: object[] = [];

// what Tab can reach: a control taken out of the tab order (the icons of a rail, of which one is
// reachable at a time) is not a stop, so it cannot be taken for the last one
const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]',
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(', ');

/**
 * The keyboard behaviour of a dialog (the Modal and the record sheet): the cursor goes in when it
 * opens, Tab and Shift+Tab go round inside it, Escape closes it, and the cursor goes back to where
 * it was when it closes.
 *
 * `initialFocus`: 'firstField' puts the cursor on the first text box, or on the panel when there is
 * none (a dialog with a form); 'panel' always puts it on the panel, so that a screen reader reads the
 * dialog's name first and nothing is typed into a search box by accident.
 *
 * The panel needs tabIndex={-1} so that it can take the cursor.
 */
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocus: 'firstField' | 'panel' = 'firstField',
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      initialFocus === 'firstField'
        ? panel?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled)')
        : null;
    (first ?? panel)?.focus();

    const me = {};
    OPEN.push(me);

    const onKeyDown = (event: KeyboardEvent) => {
      if (OPEN[OPEN.length - 1] !== me) return; // a dialog over this one has the keys
      if (event.key === 'Escape') {
        // a dropdown or a tip over the dialog has taken the key already (capture phase, it stopped it)
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      // in page order (a browser gives that already; sorting keeps it right everywhere)
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        // a dropdown of the top bar over the sheet keeps its own Tab; anywhere else the cursor is brought back
        if (active instanceof Element && active.closest('[data-popover-panel]')) return;
        event.preventDefault();
        (event.shiftKey ? lastItem : firstItem).focus();
      } else if (event.shiftKey && (active === firstItem || active === panel)) {
        // the panel itself (where the cursor starts when there is no field) counts as the first stop
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      OPEN.splice(OPEN.indexOf(me), 1);
      previous?.focus?.();
    };
  }, [open, panelRef, initialFocus]);
}
