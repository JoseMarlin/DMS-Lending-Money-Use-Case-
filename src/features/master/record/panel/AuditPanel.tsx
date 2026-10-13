import { useMemo, useState, type ReactNode } from 'react';
import { FilterChip } from '@/components/ui';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ChecklistIcon,
  CloseIcon,
  CommentsIcon,
  EditIcon,
  HistoryIcon,
  ListIcon,
  PaperclipIcon,
  PlusIcon,
  SendIcon,
} from '@/components/ui/icons';
import { useAppStore } from '@/data/store';
import type { HomeLoanApplication } from '@/data/types';
import { formatClock } from '@/lib/format';
import {
  AUDIT_FILTERS,
  applyFilter,
  auditTimeline,
  filterCounts,
  groupByDay,
  type AuditFilter,
  type AuditIcon,
  type AuditTone,
  type TimelineItem,
} from './auditLogModel';

const ICON: Record<AuditIcon, ReactNode> = {
  created: <PlusIcon size={16} />,
  edit: <EditIcon size={16} />,
  consent: <CheckCircleIcon size={16} />,
  file: <PaperclipIcon size={16} />,
  kyc: <ChecklistIcon size={16} />,
  comment: <CommentsIcon size={16} />,
  submit: <SendIcon size={16} />,
  workflow: <HistoryIcon size={16} />,
  approved: <CheckCircleIcon size={16} />,
  returned: <ArrowLeftIcon size={16} />,
  rejected: <CloseIcon size={16} />,
  record: <ListIcon size={16} />,
};

const TONE: Record<AuditTone, string> = {
  neutral: 'bg-field-disabled text-subtle ring-field-border',
  info: 'bg-primary-50 text-primary ring-primary-200',
  success: 'bg-status-approved-bg text-status-approved-text ring-status-approved-border',
  warning: 'bg-status-progress-bg text-status-progress-text ring-status-progress-border',
  error: 'bg-status-rejected-bg text-status-rejected-text ring-status-rejected-border',
};

function Entry({ item }: { item: TimelineItem }) {
  return (
    <li className="relative flex gap-3 px-4 py-2.5">
      <span
        aria-hidden
        data-testid={`audit-icon-${item.icon}`}
        className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${TONE[item.tone]}`}
      >
        {ICON[item.icon]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-5 font-semibold [overflow-wrap:anywhere] text-ink">
          {item.title}
        </p>
        {item.change ? (
          <p className="text-[12px] leading-4 [overflow-wrap:anywhere] text-label">
            <span className="sr-only">from </span>
            <span className="text-subtle">{item.change.from}</span>
            <span aria-hidden> → </span>
            <span className="sr-only"> to </span>
            <span className="font-semibold">{item.change.to}</span>
          </p>
        ) : null}
        {item.details.map((line, index) => (
          <p
            key={index}
            className="text-[12px] leading-4 [overflow-wrap:anywhere] whitespace-pre-line text-label"
          >
            {line}
          </p>
        ))}
        {item.reason ? (
          <p className="mt-0.5 text-[12px] leading-4 [overflow-wrap:anywhere] text-subtle">
            Reason for change: {item.reason}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-4 text-subtle">
          <span className="font-medium text-label">{item.user}</span>
          {item.role ? (
            <span className="rounded-full border border-line bg-white px-2 text-[11px] leading-[18px] font-medium whitespace-nowrap">
              {item.role}
            </span>
          ) : null}
          <span aria-hidden>·</span>
          <time dateTime={item.at}>{formatClock(item.at)}</time>
        </p>
      </div>
    </li>
  );
}

/**
 * The Audit Log tab of the side panel: what happened to this application, newest first, grouped by
 * day, with an icon for each kind of event, who did it and when. Filter chips (All, Data changes,
 * Workflow, KYC, Files, Comments) show how many each holds. A change of a value reads "old → new";
 * an edit by the administrator shows its reason. It follows the store, so a new comment, a file or a
 * decision is in it at once.
 */
export default function AuditPanel({
  application,
  now,
}: {
  application: HomeLoanApplication;
  /** "Today" counts from this: the moment the panel opened unless a test gives another */
  now?: Date;
}) {
  const events = useAppStore((state) => state.auditEvents);
  const [openedAt] = useState(() => new Date());
  const [filter, setFilter] = useState<AuditFilter>('all');
  const items = useMemo(() => auditTimeline(application, events), [application, events]);
  const counts = filterCounts(items);
  const groups = groupByDay(applyFilter(items, filter), now ?? openedAt);
  const label = AUDIT_FILTERS.find((f) => f.id === filter)?.label ?? 'All';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="group"
        aria-label="Filter the activity"
        className="flex shrink-0 flex-wrap gap-2 border-b border-line px-4 py-3"
      >
        {AUDIT_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            count={counts[f.id]}
            selected={filter === f.id}
            onClick={() => setFilter(f.id)}
          />
        ))}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {filter === 'all' && items.length === 0
          ? 'No activity yet'
          : `${groups.reduce((n, g) => n + g.items.length, 0)} ${label} events`}
      </div>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-14">
        {items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-body-m font-semibold text-label">No activity yet</p>
            <p className="mt-1 text-[13px] leading-5 text-subtle">
              What happens to this application will be listed here.
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-body-m font-semibold text-label">
              No {label.toLowerCase()} activity
            </p>
            <p className="mt-1 text-[13px] leading-5 text-subtle">Choose All to see everything.</p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h4 className="sticky top-0 z-20 border-b border-line bg-panel-footer px-4 py-1.5 text-[12px] leading-4 font-semibold text-subtle">
                {group.label}
              </h4>
              <ol className="relative before:absolute before:top-0 before:bottom-0 before:left-[31px] before:w-px before:bg-line">
                {group.items.map((item) => (
                  <Entry key={item.id} item={item} />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
