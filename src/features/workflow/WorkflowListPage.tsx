import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, EmptyState, SearchInput, Tabs, tabPanelProps } from '@/components/ui';
import { CalendarIcon, ExportIcon, FilterIcon, PlusIcon, SortIcon } from '@/components/ui/icons';
import { useAppStore, useCurrentUser } from '@/data/store';
import { usePageTitle } from '@/lib/usePageTitle';
import {
  WORKFLOW_TABS,
  filterRows,
  reviewPath,
  rowMeta,
  rowTitle,
  rowsByTab,
  sortRows,
  tabLabel,
  type WorkflowRowData,
  type WorkflowTab,
} from './workflowList';

const PREFIX = 'workflow-list';

function Row({ row }: { row: WorkflowRowData }) {
  const title = rowTitle(row.applicantName);
  const who = row.applicantName || row.instance.applicationId;
  return (
    <li className="flex min-h-[68px] items-center justify-between gap-4 border-b border-line px-4 py-3 hover:bg-primary-50/40">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-m text-ink">
          <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
          {row.kycException ? <Badge tone="warning">KYC Exception</Badge> : null}
        </p>
        <p className="text-[13px] leading-[18px] text-subtle">{rowMeta(row.instance)}</p>
      </div>
      <Link
        to={reviewPath(row.instance.id)}
        aria-label={`${row.action}: ${who}, ${row.instance.id}`}
        className="inline-flex h-8 min-w-[140px] shrink-0 items-center justify-center rounded-field border border-primary-200 bg-primary-50 px-4 text-button-s text-primary hover:bg-primary-200/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {row.action}
      </Link>
    </li>
  );
}

/** What a tab says when it has no rows (and why), for this user. */
function emptyText(tab: WorkflowTab, isApprover: boolean) {
  switch (tab) {
    case 'my-actions':
      return isApprover
        ? {
            title: 'Nothing is waiting for you',
            body: 'When an application reaches your level, it will appear here.',
          }
        : {
            title: 'No actions for you',
            body: 'Only the approvers have actions here. Follow your applications under All Workflows.',
          };
    case 'completed':
      return {
        title: 'No completed actions yet',
        body: 'The workflows you have submitted or decided will appear here.',
      };
    default:
      return {
        title: 'No workflows yet',
        body: 'A workflow starts when a loan officer submits an application.',
      };
  }
}

/**
 * /workflow: the list of workflow instances, laid out like the Figma frame (Workflow file, node
 * 2535:45643). Three tabs with live counts, a toolbar where only the search works (Filter, the date
 * range and Export are drawn), a "Submissions" bar that sets the order, and a row for each
 * instance with Review Request (when it is your turn) or View.
 */
export default function WorkflowListPage() {
  usePageTitle('Workflow');
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const applications = useAppStore((state) => state.applications);
  const masterRecords = useAppStore((state) => state.masterRecords);
  const workflowInstances = useAppStore((state) => state.workflowInstances);
  const notifications = useAppStore((state) => state.notifications);
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);

  const requested = params.get('tab');
  const tab: WorkflowTab =
    requested === 'completed' || requested === 'all' ? requested : 'my-actions';
  const setTab = (id: string) =>
    setParams(id === 'my-actions' ? {} : { tab: id }, { replace: true });

  const byTab = useMemo(
    () => rowsByTab({ applications, masterRecords, workflowInstances, notifications }, user),
    [applications, masterRecords, workflowInstances, notifications, user],
  );
  const rows = useMemo(
    () => sortRows(filterRows(byTab[tab], query), newestFirst),
    [byTab, tab, query, newestFirst],
  );
  const tabs = WORKFLOW_TABS.map((t) => ({
    id: t.id,
    label: tabLabel(t.label, byTab[t.id].length),
  }));
  const isApprover = user.role === 'branchManager' || user.role === 'creditApprover';
  const empty = emptyText(tab, isApprover);

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex min-h-10 items-start justify-between gap-4">
        <h1 className="text-[22px] leading-7 font-bold text-ink">Workflow</h1>
        {/* the button is only drawn, and only the administrator has it */}
        {user.role === 'admin' ? (
          <Button>
            <PlusIcon size={18} />
            Create Workflow
          </Button>
        ) : null}
      </div>

      <div className="mt-2">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Workflow views" idPrefix={PREFIX} />
      </div>

      <div
        {...tabPanelProps(PREFIX, tab)}
        className="mt-4 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Search Workflow"
            className="max-w-[220px]"
          />
          {/* Filter, the date range and Export are only drawn */}
          <Button variant="secondary" size="sm" className="font-medium">
            <FilterIcon size={16} />
            Filter
          </Button>
          <Button variant="secondary" size="sm" className="font-medium">
            <CalendarIcon size={16} />
            DD/MM/YY - DD/MM/YY
          </Button>
          <Button variant="secondary" size="sm" className="font-medium">
            <ExportIcon size={16} />
            Export
          </Button>
        </div>

        <div className="mt-4">
          <div className="flex h-[42px] items-center gap-2 rounded-t-lg bg-table-head px-4">
            <h2 className="text-body-m font-semibold text-label">Submissions</h2>
            <button
              type="button"
              onClick={() => setNewestFirst((value) => !value)}
              aria-label={
                newestFirst
                  ? 'Order: newest first. Press for oldest first'
                  : 'Order: oldest first. Press for newest first'
              }
              className="flex h-6 w-6 items-center justify-center rounded text-subtle hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <SortIcon size={16} active={newestFirst ? 'desc' : 'asc'} />
            </button>
          </div>

          {rows.length > 0 ? (
            <ul aria-label="Submissions">
              {rows.map((row) => (
                <Row key={row.instance.id} row={row} />
              ))}
            </ul>
          ) : byTab[tab].length > 0 ? (
            <EmptyState
              title="No workflows match"
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            >
              Nothing matches the search.
            </EmptyState>
          ) : (
            <EmptyState title={empty.title}>{empty.body}</EmptyState>
          )}
        </div>
        <div className="sr-only" aria-live="polite">
          {rows.length} {rows.length === 1 ? 'workflow' : 'workflows'} shown
        </div>
      </div>
    </div>
  );
}
