import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import DataTable, { type Column, type SortState } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import FilterChip from '@/components/ui/FilterChip';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/useToast';
import { useAppStore, useCurrentUser } from '@/data/store';
import { toISODate } from '@/data/application';
import { downloadCsv } from '@/lib/csv';
import { formatListDateTime } from '@/lib/format';
import {
  FILTERS,
  countByFilter,
  filterSubmissions,
  sortSubmissions,
  submissionsCsv,
  submissionsFor,
  type FilterKey,
  type SubmissionRow,
} from './listData';
import { ExportButton, SearchBox } from './ListToolbar';
import RowActions from './RowActions';

/**
 * The "My Submissions" tab: the applications the current user made (the administrator sees all,
 * an approver none), with status chips that count and filter, a search box, sortable columns and
 * an export of the rows that are showing.
 */
export default function MySubmissionsPanel() {
  const user = useCurrentUser();
  const applications = useAppStore((state) => state.applications);
  const toast = useToast();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  // newest first, until the user picks a column
  const [sort, setSort] = useState<SortState>({ id: 'createdAt', dir: 'desc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const all = useMemo(() => submissionsFor(user, applications), [user, applications]);
  const counts = useMemo(() => countByFilter(all), [all]);
  const rows = useMemo(
    () => sortSubmissions(filterSubmissions(all, filter, query), sort.id, sort.dir),
    [all, filter, query, sort],
  );

  const onSortChange = (id: string) =>
    setSort((current) =>
      current.id === id
        ? { id, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { id, dir: id === 'createdAt' ? 'desc' : 'asc' },
    );

  const columns: Column<SubmissionRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-body-m text-ink" title={row.name || undefined}>
            {row.name || <span className="text-subtle italic">No name yet</span>}
          </div>
          <div className="text-xs text-subtle">{row.applicationId}</div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '210px',
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      id: 'createdAt',
      header: 'Created On',
      sortable: true,
      width: '240px',
      render: (row) => formatListDateTime(row.createdAt),
    },
    {
      id: 'action',
      header: 'Action',
      width: '132px',
      render: (row) => <RowActions applicationId={row.applicationId} name={row.name} />,
    },
  ];

  const exportRows = () => {
    downloadCsv(`home-loan-my-submissions-${toISODate(new Date())}.csv`, submissionsCsv(rows));
    toast.show(`Exported ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} to CSV`);
  };

  const clear = () => {
    setFilter('all');
    setQuery('');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <FilterChip
              key={item.key}
              label={item.label}
              count={counts[item.key]}
              selected={filter === item.key}
              onClick={() => setFilter(item.key)}
            />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <SearchBox value={query} onChange={setQuery} />
          <ExportButton count={rows.length} onExport={exportRows} />
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          caption="My Submissions"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.applicationId}
          sort={sort}
          onSortChange={onSortChange}
          selection={{
            selected,
            onChange: setSelected,
            rowLabel: (row) => `Select ${row.name || row.applicationId}`,
          }}
        />
        {rows.length === 0 ? (
          all.length === 0 ? (
            <EmptyState
              title={
                user.role === 'loanOfficer' || user.role === 'admin'
                  ? 'No submissions yet'
                  : 'No submissions to show'
              }
            >
              {user.role === 'loanOfficer' || user.role === 'admin'
                ? 'Applications you submit will appear here. Use Create Record to start one.'
                : 'Approvers review applications; they do not submit them. Applications waiting for you are under Workflow.'}
            </EmptyState>
          ) : (
            <EmptyState
              title="No records match"
              action={
                <Button variant="secondary" size="sm" onClick={clear}>
                  Clear search and filters
                </Button>
              }
            >
              Nothing matches the search and the status chosen.
            </EmptyState>
          )
        ) : null}
        <div className="sr-only" aria-live="polite">
          {rows.length} {rows.length === 1 ? 'record' : 'records'} shown
        </div>
      </div>
    </div>
  );
}
