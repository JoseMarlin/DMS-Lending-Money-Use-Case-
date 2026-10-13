import type { ReactNode, SVGProps } from 'react';

/**
 * Small icons for the base components (toast, table, buttons). Like the shell icons they are drawn
 * on a 24px grid, take the text colour and are hidden from screen readers: the control that holds
 * one always has its own name.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function Svg({ size = 20, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** Arrow up out of a tray: Export. */
export function ExportIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.4">
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function KebabIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.2">
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.3a1 1 0 0 0-1.4-1.4l-4.8 4.8-1.8-1.8a1 1 0 0 0-1.4 1.4l2.5 2.5a1 1 0 0 0 1.4 0l5.5-5.5Z"
      />
    </Svg>
  );
}

/** Two small triangles, up and down. The one in use is drawn dark, the other pale. */
export function SortIcon({ active, ...props }: IconProps & { active: 'asc' | 'desc' | null }) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="m12 4 5.5 6.5h-11L12 4Z" opacity={active === 'asc' ? 1 : 0.3} />
      <path d="m12 20-5.5-6.5h11L12 20Z" opacity={active === 'desc' ? 1 : 0.3} />
    </Svg>
  );
}

/** A tray with nothing in it: empty lists. */
export function EmptyTrayIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="1.6">
      <path d="M3 13l2.6-7.2A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L21 13" />
      <path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5.5a1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 14.5 1.5 1.5 0 0 0 7.5 13H3Z" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.6-4.6" />
    </Svg>
  );
}

/** A funnel: Filter. */
export function FilterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 5h17l-6.5 7.6V19l-4 1.5v-7.9L3.5 5Z" />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </Svg>
  );
}

/** Arrow pointing left: back. */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.2">
      <path d="M21 12H3M10 5l-7 7 7 7" />
    </Svg>
  );
}

/** A padlock: a field that cannot be changed. */
export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

/** A pencil: Edit. */
export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 7.5 3 3" />
    </Svg>
  );
}

/** A bulleted list: the Progress panel of the review screen. */
export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6h13.5M8 12h13.5M8 18h13.5" />
      <circle cx="3" cy="6" r="1.1" fill="currentColor" />
      <circle cx="3" cy="12" r="1.1" fill="currentColor" />
      <circle cx="3" cy="18" r="1.1" fill="currentColor" />
    </Svg>
  );
}

/** A small arrow pointing down: a section that is open, or a button that has a menu. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.4">
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.4">
      <path d="M5 12h14" />
    </Svg>
  );
}

/** Four squares: the grid view. */
export function GridIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </Svg>
  );
}

/** The outline of a star: not a favourite (the filled star is StarIcon in the shell icons). */
export function StarOutlineIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="1.8">
      <path d="m12 3.4 2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.7l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85L12 3.4Z" />
    </Svg>
  );
}

/** A speech bubble with three dots: Comments. */
export function CommentsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h0A1.5 1.5 0 0 1 4 15.5v-10Z" />
      <circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** A list with ticks: the KYC checks. */
export function ChecklistIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 6 1.6 1.6L8 4.6" />
      <path d="m3.5 12.5 1.6 1.6L8 11" />
      <path d="m3.5 19 1.6 1.6L8 17.5" />
      <path d="M12 6h8.5M12 12.5h8.5M12 19h8.5" />
    </Svg>
  );
}

/** A paperclip: files and attachments. */
export function PaperclipIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m20.2 11.2-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9" />
    </Svg>
  );
}

/** A clock with an arrow running back: the audit log (the history). */
export function HistoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" />
      <path d="M3.5 3.8v4.7h4.7" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

/** A paper plane: send. */
export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z" />
    </Svg>
  );
}

/** A bin: delete. */
export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M10 3.5h4M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}
