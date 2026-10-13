import type { ReactNode } from 'react';

/** Provisional logo mark. Swap for the real DMS+ asset from Figma. */
function DmsLogo() {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M3 6a2 2 0 0 1 2-2h4.2a2 2 0 0 1 1.5.7L12 6h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
        </svg>
      </span>
      <span className="leading-none text-white">
        <span className="block text-[8px] tracking-wide text-white/70">dMACQ</span>
        <span className="block text-base font-bold">DMS+</span>
      </span>
    </div>
  );
}

interface AppHeaderProps {
  /** Right-hand content, for example a button or the signed-in user */
  right?: ReactNode;
}

export default function AppHeader({ right }: AppHeaderProps) {
  return (
    <header className="flex h-header items-center justify-between bg-header px-4">
      <DmsLogo />
      {right ? <div className="flex items-center gap-3">{right}</div> : null}
    </header>
  );
}
