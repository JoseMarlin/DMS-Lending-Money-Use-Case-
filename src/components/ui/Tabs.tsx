import type { KeyboardEvent } from 'react';

export interface TabItem {
  id: string;
  label: string;
  /** Draws a small red dot after the label: something in this tab needs attention (an error) */
  alert?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  /** id of the selected tab */
  value: string;
  onChange: (id: string) => void;
  /** Names the group of tabs for screen readers, for example "Home Loan Application views" */
  label: string;
  /** Makes the ids of the tabs and their panels, so that each tab can point at its panel */
  idPrefix: string;
  /** sm is the 13px text of the review screen; md (the default) is the 14px of the lists */
  size?: 'md' | 'sm';
  /** Draws no hairline of its own: the screen puts one under the whole width (the tabs overlap it) */
  flush?: boolean;
}

/**
 * Tabs as in the Figma list: text on a hairline, the selected one in dark blue with a 2px primary
 * bar under it. Left and Right (and Home, End) move between the tabs, as for any tab list.
 */
export default function Tabs({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  size = 'md',
  flush = false,
}: TabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Alt+Left (Back), Ctrl+Home and the like belong to the browser
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = tabs.findIndex((tab) => tab.id === value);
    const target = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onChange(tabs[target].id);
    document.getElementById(`${idPrefix}-tab-${tabs[target].id}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`flex gap-0 ${flush ? '' : 'border-b border-line'}`}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`-mb-px border-b-2 px-3 whitespace-nowrap ${
              size === 'sm' ? 'h-9 text-[13px] leading-[18px] font-medium' : 'h-10 text-body-m'
            } focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
              selected
                ? 'border-primary text-tab-active forced-colors:border-[Highlight] forced-colors:text-[Highlight]'
                : 'border-transparent text-subtle hover:text-ink forced-colors:border-[Canvas]'
            }`}
          >
            {tab.label}
            {tab.alert ? (
              <>
                <span
                  aria-hidden
                  data-testid={`tab-alert-${tab.id}`}
                  className="ml-1.5 inline-block h-2 w-2 rounded-full bg-error align-middle forced-colors:bg-[CanvasText]"
                />
                <span className="sr-only">, has errors</span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
