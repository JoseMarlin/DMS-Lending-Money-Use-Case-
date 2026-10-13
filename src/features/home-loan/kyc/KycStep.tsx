import { useEffect, useRef, useState } from 'react';
import { Button, FormField, InlineBanner, TextArea } from '@/components/ui';
import { useAppStore } from '@/data/store';
import { CheckStatus, KycResult } from '@/data/types';
import { KYC_CONFIG } from '@/services/mockKyc';
import { evaluateKyc } from './evaluate';
import { hasExceptionRemark } from './gating';
import KycCheckRow from './KycCheckRow';
import KycComparisonTable from './KycComparisonTable';
import OtpModal from './OtpModal';
import { type KycRun } from './useKycRun';

interface KycStepProps {
  kyc: KycRun;
  /** "Back to edit": go to Step 1 to correct the application */
  onBackToEdit: () => void;
}

/**
 * Step 2 (PROJECT_OVERVIEW.md section 8): the three checks, the comparison table, and the result
 * with what it means for the next step. Aadhaar is shown masked, as in the record.
 */
export default function KycStep({ kyc, onBackToEdit }: KycStepProps) {
  const draft = useAppStore((s) => s.draft);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const [remarkTouched, setRemarkTouched] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const otpButtonRef = useRef<HTMLButtonElement>(null);

  const done = !kyc.running && draft.kycOverallResult !== '';
  const result = draft.kycOverallResult;

  // A new result starts without the "enter a remark" error of the one before
  const [seenResult, setSeenResult] = useState(result);
  if (seenResult !== result) {
    setSeenResult(result);
    setRemarkTouched(false);
  }
  const evaluation = done
    ? evaluateKyc({
        panStatus: draft.panStatus,
        aadhaarStatus: draft.aadhaarStatus,
        gstStatus: draft.gstStatus,
        gstinStatus: draft.gstinStatus,
        nameMatchPercent: draft.nameMatchPercent,
        dateOfBirthMatch: draft.dateOfBirthMatch,
      })
    : null;

  // When the checks finish, bring the result into view
  useEffect(() => {
    if (done) resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [done]);

  // When the OTP pop-up closes, the cursor goes to where the person carries on: the "Enter OTP"
  // button if the OTP is still needed, otherwise the heading of the step
  const wasOpen = useRef(false);
  useEffect(() => {
    if (kyc.otp.open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    (otpButtonRef.current ?? headingRef.current)?.focus({ preventScroll: true });
  }, [kyc.otp.open]);

  const { rows } = kyc;
  const mobileLast4 = draft.mobile.slice(-4);
  const otpButton =
    rows.aadhaar.status === CheckStatus.OtpRequired && !kyc.otp.open ? (
      <Button ref={otpButtonRef} variant="secondary" size="sm" onClick={kyc.openOtp}>
        Enter OTP
      </Button>
    ) : undefined;

  const remarkMissing =
    result === KycResult.Exception && !hasExceptionRemark(draft.kycExceptionRemark);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="kyc-checks-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="kyc-checks-title"
            ref={headingRef}
            tabIndex={-1}
            data-step-heading
            className="text-base font-bold text-label outline-none"
          >
            Verification checks
          </h2>
          <p className="text-sm text-subtle">
            We check your PAN, Aadhaar and GST details with government sources. This starts by
            itself.
          </p>
        </div>
        <ul aria-label="KYC checks" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <KycCheckRow
            title="PAN"
            description={`PAN ${draft.pan}, checked with the Income Tax Department`}
            status={rows.pan.status}
            durationMs={rows.pan.durationMs}
            retries={rows.pan.retries}
            final={rows.pan.final}
            maxRetries={KYC_CONFIG.maxRetries}
            detail={
              draft.panStatus === CheckStatus.Verified && draft.panNameAsPerSource
                ? `Name as per source: ${draft.panNameAsPerSource}`
                : undefined
            }
          />
          <KycCheckRow
            title="Aadhaar"
            description={`Aadhaar ${draft.aadhaar || 'XXXX XXXX XXXX'}, confirmed with an OTP`}
            status={rows.aadhaar.status}
            durationMs={rows.aadhaar.durationMs}
            retries={rows.aadhaar.retries}
            final={rows.aadhaar.final}
            maxRetries={KYC_CONFIG.maxRetries}
            detail={draft.aadhaarReference ? `Reference ${draft.aadhaarReference}` : undefined}
            action={otpButton}
          />
          <KycCheckRow
            title="GST"
            description={
              rows.gst.status === CheckStatus.NotApplicable
                ? 'No GSTIN: only Business and Professional applicants have a GST check'
                : `GSTIN ${draft.gstin}, checked with the GST network`
            }
            status={rows.gst.status}
            durationMs={rows.gst.durationMs}
            retries={rows.gst.retries}
            final={rows.gst.final}
            maxRetries={KYC_CONFIG.maxRetries}
            detail={
              draft.gstStatus === CheckStatus.Verified && draft.gstLegalName
                ? `Legal name: ${draft.gstLegalName}`
                : undefined
            }
          />
        </ul>
      </section>

      {done && evaluation ? (
        <>
          <KycComparisonTable draft={draft} />

          <div ref={resultRef} className="flex flex-col gap-3">
            {result === KycResult.Pass ? (
              <InlineBanner variant="success" title="KYC result: Pass">
                <p>
                  All checks are verified, the name matches ({draft.nameMatchPercent}%) and the date
                  of birth is exact.
                </p>
              </InlineBanner>
            ) : null}

            {result === KycResult.Exception ? (
              <InlineBanner variant="warning" title="KYC result: Exception">
                <ul className="list-disc pl-5">
                  {evaluation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-1">
                  You can go on once you add a remark. Both approvers will see this exception.
                </p>
              </InlineBanner>
            ) : null}

            {result === KycResult.Fail ? (
              <InlineBanner variant="error" title="KYC result: Fail">
                <ul className="list-disc pl-5">
                  {evaluation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-1 font-semibold">Resolve the KYC result before submitting</p>
                <div className="mt-2">
                  <Button variant="secondary" size="sm" onClick={onBackToEdit}>
                    Back to edit
                  </Button>
                </div>
              </InlineBanner>
            ) : null}

            {result === KycResult.Exception ? (
              <FormField
                htmlFor="field-kycExceptionRemark"
                label="KYC Exception Remark"
                required
                error={remarkTouched && remarkMissing ? 'Enter a remark to continue' : undefined}
                helperText="Say why the application should go ahead with this exception."
              >
                <TextArea
                  id="field-kycExceptionRemark"
                  name="kycExceptionRemark"
                  required
                  invalid={remarkTouched && remarkMissing}
                  aria-describedby="field-kycExceptionRemark-message"
                  value={draft.kycExceptionRemark}
                  onBlur={() => setRemarkTouched(true)}
                  onChange={(e) => updateDraft({ kycExceptionRemark: e.target.value })}
                />
              </FormField>
            ) : null}

            <div>
              <Button variant="ghost" size="sm" onClick={kyc.rerun}>
                Re-run checks
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <OtpModal
        state={kyc.otp}
        mobileLast4={mobileLast4}
        onSubmit={(code) => void kyc.submitOtp(code)}
        onResend={kyc.resendOtp}
        onClose={kyc.closeOtp}
      />
    </div>
  );
}
