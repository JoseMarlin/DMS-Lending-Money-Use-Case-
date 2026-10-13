import { useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/data/store';
import BrandMark from './BrandMark';
import { AppGridIcon, SidebarToggleIcon } from './icons';
import { BIN_ITEM, NAV_ITEMS, isNavActive, type NavItem } from './navItems';

const ACTIVE_BG =
  'bg-[linear-gradient(90deg,var(--color-sidebar-active-from),var(--color-sidebar-active-to))]';
const FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white';

interface Tip {
  label: string;
  /** Where the tooltip goes on the screen: beside the sidebar, level with the control */
  top: number;
  left: number;
}

type TipHandlers = {
  onMouseEnter: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
};

function NavRow({
  item,
  collapsed,
  tip,
}: {
  item: NavItem;
  collapsed: boolean;
  tip: (label: string) => TipHandlers;
}) {
  const { pathname } = useLocation();
  const active = isNavActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      {...(collapsed ? tip(item.label) : {})}
      className={`relative flex h-10 items-center gap-3 text-body-m ${FOCUS} ${
        collapsed ? 'justify-center' : 'pr-3 pl-[18px]'
      } ${
        active
          ? // in Windows High Contrast colours are dropped, so the current item also gets a real border
            `${ACTIVE_BG} text-white forced-colors:border-l-4`
          : `${item.dimmed ? 'text-sidebar-ink-dim' : 'text-sidebar-ink'} hover:bg-white/5 hover:text-white`
      }`}
    >
      {/* the blue bar at the left edge of the active item */}
      {active ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-sidebar-indicator" />
      ) : null}
      <Icon className="shrink-0" />
      <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
    </Link>
  );
}

/**
 * The left sidebar of the app shell (Figma node 5904:14434): logo and app launcher at the top, the
 * nine sections, and Bin with the collapse button at the bottom. 240px wide, or a 72px rail of
 * icons when collapsed. The collapsed rail is not in Figma, so it is provisional.
 *
 * A control that is only an icon (the rail's items, the collapse button, the launcher) shows its
 * name in a small tooltip, on hover and also when the keyboard is on it.
 */
export default function Sidebar() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const [tip, setTip] = useState<Tip | null>(null);

  const showTip = (label: string) => ({
    onMouseEnter: (event: MouseEvent<HTMLElement>) => place(event.currentTarget, label),
    onFocus: (event: FocusEvent<HTMLElement>) => place(event.currentTarget, label),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });

  function place(control: HTMLElement, label: string) {
    const box = control.getBoundingClientRect();
    const side = control.closest('aside')?.getBoundingClientRect();
    setTip({ label, top: box.top + box.height / 2, left: (side?.right ?? box.right) + 8 });
  }

  const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      className={`flex h-full shrink-0 flex-col overflow-hidden bg-sidebar transition-[width] duration-200 motion-reduce:transition-none ${
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      }`}
    >
      <div
        className={`flex h-16 shrink-0 items-center ${collapsed ? 'justify-center' : 'justify-between px-4'}`}
      >
        <Link
          to="/dashboard"
          aria-label="DMS+ home"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <BrandMark compact={collapsed} />
        </Link>
        {collapsed ? null : (
          // the app launcher is only drawn: DMS+ has one app in this demo
          <button
            type="button"
            aria-label="DMS+ apps"
            {...showTip('DMS+ apps')}
            className={`flex h-8 w-8 items-center justify-center rounded text-sidebar-grid hover:bg-white/5 ${FOCUS}`}
          >
            <AppGridIcon size={18} />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="thin-scrollbar min-h-0 flex-1 overflow-y-auto pt-2">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavRow item={item} collapsed={collapsed} tip={showTip} />
            </li>
          ))}
        </ul>
      </nav>

      <div
        className={`flex shrink-0 border-t border-sidebar-line ${collapsed ? 'flex-col' : 'items-stretch'}`}
      >
        {/* Bin is a destination like the others, so it is in a navigation landmark of its own */}
        <nav aria-label="Secondary" className="min-w-0 flex-1">
          <ul>
            <li>
              <NavRow item={BIN_ITEM} collapsed={collapsed} tip={showTip} />
            </li>
          </ul>
        </nav>
        <button
          type="button"
          aria-label={collapseLabel}
          {...showTip(collapseLabel)}
          onClick={() => {
            setTip(null);
            toggleSidebar();
          }}
          className={`flex h-10 shrink-0 items-center justify-center text-sidebar-grid hover:bg-white/5 hover:text-white ${FOCUS} ${
            collapsed ? 'w-full border-t border-sidebar-line' : 'w-10 border-l border-sidebar-line'
          }`}
        >
          <SidebarToggleIcon expand={collapsed} />
        </button>
      </div>

      {tip ? (
        <div
          aria-hidden
          data-testid="sidebar-tooltip"
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-[10000] -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow-card"
        >
          {tip.label}
        </div>
      ) : null}
    </aside>
  );
}
