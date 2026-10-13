import type { ReactNode, SVGProps } from 'react';

/**
 * Icons of the app shell, drawn on a 24px grid in the style of the Figma frame: filled where the
 * design fills them (dashboard, folder, star, settings, bell), outlined otherwise. They take their
 * colour from the text colour around them and are hidden from screen readers: the button or link
 * that holds an icon always has a name of its own.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Size in pixels, 20 by default */
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

export function DashboardIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="6" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
    </Svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6c.6 0 1.2.25 1.6.7L12 6h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z" />
    </Svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="m12 2.5 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5Z" />
    </Svg>
  );
}

export function FileSearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M14 3l5 5v2" />
      <path d="M14 3v5h5" />
      <circle cx="16.5" cy="16.5" r="3" />
      <path d="m18.7 18.7 2.3 2.3" />
    </Svg>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </Svg>
  );
}

export function WorkflowIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="8.5" y="2.5" width="7" height="6" rx="1.5" />
      <rect x="2.5" y="15.5" width="7" height="6" rx="1.5" />
      <rect x="14.5" y="15.5" width="7" height="6" rx="1.5" />
      <path
        d="M12 8.5v3.5M6 15.5V12h12v3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ReportsIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="3.5" y="12" width="4.5" height="8.5" rx="1" />
      <rect x="9.75" y="4" width="4.5" height="16.5" rx="1" />
      <rect x="16" y="8.5" width="4.5" height="12" rx="1" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none" fillRule="evenodd">
      <path d="M10.4 2.5a1.5 1.5 0 0 0-1.46 1.15l-.3 1.2a7.6 7.6 0 0 0-1.43.83l-1.2-.36a1.5 1.5 0 0 0-1.74.7l-1.6 2.78a1.5 1.5 0 0 0 .3 1.86l.93.86a7.5 7.5 0 0 0 0 1.66l-.93.86a1.5 1.5 0 0 0-.3 1.86l1.6 2.78a1.5 1.5 0 0 0 1.74.7l1.2-.36c.44.33.92.6 1.43.83l.3 1.2a1.5 1.5 0 0 0 1.46 1.15h3.2a1.5 1.5 0 0 0 1.46-1.15l.3-1.2c.5-.23.99-.5 1.43-.83l1.2.36a1.5 1.5 0 0 0 1.74-.7l1.6-2.78a1.5 1.5 0 0 0-.3-1.86l-.93-.86a7.5 7.5 0 0 0 0-1.66l.93-.86a1.5 1.5 0 0 0 .3-1.86l-1.6-2.78a1.5 1.5 0 0 0-1.74-.7l-1.2.36a7.6 7.6 0 0 0-1.43-.83l-.3-1.2A1.5 1.5 0 0 0 13.6 2.5h-3.2ZM12 15.25a3.25 3.25 0 1 1 0-6.5 3.25 3.25 0 0 1 0 6.5Z" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none" fillRule="evenodd">
      <path d="M9 3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V5h4.25a.75.75 0 0 1 0 1.5H18.5V19a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V6.5h-.75a.75.75 0 0 1 0-1.5H9V3.5ZM10.5 5h3V3.5h-3V5Zm-.75 5.25a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6a.75.75 0 0 0-.75-.75Zm4.5 0a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6a.75.75 0 0 0-.75-.75Z" />
    </Svg>
  );
}

/** Panel with the sidebar at the left and an arrow: collapse (arrow left) or expand (arrow right). */
export function SidebarToggleIcon({ expand, ...props }: IconProps & { expand?: boolean }) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
      <path d={expand ? 'm14 9.5 2.5 2.5-2.5 2.5' : 'm16.5 9.5-2.5 2.5 2.5 2.5'} />
    </Svg>
  );
}

/** Three by three small squares: the DMS+ app launcher. */
export function AppGridIcon(props: IconProps) {
  const at = [2, 8.8, 15.6];
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      {at.flatMap((y) =>
        at.map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="6.4" height="6.4" rx="1.4" />),
      )}
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

/** Four-pointed spark with a small one beside it: the QAI assistant. */
export function SparkleIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M10 3.5c.3 3.9 1.6 5.8 6 6.5-4.4.7-5.7 2.6-6 6.5-.3-3.9-1.6-5.8-6-6.5 4.4-.7 5.7-2.6 6-6.5Z" />
      <path d="M18.5 14c.15 1.9.8 2.85 3 3.2-2.2.35-2.85 1.3-3 3.2-.15-1.9-.8-2.85-3-3.2 2.2-.35 2.85-1.3 3-3.2Z" />
    </Svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 3.9" />
      <path d="M12 17.2h.01" strokeWidth="2.4" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 3.1-.7 4.9-1.6 6.1-.7.9-.1 2.4 1.1 2.4h14c1.2 0 1.8-1.5 1.1-2.4-.9-1.2-1.6-3-1.6-6.1A6.5 6.5 0 0 0 12 2.5Z" />
      <path d="M9.6 19.5a2.4 2.4 0 0 0 4.8 0H9.6Z" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.6">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4v4.8h4.8" />
    </Svg>
  );
}
