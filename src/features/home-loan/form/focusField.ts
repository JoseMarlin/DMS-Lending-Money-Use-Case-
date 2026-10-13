import { fieldDomId, type FieldSchema } from './schema';

/**
 * Brings a field into view and puts the cursor in it. Used for "first error in view" after Next,
 * and when an error is picked in the summary at the top.
 */
export function focusField(field: FieldSchema): void {
  const wrapper = document.getElementById(`wrap-${fieldDomId(field)}`);
  if (!wrapper) return;
  wrapper.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  // The first control a person can use: not the hidden file input of an upload row
  const control = wrapper.querySelector<HTMLElement>(
    'input:not(.sr-only):not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
  );
  control?.focus({ preventScroll: true });
}
