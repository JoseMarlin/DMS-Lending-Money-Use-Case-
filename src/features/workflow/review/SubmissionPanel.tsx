import { useNavigate } from 'react-router-dom';
import { Bullet, SearchInput } from '@/components/ui';
import { FilterIcon } from '@/components/ui/icons';
import type { SubmissionItem } from './reviewModel';
import { reviewPath } from '../workflowList';

/**
 * The left panel: the submissions waiting for the current user. A click opens that one (the
 * panel stays, the centre and the Progress panel change). Search narrows the list; the filter
 * icon is only drawn.
 */
export default function SubmissionPanel({
  items,
  currentId,
  query,
  onQueryChange,
}: {
  items: SubmissionItem[];
  /** The instance on screen: marked in the list when it is one of them */
  currentId: string;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const navigate = useNavigate();
  // the page narrows the list; the empty text depends on whether a search is why it is empty
  const searched = query.trim() !== '';

  return (
    <aside
      aria-label="Submission"
      className="flex w-[219px] shrink-0 flex-col border-r border-line bg-table-head"
    >
      <div className="shrink-0 pt-3">
        <div className="flex h-6 items-center justify-between pr-3 pl-4">
          <h2 className="text-[16px] leading-6 font-semibold text-ink">Submission</h2>
          {/* only drawn */}
          <button
            type="button"
            disabled
            aria-label="Filter submissions"
            className="flex h-6 w-4 items-center justify-center text-label"
          >
            <FilterIcon size={16} />
          </button>
        </div>
        <div className="mt-2 pr-[9px] pl-4">
          <SearchInput
            value={query}
            onChange={onQueryChange}
            label="Search submissions"
            placeholder="Search"
            className="max-w-none"
          />
        </div>
      </div>

      {items.length > 0 ? (
        <ul
          className="thin-scrollbar mt-1 min-h-0 flex-1 overflow-y-auto"
          aria-label="Pending submissions"
        >
          {items.map((item) => {
            const current = item.id === currentId;
            return (
              <li key={item.id} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => {
                    if (!current) navigate(reviewPath(item.id));
                  }}
                  aria-current={current ? 'true' : undefined}
                  className={`flex h-[55px] w-full flex-col items-stretch px-4 pt-[11px] text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                    current ? 'bg-white' : 'hover:bg-white/60'
                  }`}
                >
                  <span className="block truncate text-[12px] leading-[18px] font-semibold text-ink">
                    {item.applicantName || item.applicationId}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] leading-4 whitespace-nowrap text-subtle">
                    <span className="font-semibold text-status-action-text">{item.status}</span>
                    <Bullet />
                    <span>{item.id}</span>
                    <Bullet />
                    <span>{item.date}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 pt-6 text-center text-[12px] leading-4 font-medium text-balance text-subtle">
          {searched ? 'No submission matches the search.' : 'No submissions are waiting for you.'}
        </p>
      )}
      {/* what a screen reader hears when the search narrows the list */}
      <p role="status" className="sr-only">
        {items.length} {items.length === 1 ? 'submission' : 'submissions'}{' '}
        {searched ? 'match the search' : 'waiting for you'}
      </p>
    </aside>
  );
}
