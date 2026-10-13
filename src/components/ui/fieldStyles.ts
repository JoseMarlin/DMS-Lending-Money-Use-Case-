/** Shared look of the text-like controls (TextInput, TextArea, Select). */
export const CONTROL_BASE =
  'w-full rounded-field border bg-white px-3 text-body-m text-ink placeholder:text-muted outline-none transition-colors ' +
  'disabled:cursor-not-allowed disabled:bg-field-disabled disabled:text-muted';

/**
 * Border and focus ring. Each state has its own full set, so an invalid field stays red when it
 * has focus (two competing focus colours on one element is decided by the stylesheet order).
 */
export function controlBorder(invalid?: boolean): string {
  return invalid
    ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
    : 'border-field-border focus:border-primary focus:ring-2 focus:ring-primary/20';
}
