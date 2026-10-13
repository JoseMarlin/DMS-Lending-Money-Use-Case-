import { Badge } from '@/components/ui';
import type { DetailRow, DetailSection, KycBlock, LevelOneDecision } from './reviewModel';

/** One label and value, as in the design: the label on the left, the value (bold) on the right. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[42px] grid-cols-2 items-center gap-x-4 py-[11px]">
      <dt className="text-[12px] leading-4 font-medium text-label">{label}</dt>
      <dd className="text-[13px] leading-[18px] font-semibold text-ink [overflow-wrap:anywhere] whitespace-pre-line">
        {children}
      </dd>
    </div>
  );
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-3 pt-4 pb-1 text-[12px] leading-4 font-semibold text-subtle"
    >
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </h2>
  );
}

function Rows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl>
      {rows.map((row) => (
        <Row key={row.label} label={row.label}>
          {row.value}
        </Row>
      ))}
    </dl>
  );
}

/**
 * The Record Details tab: the application as label and value rows under small headings, then the
 * KYC Result block. For the Credit approver, a read-only "Level 1 decision" row comes first.
 */
export default function RecordDetails({
  sections,
  kyc,
  levelOne,
}: {
  sections: DetailSection[];
  kyc: KycBlock;
  levelOne: LevelOneDecision | null;
}) {
  return (
    <div className="px-5 pt-2 pb-10">
      {levelOne ? (
        <section
          aria-label="Level 1 decision"
          className="mt-2 rounded-card border border-primary-200 bg-primary-50 px-4"
        >
          <dl>
            <Row label="Level 1 decision">
              <span className="block">{levelOne.decision}</span>
              <span className="block text-[12px] leading-4 font-medium text-subtle">
                {levelOne.by} &middot; {levelOne.at}
              </span>
              {levelOne.comment ? (
                <span className="mt-1 block text-[12px] leading-4 text-ink">
                  {levelOne.comment}
                </span>
              ) : null}
            </Row>
          </dl>
        </section>
      ) : null}

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`details-${section.id}`}>
          <Heading id={`details-${section.id}`}>{section.title}</Heading>
          <Rows rows={section.rows} />
        </section>
      ))}

      <section aria-labelledby="details-kyc">
        <Heading id="details-kyc">KYC Result</Heading>
        <dl>
          <Row label="KYC Overall Result">
            <Badge tone={kyc.tone}>{kyc.result}</Badge>
          </Row>
          {kyc.rows.map((row) => (
            <Row key={row.label} label={row.label}>
              {row.value}
            </Row>
          ))}
          {kyc.remark ? <Row label="KYC Exception Remark">{kyc.remark}</Row> : null}
        </dl>
      </section>
    </div>
  );
}
