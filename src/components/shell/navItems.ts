import type { ComponentType } from 'react';
import {
  DashboardIcon,
  DatabaseIcon,
  FileSearchIcon,
  FolderIcon,
  ReportsIcon,
  SettingsIcon,
  SparkleIcon,
  StarIcon,
  TrashIcon,
  WorkflowIcon,
  type IconProps,
} from './icons';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: ComponentType<IconProps>;
  /** The item is active on this path and on everything below it */
  match: string;
  /** Drawn in a fainter colour: the section is not part of this demo (it still opens its page) */
  dimmed?: boolean;
}

/** The sidebar, in the order of the Figma frame. Bin is kept apart: it sits at the bottom. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/dashboard',
    match: '/dashboard',
    icon: DashboardIcon,
  },
  { id: 'files', label: 'Files & Folders', to: '/files', match: '/files', icon: FolderIcon },
  // not part of this demo: it is drawn dimmed and opens the "Not part of this demo" page
  {
    id: 'magic-folder',
    label: 'Magic Folder',
    to: '/magic-folder',
    match: '/magic-folder',
    icon: SparkleIcon,
    dimmed: true,
  },
  { id: 'favourite', label: 'Favourite', to: '/favourite', match: '/favourite', icon: StarIcon },
  {
    id: 'advance-search',
    label: 'Advance Search',
    to: '/advance-search',
    match: '/advance-search',
    icon: FileSearchIcon,
  },
  // the Metadata item opens the Home Loan master and stays active on any metadata page
  {
    id: 'metadata',
    label: 'Metadata',
    to: '/metadata/master/home-loan',
    match: '/metadata',
    icon: DatabaseIcon,
  },
  { id: 'workflow', label: 'Workflow', to: '/workflow', match: '/workflow', icon: WorkflowIcon },
  { id: 'reports', label: 'Reports', to: '/reports', match: '/reports', icon: ReportsIcon },
  { id: 'settings', label: 'Settings', to: '/settings', match: '/settings', icon: SettingsIcon },
];

export const BIN_ITEM: NavItem = {
  id: 'bin',
  label: 'Bin',
  to: '/bin',
  match: '/bin',
  icon: TrashIcon,
};

/**
 * True when the address is the item's path or below it ('/metadata/master/home-loan' is Metadata).
 * The router ignores the case of an address ('/Dashboard' shows the dashboard), so this does too.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === item.match || path.startsWith(`${item.match}/`);
}
