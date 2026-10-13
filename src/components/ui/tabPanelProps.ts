/** The attributes a tab's panel needs so that it and its tab belong together (see Tabs). */
export function tabPanelProps(idPrefix: string, id: string) {
  return {
    id: `${idPrefix}-panel-${id}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `${idPrefix}-tab-${id}`,
    tabIndex: 0,
  };
}
