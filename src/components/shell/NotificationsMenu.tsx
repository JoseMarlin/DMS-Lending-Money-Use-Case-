import { useEffect, useId, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore, useCurrentUser, usePendingTasks, useUnreadCount } from '@/data/store';
import { formatDateTime } from '@/lib/format';
import { usePopover } from '@/components/ui/usePopover';
import { recordSheetPath } from '@/features/master/paths';
import { BellIcon } from './icons';

const RECORD_LINK =
  'mt-1 inline-block rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** What the bell says to a screen reader, since the red number is only drawn. */
function bellLabel(count: number): string {
  return count === 0 ? 'Notifications, none new' : `Notifications, ${count} new`;
}

/**
 * The bell in the top bar. The red number is what is new for the user who is acting: the approval
 * tasks waiting for them, and the messages they have not read (the loan officer is told when an
 * application is approved, rejected or returned). The dropdown lists both. Opening it counts the
 * messages as read; a task stays until it is acted on. Not in Figma (the frame has a bell without
 * a count), so the badge and the dropdown are designed from the same tokens.
 */
export default function NotificationsMenu() {
  const user = useCurrentUser();
  const tasks = usePendingTasks();
  const count = useUnreadCount();
  const allMessages = useAppStore((state) => state.notifications);
  const markRead = useAppStore((state) => state.markNotificationsRead);
  const { open, toggle, close, rootRef, triggerRef, panelRef } = usePopover();
  const panelId = useId();
  const headingId = useId();

  // newest first
  const messages = useMemo(
    () =>
      allMessages
        .filter((message) => message.userId === user.id)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    [allMessages, user.id],
  );

  // looking at the messages is reading them
  useEffect(() => {
    if (open) markRead(user.id);
  }, [open, markRead, user.id]);

  const nothing = tasks.length === 0 && messages.length === 0;

  return (
    <div ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={bellLabel(count)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-primary-50 aria-expanded:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <BellIcon size={24} />
        {count > 0 ? (
          <span
            aria-hidden
            data-testid="bell-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-text px-1 text-[10px] leading-none font-bold text-white"
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="absolute top-[calc(100%-4px)] right-5 z-[10000] max-h-[calc(100vh-60px)] w-80 overflow-y-auto rounded-card border border-line bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2
              id={headingId}
              tabIndex={-1}
              data-autofocus
              className="rounded text-body-m text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Pending approvals
            </h2>
            <span className="text-xs text-subtle">{tasks.length}</span>
          </div>

          {nothing ? (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <BellIcon size={24} className="text-muted" />
              <p className="text-body-m text-ink">No pending approval tasks</p>
              <p className="text-xs text-subtle">
                When an application needs your approval, it will appear here.
              </p>
            </div>
          ) : (
            <>
              {tasks.length === 0 ? (
                <p className="px-4 py-3 text-xs text-subtle">No pending approval tasks.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {tasks.map((task) => (
                    <li key={task.id} className="px-4 py-3">
                      <p className="text-body-m text-ink">
                        {task.applicantName}
                        <span className="text-subtle"> &middot; {task.applicationId}</span>
                      </p>
                      <p className="text-xs text-subtle">
                        Level {task.level} approval &middot; received{' '}
                        {formatDateTime(task.receivedAt)}
                      </p>
                      <Link
                        to={recordSheetPath(task.applicationId)}
                        onClick={() => close()}
                        aria-label={`View record of ${task.applicantName}, ${task.applicationId}`}
                        className={RECORD_LINK}
                      >
                        View record
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {messages.length > 0 ? (
                <section aria-label="Messages" className="border-t border-line">
                  <h3 className="px-4 pt-3 text-link-s text-label">Messages</h3>
                  <ul className="divide-y divide-line">
                    {messages.map((message) => (
                      <li key={message.id} className="px-4 py-3">
                        <p className="text-body-m text-ink">{message.message}</p>
                        <p className="text-xs text-subtle">{formatDateTime(message.at)}</p>
                        <Link
                          to={recordSheetPath(message.applicationId)}
                          onClick={() => close()}
                          aria-label={`View record ${message.applicationId}`}
                          className={RECORD_LINK}
                        >
                          View record
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
