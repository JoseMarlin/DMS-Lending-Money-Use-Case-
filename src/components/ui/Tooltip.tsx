import { useEffect, useId, useState, type ReactNode } from 'react';

interface TooltipProps {
  /** What the tip says. With no text there is no tip (and nothing is drawn). */
  text: string | null;
  /** The control the tip belongs to; it gets `aria-describedby` so screen readers read the tip too */
  children: (describedBy: string | undefined) => ReactNode;
  /** Which edge of the control the tip lines up with */
  align?: 'start' | 'end';
  className?: string;
}

/**
 * A small dark tip under a control, shown while the pointer is over it or the control has the
 * keyboard focus. Escape hides it without moving the pointer or the focus, and the pointer can move
 * onto the tip without it going away (WCAG 1.4.13). It does not take part in the tab order. Not in
 * the Figma files, so it is provisional.
 */
export default function Tooltip({ text, children, align = 'end', className = '' }: TooltipProps) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shown = Boolean(text) && (hovered || focused) && !dismissed;

  // Escape works wherever the focus is, as long as the tip is showing
  useEffect(() => {
    if (!shown) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // the tip goes first: a dialog under it does not close with the same key
        event.stopPropagation();
        setDismissed(true);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [shown]);

  return (
    <span
      className={`relative inline-flex ${className}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        if (!focused) setDismissed(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!hovered) setDismissed(false);
      }}
    >
      {children(text ? id : undefined)}
      {text ? (
        // the padding (not a margin) is the gap to the control, so the pointer can cross it
        <span
          id={id}
          role="tooltip"
          className={`absolute top-full z-30 pt-2 ${align === 'end' ? 'right-0' : 'left-0'} ${
            shown ? 'block' : 'hidden'
          }`}
        >
          <span className="block w-max max-w-[260px] rounded-field bg-header px-3 py-2 text-left text-[12px] leading-4 font-medium text-white shadow-card">
            {text}
          </span>
        </span>
      ) : null}
    </span>
  );
}
