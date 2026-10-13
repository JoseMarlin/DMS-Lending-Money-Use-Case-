import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ChevronRightIcon } from '@/components/ui/icons';

/**
 * The dark bar of the review screen: a back arrow to /workflow and the breadcrumb
 * "Workflow > Home Loan Approval" (the first part muted, the second bold and white).
 */
export default function ReviewTopBar({ workflowName }: { workflowName: string }) {
  return (
    <header className="flex h-[65px] shrink-0 items-center gap-3 border-b border-header-line bg-header pt-1 pr-5 pl-1 text-white">
      <Link
        to="/workflow"
        aria-label="Back to Workflow"
        className="flex h-8 w-8 items-center justify-center rounded-field hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ArrowLeftIcon size={18} />
      </Link>
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-[5px] text-[20px] leading-7 font-semibold">
          <li>
            <Link
              to="/workflow"
              className="text-header-muted hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Workflow
            </Link>
          </li>
          <li aria-hidden className="text-header-muted/70">
            <ChevronRightIcon size={12} />
          </li>
          <li aria-current="page">{workflowName}</li>
        </ol>
      </nav>
    </header>
  );
}
