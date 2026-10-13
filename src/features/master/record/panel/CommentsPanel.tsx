import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Badge, Button, ConfirmDialog, useToast, type BadgeTone } from '@/components/ui';
import { SendIcon, TrashIcon } from '@/components/ui/icons';
import { MAX_COMMENT_LENGTH, commentThread, type ThreadItem } from '@/data/recordComments';
import { useAppStore, useCurrentUser } from '@/data/store';
import { formatDateTime, formatRelativeTime, initialsOf } from '@/lib/format';

/** How a decision is told on the chip beside its outcome. */
const OUTCOME_TONE: Record<string, BadgeTone> = {
  Approved: 'success',
  Returned: 'warning',
  Rejected: 'error',
};

/** The relative times are made again every minute, so "Just now" does not stay for an hour. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function Avatar({ name, own }: { name: string; own: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] leading-4 font-semibold ${
        own ? 'bg-avatar text-ink' : 'bg-primary-100 text-tab-active'
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}

function CommentItem({
  item,
  own,
  now,
  onDelete,
}: {
  item: ThreadItem;
  own: boolean;
  now: Date;
  onDelete?: () => void;
}) {
  return (
    <li className="flex gap-3 border-b border-line px-4 py-3.5">
      <Avatar name={item.author} own={own} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] leading-5 font-semibold [overflow-wrap:anywhere] text-ink">
            {item.author}
          </span>
          <span className="rounded-full border border-line bg-white px-2 text-[11px] leading-[18px] font-medium whitespace-nowrap text-subtle">
            {item.role}
          </span>
          {item.decision ? (
            <>
              <Badge tone="info" className="px-2 text-[11px]">
                {item.decision.label}
              </Badge>
              {OUTCOME_TONE[item.decision.outcome] ? (
                <Badge tone={OUTCOME_TONE[item.decision.outcome]} className="px-2 text-[11px]">
                  {item.decision.outcome}
                </Badge>
              ) : null}
            </>
          ) : null}
        </div>
        <time
          dateTime={item.at}
          title={formatDateTime(item.at)}
          className="block text-[12px] leading-4 text-subtle"
        >
          {formatRelativeTime(item.at, now)}
        </time>
        <p className="mt-1.5 text-[13px] leading-5 [overflow-wrap:anywhere] whitespace-pre-line text-ink">
          {item.text}
        </p>
      </div>
      {onDelete ? (
        <button
          type="button"
          aria-label={`Delete your comment of ${formatDateTime(item.at)}`}
          onClick={onDelete}
          className="-mt-1 -mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-white hover:text-error-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <TrashIcon size={15} />
        </button>
      ) : null}
    </li>
  );
}

/**
 * The Comments tab of the side panel: the thread of the application, oldest first, the comments of
 * the two approvers' decisions among them, and the box that adds one as the user who is acting. A
 * person can delete their own comments only. The text typed and not yet sent is kept by the sheet,
 * so it is still there after a visit to another tab of the rail.
 */
export default function CommentsPanel({
  applicationId,
  draft,
  onDraftChange,
}: {
  applicationId: string;
  draft: string;
  onDraftChange: (text: string) => void;
}) {
  const comments = useAppStore((state) => state.recordComments);
  const auditEvents = useAppStore((state) => state.auditEvents);
  const addComment = useAppStore((state) => state.addRecordComment);
  const deleteComment = useAppStore((state) => state.deleteRecordComment);
  const user = useCurrentUser();
  const toast = useToast();
  const now = useNow();
  const thread = useMemo(
    () => commentThread(comments, auditEvents, applicationId),
    [comments, auditEvents, applicationId],
  );

  const [error, setError] = useState('');
  // what a screen reader is told; n makes each one a new node, so the same words are read again
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 });
  const announce = (text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 }));
  const [deleting, setDeleting] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // the newest comment is at the end: the thread is shown from there, and goes there again when one is added
  const last = thread.at(-1)?.id;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  const text = draft.trim();
  const send = () => {
    if (text === '') return;
    const outcome = addComment(applicationId, draft);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setError('');
    onDraftChange('');
    announce(`Comment added by ${user.name}`);
    field.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      send();
    }
  };

  const confirmDelete = () => {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    const outcome = deleteComment(id);
    if (outcome.ok) {
      announce('Comment deleted');
      // the button that was pressed has gone with its comment: the cursor goes to the box
      field.current?.focus();
    } else toast.show({ message: outcome.error, tone: 'error', durationMs: 8000 });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        {...(thread.length > 0
          ? { role: 'region', 'aria-label': 'Comment thread', tabIndex: 0 }
          : {})}
        className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        {thread.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
            <p className="text-body-m font-semibold text-label">No comments yet</p>
            <p className="text-[13px] leading-5 text-subtle">
              Add a note about this loan below. Everyone who opens the record can read it.
            </p>
          </div>
        ) : (
          <ul aria-label="Comments, oldest first">
            {thread.map((item) => {
              const own = item.kind === 'comment' && item.author === user.name;
              return (
                <CommentItem
                  key={item.id}
                  item={item}
                  own={own}
                  now={now}
                  onDelete={own ? () => setDeleting(item.id) : undefined}
                />
              );
            })}
          </ul>
        )}
      </div>

      <form
        className="shrink-0 border-t border-line bg-white px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label htmlFor="record-comment-input" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="record-comment-input"
          ref={field}
          value={draft}
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="Add a comment"
          aria-describedby="record-comment-hint"
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onDraftChange(event.target.value);
            if (error) setError('');
          }}
          onKeyDown={onKeyDown}
          className="block max-h-40 min-h-[76px] w-full resize-none rounded-field border border-field-border bg-white px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {/* Send is at the left: the demo's floating "Demo controls" button sits over the lower right corner */}
        <div className="mt-2 flex items-center gap-3">
          <Button type="submit" size="sm" disabled={text === ''} className="h-8 shrink-0 px-3">
            <SendIcon size={14} />
            Send
          </Button>
          <p id="record-comment-hint" className="min-w-0 text-[12px] leading-4 text-subtle">
            {error ? <span className="text-error-text">{error}</span> : 'Ctrl+Enter sends'}
          </p>
        </div>
      </form>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={announcement.n}>{announcement.text}</span>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this comment?"
        confirmLabel="Delete comment"
        cancelLabel="Keep comment"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        The comment is removed from the thread for everyone. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
