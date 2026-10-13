import { useCallback, useEffect, useRef, useState } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Open and close logic for a small dropdown that hangs from a button (the user menu, the bell).
 *
 * - It opens when the button is pressed and puts the cursor on the first thing inside.
 * - Escape, a click anywhere else, or tabbing out closes it. Escape and choosing something put the
 *   cursor back on the button, so a keyboard user does not lose their place.
 * - Opening one closes the other, because pressing the other button counts as "anywhere else".
 *
 * Put `rootRef` on the element that holds both the button and the panel.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    // the cursor goes into the panel: to the item marked as the first stop, else the first control
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const root = rootRef.current;
    const onPointerDown = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    // Escape is taken in the capture phase, ahead of a dialog under the dropdown (the record sheet):
    // the first Escape closes the dropdown, the second the sheet
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    // the dialog's keyboard trap leaves the keys alone while the cursor is in this panel
    panel?.setAttribute('data-popover-panel', '');
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  return { open, toggle, close, rootRef, triggerRef, panelRef };
}
