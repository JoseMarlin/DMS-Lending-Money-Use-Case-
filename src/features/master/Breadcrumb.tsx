import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@/components/ui/icons';

export interface Crumb {
  label: string;
  /** Where it goes. The last crumb has none: it is the page you are on. */
  to?: string;
}

/**
 * "Metadata > Master > Home Loan Application": the ones before the last are grey links, the last
 * is the page heading, in bold. Built from the Figma list frame (22px, semibold).
 */
export default function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-2 text-[22px] leading-7 font-semibold">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {last ? (
                <h1 className="font-bold text-ink">{crumb.label}</h1>
              ) : (
                <>
                  <Link
                    to={crumb.to ?? '#'}
                    className="rounded text-subtle hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {crumb.label}
                  </Link>
                  <ChevronRightIcon size={14} className="text-muted" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
