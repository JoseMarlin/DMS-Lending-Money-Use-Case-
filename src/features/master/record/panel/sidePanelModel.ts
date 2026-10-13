import { listStatusOf } from '@/data/listStatus';
import type { ApplicationStatus } from '@/data/types';

/** The tabs of the side panel, which are the icons of its rail, from the top. */
export type PanelTabId = 'kyc' | 'comments' | 'files' | 'audit';

export interface PanelTab {
  id: PanelTabId;
  /** The title of the panel, and the name of the icon */
  title: string;
}

export const PANEL_TABS: readonly PanelTab[] = [
  { id: 'kyc', title: 'KYC Checks' },
  { id: 'comments', title: 'Comments' },
  { id: 'files', title: 'Files and Attachments' },
  { id: 'audit', title: 'Audit Log' },
];

/**
 * The tab the panel opens on: the KYC checks for a record that is still being made (a Draft) or is
 * being decided (In-Progress), where the person is looking at them; the comments for the others
 * (Approved, Rejected, and Returned, which is about what the approver wrote).
 */
export function defaultPanelTab(status: ApplicationStatus): PanelTabId {
  const list = listStatusOf(status);
  return list === 'Draft' || list === 'In-Progress' ? 'kyc' : 'comments';
}

export function panelTabOf(id: PanelTabId): PanelTab {
  return PANEL_TABS.find((tab) => tab.id === id) ?? PANEL_TABS[0];
}

/** The ids of a tab and of its panel (the rail's icon points at the panel, which names itself by the icon). */
export const panelIds = (id: PanelTabId) => ({
  tab: `record-rail-tab-${id}`,
  panel: `record-rail-panel-${id}`,
});
