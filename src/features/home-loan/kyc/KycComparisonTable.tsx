import type { ReactNode } from 'react';
import { CheckStatus, type HomeLoanApplication } from '@/data/types';
import { isoToDisplay } from '@/lib/format';
import { nameIndicator, sameName, type Indicator } from './evaluate';

const INDICATOR_STYLE: Record<Indicator, { text: string; icon: ReactNode }> = {
  match: {
    text: 'text-success',
    icon: <path d="m5 12 5 5 9-10" />,
  },
  partial: {
    text: 'text-warning',
    icon: (
      <>
        <path d="M12 4 3 20h18L12 4Z" />
        <path d="M12 10v4M12 17v.01" />
      </>
    ),
  },
  mismatch: {
    text: 'text-error-text',
    icon: <path d="M6 6l12 12M18 6 6 18" />,
  },
};

/** Green tick, amber warning or red cross, with words so colour is not the only signal. */
function MatchCell({ indicator, children }: { indicator: Indicator; children: ReactNode }) {
  const style = INDICATOR_STYLE[indicator];
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${style.text}`}>
      <svg
        aria-hidden
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {style.icon}
      </svg>
      {children}
    </span>
  );
}

interface Row {
  label: string;
  entered: ReactNode;
  source: ReactNode;
  match: ReactNode;
}

function rowsFor(draft: HomeLoanApplication): Row[] {
  const rows: Row[] = [];

  const percent = draft.nameMatchPercent;
  rows.push({
    label: 'Name',
    entered: draft.fullNameAsPerPan,
    source: draft.panNameAsPerSource || '—',
    match:
      percent === null ? (
        <MatchCell indicator="partial">Not available</MatchCell>
      ) : (
        <MatchCell indicator={nameIndicator(percent)}>{percent}% match</MatchCell>
      ),
  });

  const dobSource =
    draft.dateOfBirthAsPerSource || (draft.dateOfBirthMatch === 'Exact' ? draft.dateOfBirth : '');
  rows.push({
    label: 'Date of birth',
    entered: isoToDisplay(draft.dateOfBirth),
    source: isoToDisplay(dobSource) || '—',
    match:
      draft.dateOfBirthMatch === 'Exact' ? (
        <MatchCell indicator="match">Exact</MatchCell>
      ) : draft.dateOfBirthMatch === 'Mismatch' ? (
        <MatchCell indicator="mismatch">Mismatch</MatchCell>
      ) : (
        <MatchCell indicator="partial">Not available</MatchCell>
      ),
  });

  rows.push({
    label: 'PAN status',
    entered: draft.pan,
    source:
      draft.panStatus === CheckStatus.Verified
        ? 'Active'
        : draft.panStatus === CheckStatus.Failed
          ? 'Inactive'
          : 'Not available',
    match:
      draft.panStatus === CheckStatus.Verified ? (
        <MatchCell indicator="match">Verified</MatchCell>
      ) : draft.panStatus === CheckStatus.Failed ? (
        <MatchCell indicator="mismatch">Failed</MatchCell>
      ) : (
        <MatchCell indicator="partial">Unavailable</MatchCell>
      ),
  });

  if (draft.gstStatus === CheckStatus.NotApplicable || draft.gstin === '') {
    rows.push({
      label: 'GST legal name',
      entered: '—',
      source: '—',
      match: <span className="text-subtle">Not applicable</span>,
    });
  } else {
    const matches = sameName(draft.fullNameAsPerPan, draft.gstLegalName);
    rows.push({
      label: 'GST legal name',
      entered: draft.fullNameAsPerPan,
      source: draft.gstLegalName || '—',
      match:
        draft.gstStatus === CheckStatus.Unavailable ? (
          <MatchCell indicator="partial">Unavailable</MatchCell>
        ) : draft.gstinStatus === 'Cancelled' ? (
          <MatchCell indicator="mismatch">Cancelled</MatchCell>
        ) : matches ? (
          <MatchCell indicator="match">Match</MatchCell>
        ) : (
          <MatchCell indicator="partial">Check</MatchCell>
        ),
    });
  }
  return rows;
}

/** After the checks: what was entered against what the sources say, with a match mark for each. */
export default function KycComparisonTable({ draft }: { draft: HomeLoanApplication }) {
  return (
    <section aria-labelledby="kyc-compare-title" className="flex flex-col gap-3">
      <h2 id="kyc-compare-title" className="text-base font-bold text-label">
        Entered against as per source
      </h2>
      <div className="overflow-hidden rounded-field border border-line">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-field-disabled text-xs text-subtle">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                <span className="sr-only">Detail</span>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Entered
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                As per source
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Match
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsFor(draft).map((row) => (
              <tr key={row.label} className="border-t border-line align-top">
                <th scope="row" className="px-3 py-2.5 text-link-s text-label">
                  {row.label}
                </th>
                <td className="px-3 py-2.5 [overflow-wrap:anywhere] text-ink">{row.entered}</td>
                <td className="px-3 py-2.5 [overflow-wrap:anywhere] text-ink">{row.source}</td>
                <td className="px-3 py-2.5">{row.match}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
