import { useState } from 'react';
import { Accordion, Badge, Button, InlineBanner, type BadgeTone } from '@/components/ui';
import { DOC_TYPES } from '@/data/options';
import { useAppStore } from '@/data/store';
import { CheckStatus, KycResult } from '@/data/types';
import { formatDateTime, formatFileSize } from '@/lib/format';
import { STEP1_SECTIONS, CONSENT_TEXT } from '../form/step1Schema';
import { kycAllowsSubmit } from '../kyc/gating';
import { buildReviewGroups } from './reviewRows';

const RESULT_TONE: Record<string, BadgeTone> = {
  [KycResult.Pass]: 'success',
  [KycResult.Exception]: 'warning',
  [KycResult.Fail]: 'error',
};

const CHECK_TONE: Record<CheckStatus, BadgeTone> = {
  [CheckStatus.Pending]: 'neutral',
  [CheckStatus.Checking]: 'info',
  [CheckStatus.Verified]: 'success',
  [CheckStatus.Failed]: 'error',
  [CheckStatus.Unavailable]: 'warning',
  [CheckStatus.OtpRequired]: 'warning',
  [CheckStatus.NotApplicable]: 'neutral',
};

/** The documents in the order of the Documents section, not the order they were chosen in. */
function inFormOrder<T extends { docType: string }>(documents: T[]): T[] {
  const rank = (docType: string) => {
    const at = (DOC_TYPES as string[]).indexOf(docType);
    return at === -1 ? DOC_TYPES.length : at;
  };
  return [...documents].sort((a, b) => rank(a.docType) - rank(b.docType));
}

/**
 * Review and submit: a read-only summary of everything entered, the KYC result, the documents and
 * the consent. Built from the form schema. Aadhaar is shown masked.
 */
export default function ReviewStep({ onBackToEdit }: { onBackToEdit: () => void }) {
  const draft = useAppStore((s) => s.draft);
  const groups = buildReviewGroups(STEP1_SECTIONS, draft);
  const [open, setOpen] = useState<Record<string, boolean>>({ [groups[0]?.id ?? '']: true });
  const allOpen = groups.every((g) => open[g.id]);

  const result = draft.kycOverallResult;
  const blocked = !kycAllowsSubmit(result, draft.kycExceptionRemark);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            tabIndex={-1}
            data-step-heading
            className="text-base font-bold text-label outline-none"
          >
            Review your application
          </h2>
          <p className="text-sm text-subtle">
            Application ID <span className="font-semibold text-ink">{draft.applicationId}</span>.
            Check the details, then submit.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(Object.fromEntries(groups.map((g) => [g.id, !allOpen])))}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>

      {blocked ? (
        <InlineBanner variant="error" title="Resolve the KYC result before submitting">
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={onBackToEdit}>
              Back to edit
            </Button>
          </div>
        </InlineBanner>
      ) : null}

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <Accordion
            key={group.id}
            id={`review-${group.id}`}
            title={group.title}
            summary={`${group.rows.length} details`}
            open={Boolean(open[group.id])}
            onToggle={() => setOpen((o) => ({ ...o, [group.id]: !o[group.id] }))}
            panelClassName="px-4 py-4"
          >
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-3">
              {group.rows.map((row) => (
                <div key={row.id} className="min-w-0">
                  <dt className="text-xs text-subtle">{row.label}</dt>
                  <dd
                    className={`text-sm break-words whitespace-pre-line ${row.empty ? 'text-subtle' : 'text-ink'}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Accordion>
        ))}
      </div>

      <section aria-labelledby="review-kyc-title" className="rounded-field border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="review-kyc-title" className="text-link-s text-label">
            KYC result
          </h3>
          {result ? (
            <Badge tone={RESULT_TONE[result] ?? 'neutral'}>{result}</Badge>
          ) : (
            <Badge>Not run</Badge>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-subtle">PAN</dt>
          <dd>
            <Badge tone={CHECK_TONE[draft.panStatus]}>{draft.panStatus}</Badge>
          </dd>
          <dt className="text-subtle">Aadhaar</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span>{draft.aadhaar}</span>
            <Badge tone={CHECK_TONE[draft.aadhaarStatus]}>{draft.aadhaarStatus}</Badge>
          </dd>
          <dt className="text-subtle">GST</dt>
          <dd>
            <Badge tone={CHECK_TONE[draft.gstStatus]}>{draft.gstStatus}</Badge>
          </dd>
          <dt className="text-subtle">Name match</dt>
          <dd>{draft.nameMatchPercent === null ? '—' : `${draft.nameMatchPercent}%`}</dd>
          <dt className="text-subtle">Date of birth</dt>
          <dd>{draft.dateOfBirthMatch || '—'}</dd>
          {draft.kycExceptionRemark ? (
            <>
              <dt className="text-subtle">KYC Exception Remark</dt>
              <dd className="break-words whitespace-pre-line">{draft.kycExceptionRemark}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="review-docs-title" className="rounded-field border border-line p-4">
        <h3 id="review-docs-title" className="text-link-s text-label">
          Documents <span className="font-normal text-subtle">({draft.documents.length})</span>
        </h3>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {inFormOrder(draft.documents).map((doc) => (
            <li key={doc.id} className="flex items-baseline justify-between gap-3">
              <span className="text-subtle">{doc.docType}</span>
              <span className="min-w-0 text-right break-words text-ink">
                {doc.fileName}{' '}
                <span className="text-xs text-subtle">{formatFileSize(doc.sizeBytes)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="review-consent-title"
        className="rounded-field border border-line p-4"
      >
        <h3 id="review-consent-title" className="text-link-s text-label">
          Consent
        </h3>
        <p className="mt-2 flex gap-2 text-sm text-ink">
          <svg
            aria-hidden
            className="mt-0.5 shrink-0 text-success"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 5 5 9-10" />
          </svg>
          <span>
            {CONSENT_TEXT}
            {draft.consentTime ? (
              <span className="block text-xs text-subtle">
                Consent Time: {formatDateTime(draft.consentTime)}
              </span>
            ) : null}
          </span>
        </p>
      </section>
    </div>
  );
}
