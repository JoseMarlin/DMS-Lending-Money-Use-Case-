import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import DataTable, { type Column, type SortState } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/useToast';
import { toISODate } from '@/data/application';
import { useAppStore } from '@/data/store';
import { downloadCsv } from '@/lib/csv';
import { formatIndianNumber, formatListDate } from '@/lib/format';
import { filterRecords, recordRows, recordsCsv, sortRecords, type RecordRow } from './listData';
import { ExportButton, SearchBox } from './ListToolbar';
import RowActions from './RowActions';

/**
 * The "All Records" tab: only the records made at a final approval (Level 2). Until the first one
 * is approved the tab is empty, and says why. The columns have no Figma reference: they use the
 * same table as My Submissions.
 */
export default function AllRecordsPanel() {
  const masterRecords = useAppStore((state) => state.masterRecords);
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ id: 'approvedOn', dir: 'desc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const all = useMemo(() => recordRows(masterRecords), [masterRecords]);
  const rows = useMemo(
    () => sortRecords(filterRecords(all, query), sort.id, sort.dir),
    [all, query, sort],
  );

  const onSortChange = (id: string) =>
    setSort((current) =>
      current.id === id
        ? { id, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { id, dir: id === 'approvedOn' || id === 'sanctionedAmount' ? 'desc' : 'asc' },
    );

  const columns: Column<RecordRow>[] = [
    {
      id: 'applicationId',
      header: 'Application ID',
      sortable: true,
      width: '150px',
      render: (row) => row.applicationId,
    },
    {
      id: 'applicantName',
      header: 'Applicant Name',
      sortable: true,
      render: (row) => (
        <span className="line-clamp-2 leading-5" title={row.applicantName}>
          {row.applicantName}
        </span>
      ),
    },
    {
      id: 'loanPurpose',
      header: 'Loan Purpose',
      width: '150px',
      render: (row) => (
        <span className="line-clamp-2 leading-5" title={row.loanPurpose}>
          {row.loanPurpose}
        </span>
      ),
    },
    {
      id: 'sanctionedAmount',
      header: 'Sanctioned Amount',
      sortable: true,
      width: '170px',
      render: (row) =>
        row.sanctionedAmount === null ? '' : `₹ ${formatIndianNumber(row.sanctionedAmount)}`,
    },
    {
      id: 'branch',
      header: 'Branch',
      width: '150px',
      render: (row) => (
        <span className="line-clamp-2 leading-5" title={row.branch}>
          {row.branch}
        </span>
      ),
    },
    {
      id: 'approvedOn',
      header: 'Approved On',
      sortable: true,
      width: '130px',
      render: (row) => formatListDate(row.approvedOn),
    },
    {
      id: 'action',
      header: 'Action',
      width: '124px',
      render: (row) => <RowActions applicationId={row.applicationId} name={row.applicantName} />,
    },
  ];

  const exportRows = () => {
    downloadCsv(`home-loan-all-records-${toISODate(new Date())}.csv`, recordsCsv(rows));
    toast.show(`Exported ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} to CSV`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <SearchBox value={query} onChange={setQuery} />
        <ExportButton count={rows.length} onExport={exportRows} />
      </div>

      <div className="mt-4">
        <DataTable
          caption="All Records"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.applicationId}
          sort={sort}
          onSortChange={onSortChange}
          minWidth={960}
          selection={{
            selected,
            onChange: setSelected,
            rowLabel: (row) => `Select ${row.applicantName || row.applicationId}`,
          }}
        />
        {rows.length === 0 ? (
          all.length === 0 ? (
            <EmptyState title="No records yet">
              A record is created here when an application gets its final approval at Level 2. Until
              then, follow your applications under My Submissions.
            </EmptyState>
          ) : (
            <EmptyState
              title="No records match"
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            >
              Nothing matches the search.
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
