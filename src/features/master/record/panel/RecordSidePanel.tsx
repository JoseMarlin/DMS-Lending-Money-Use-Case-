import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui';
import { ChecklistIcon, CommentsIcon, HistoryIcon, PaperclipIcon } from '@/components/ui/icons';
import type { HomeLoanApplication } from '@/data/types';
import type { RecordEdit } from '../useRecordEdit';
import AuditPanel from './AuditPanel';
import CommentsPanel from './CommentsPanel';
import FilesPanel from './FilesPanel';
import KycChecksPanel from './KycChecksPanel';
import { PANEL_TABS, panelIds, panelTabOf, type PanelTabId } from './sidePanelModel';

const RAIL_ICON: Record<PanelTabId, ReactNode> = {
  kyc: <ChecklistIcon size={20} />,
  comments: <CommentsIcon size={20} />,
  files: <PaperclipIcon size={20} />,
  audit: <HistoryIcon size={20} />,
};

/**
 * The right side of the record sheet: a 360px panel and, at the far edge, a 40px rail of icons.
 * The rail is a toolbar of toggle buttons: the KYC checks at the top, then the comments, the files
 * and attachments, and the audit log; the panel is the one of the icon that is on, and its title bar
 * is in the row of the tabs. Pressing the icon that is on closes the panel, so the form has the whole width; the rail
 * stays, and an icon opens its panel again. Below 1024px there is no room for it, and it is not drawn.
 */
export default function RecordSidePanel({
  application,
  edit,
  tab,
  open,
  onTabChange,
  onOpenChange,
  focusDoc,
  onNavigate,
}: {
  application: HomeLoanApplication;
  edit: RecordEdit;
  /** The panel that is on, and whether it is open: the sheet keeps them, so that Save can open the Files panel */
  tab: PanelTabId;
  open: boolean;
  onTabChange: (tab: PanelTabId) => void;
  onOpenChange: (open: boolean) => void;
  /** A required document that Save found missing (a new request each time Save is blocked) */
  focusDoc: { docType: string; n: number } | null;
  /** A link out of the sheet was pressed: the sheet asks about unsaved changes first */
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, to: string) => void;
}) {
  const setTab = onTabChange;
  const setOpen = onOpenChange;
  // the one icon that Tab reaches: the one that has the cursor (the arrow keys move it without pressing)
  const [rove, setRove] = useState<PanelTabId>(tab);
  // what was typed in the comment box and not sent: kept while the other panels are looked at
  const [commentDraft, setCommentDraft] = useState('');
  const current = panelTabOf(tab);

  const select = (id: PanelTabId) => {
    if (id === tab && open) {
      setOpen(false);
    } else {
      setTab(id);
      setOpen(true);
    }
  };

  // Up and Down (and Home, End) move the cursor between the icons; Enter or Space presses one
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const focused = PANEL_TABS.findIndex((t) => panelIds(t.id).tab === document.activeElement?.id);
    const index = focused === -1 ? PANEL_TABS.findIndex((t) => t.id === tab) : focused;
    const target = {
      ArrowDown: (index + 1) % PANEL_TABS.length,
      ArrowUp: (index - 1 + PANEL_TABS.length) % PANEL_TABS.length,
      Home: 0,
      End: PANEL_TABS.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    document.getElementById(panelIds(PANEL_TABS[target].id).tab)?.focus();
  };

  return (
    <div className="hidden shrink-0 lg:flex" data-testid="record-side">
      {open ? (
        <section
          id={panelIds(tab).panel}
          aria-label={current.title}
          data-testid="record-side-panel"
          className="flex w-[360px] flex-col border-l border-line bg-panel-footer"
        >
          <div className="flex h-10 shrink-0 items-center border-b border-line bg-table-head px-4">
            <h3 className="truncate text-[14px] leading-5 font-bold text-ink">{current.title}</h3>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {tab === 'kyc' ? (
              <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-14">
                <KycChecksPanel application={application} />
              </div>
            ) : tab === 'comments' ? (
              <CommentsPanel
                applicationId={application.applicationId}
                draft={commentDraft}
                onDraftChange={setCommentDraft}
              />
            ) : tab === 'files' ? (
              <FilesPanel
                application={application}
                edit={edit}
                focusDoc={focusDoc}
                onNavigate={onNavigate}
              />
            ) : (
              <AuditPanel application={application} />
            )}
          </div>
        </section>
      ) : null}

      <div
        role="toolbar"
        aria-orientation="vertical"
        aria-label="Record panels"
        data-testid="record-side-rail"
        onKeyDown={onKeyDown}
        className="flex w-10 flex-col border-l border-line bg-table-head"
      >
        {/* the row of the tabs: the rail starts under it */}
        <div aria-hidden className="h-10 shrink-0 border-b border-line" />
        {PANEL_TABS.map((t) => {
          const on = open && t.id === tab;
          return (
            <Tooltip key={t.id} text={t.title} className="w-full">
              {() => (
                <button
                  id={panelIds(t.id).tab}
                  type="button"
                  aria-label={
                    t.id === 'files' && edit.filesNeedAttention ? `${t.title}, has errors` : t.title
                  }
                  aria-pressed={on}
                  aria-controls={on ? panelIds(t.id).panel : undefined}
                  tabIndex={t.id === rove ? 0 : -1}
                  onFocus={() => setRove(t.id)}
                  onClick={() => select(t.id)}
                  className={`relative flex h-10 w-full items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                    on
                      ? 'bg-view-toggle-on text-view-toggle-ink forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]'
                      : 'text-subtle hover:bg-white hover:text-ink'
                  }`}
                >
                  {RAIL_ICON[t.id]}
                  {t.id === 'files' && edit.filesNeedAttention ? (
                    <span
                      aria-hidden
                      data-testid="rail-alert-files"
                      className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error forced-colors:bg-[CanvasText]"
                    />
                  ) : null}
                </button>
              )}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
