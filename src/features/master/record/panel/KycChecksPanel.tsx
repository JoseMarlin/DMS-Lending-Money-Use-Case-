import { useId, useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui';
import { ChevronDownIcon } from '@/components/ui/icons';
import { KycResult, type HomeLoanApplication } from '@/data/types';
import { kycChecks, kycSummary, type KycRowStatus } from './kycChecksModel';

const ROW_TONE: Record<KycRowStatus, BadgeTone> = {
  Passed: 'success',
  Exception: 'warning',
  Failed: 'error',
  Unavailable: 'neutral',
  'Not checked': 'neutral',
};

const RESULT_TONE: Record<KycResult, BadgeTone> = {
  Pass: 'success',
  Exception: 'warning',
  Fail: 'error',
};

/** One check: its name and what the source says, its status, and a chevron that opens the values. */
function CheckRow({ label, summary, status, details }: ReturnType<typeof kycChecks>[number]) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <li className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[65px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-5 font-semibold text-ink">{label}</span>
          <span className="mt-0.5 block text-[12px] leading-4 [overflow-wrap:anywhere] text-subtle">
            {summary}
          </span>
        </span>
        <Badge tone={ROW_TONE[status]}>{status}</Badge>
        <ChevronDownIcon
          size={16}
          className={`shrink-0 text-subtle transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <dl id={detailsId} className="grid gap-x-3 gap-y-2.5 bg-white px-4 py-3">
          {details.map((detail) => (
            <div key={detail.label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3">
              <dt className="text-[12px] leading-[18px] font-medium text-subtle">{detail.label}</dt>
              <dd className="text-[13px] leading-[18px] font-semibold [overflow-wrap:anywhere] text-ink">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

/**
 * The KYC Checks tab of the side panel: the result of the checks as it was kept (see
 * kycChecksModel.ts), each check a row that opens to what was entered and what the source says.
 * Aadhaar is the masked number of the record.
 */
export default function KycChecksPanel({ application }: { application: HomeLoanApplication }) {
  const summary = kycSummary(application);
  const rows = kycChecks(application);
  return (
    <div>
      <div className="border-b border-line px-4 py-3">
        <p className="flex flex-wrap items-center gap-2 text-[13px] leading-5 text-label">
          {summary.result !== '' ? (
            <Badge tone={RESULT_TONE[summary.result]}>{summary.result}</Badge>
          ) : null}
          <span>{summary.text}</span>
        </p>
        {summary.remark ? (
          <p className="mt-2 text-[13px] leading-5 [overflow-wrap:anywhere] text-subtle">
            Remark on the exception: {summary.remark}
          </p>
        ) : null}
      </div>
      <ul aria-label="KYC checks">
        {rows.map((row) => (
          <CheckRow key={row.id} {...row} />
        ))}
      </ul>
    </div>
  );
}
