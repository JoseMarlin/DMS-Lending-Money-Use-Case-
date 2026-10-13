import type { ReactNode } from 'react';
import { EmptyTrayIcon } from './icons';

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** A button under the text, for example "Clear search and filters" */
  action?: ReactNode;
  /** The hairline under it, made for a list that has its rows above; false when nothing is above */
  bordered?: boolean;
}

/** What a list says when it has nothing to show: a tray, a line of what happened, and what to do. */
export default function EmptyState({ title, children, action, bordered = true }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 px-6 py-14 text-center ${bordered ? 'border-b border-line' : ''}`}
    >
      <EmptyTrayIcon size={44} className="text-muted" />
      <p className="text-body-m font-semibold text-label">{title}</p>
      {children ? <p className="max-w-md text-body-m text-subtle">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
