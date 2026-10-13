import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@/components/ui/icons';
import type { Crumb } from './filesPageModel';

/**
 * "Files & Folders > Loans > Home Loan", above the title when a folder is open. Every part is a
 * link, the last one (the folder you are in) marked as the current place.
 */
export default function FolderBreadcrumb({
  crumbs,
  onNavigate,
}: {
  crumbs: Crumb[];
  /** Called when any part is chosen */
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1 min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-[18px]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.to}-${index}`} className="flex items-center gap-1.5">
              <Link
                to={crumb.to}
                onClick={onNavigate}
                aria-current={last ? 'page' : undefined}
                className={`rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  last ? 'font-semibold text-ink' : 'text-subtle hover:text-ink'
                }`}
              >
                {crumb.label}
              </Link>
              {last ? null : <ChevronRightIcon size={12} className="text-muted" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
