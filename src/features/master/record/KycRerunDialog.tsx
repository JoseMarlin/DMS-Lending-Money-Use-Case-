import { useEffect, useRef, useState } from 'react';
import { Button, FormField, InlineBanner, Modal, TextArea, TextInput } from '@/components/ui';
import { maskAadhaarInText } from '@/data/aadhaar';
import type { KycRerun } from '@/data/recordEdit';
import { useAppStore } from '@/data/store';
import { CheckStatus, KycResult, type HomeLoanApplication } from '@/data/types';
import { hasExceptionRemark } from '@/features/home-loan/kyc/gating';
import KycCheckRow from '@/features/home-loan/kyc/KycCheckRow';
import {
  pendingRows,
  runKyc,
  type KycOutcome,
  type KycRows,
} from '@/features/home-loan/kyc/runKyc';
import { KYC_CONFIG, verifyAadhaarOtp } from '@/services/mockKyc';

/** The OTP of the Aadhaar check, asked in the dialog itself (a second dialog would fight for the keyboard). */
function OtpForm({
  mobileLast4,
  onCode,
}: {
  mobileLast4: string;
  /** Called with the code once it has been accepted */
  onCode: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = /^\d{6}$/.test(code);

  const submit = async () => {
    if (!complete || verifying) return;
    setVerifying(true);
    setError(null);
    const ok = await verifyAadhaarOtp(code);
    setVerifying(false);
    if (ok) onCode(code);
    else setError('Wrong OTP. Check the code and try again.');
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-field border border-line bg-field-disabled px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormField
        htmlFor="record-kyc-otp"
        label={`OTP sent to the mobile number ending ${mobileLast4 || 'XXXX'}`}
        required
        error={error ?? undefined}
        helperText={error ? undefined : `Demo OTP: ${KYC_CONFIG.otp}`}
      >
        <TextInput
          id="record-kyc-otp"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6-digit OTP"
          required
          autoFocus
          invalid={Boolean(error)}
          aria-describedby="record-kyc-otp-message"
          className="tracking-[0.4em] placeholder:tracking-normal"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </FormField>
      <div>
        <Button type="submit" size="sm" disabled={!complete || verifying}>
          {verifying ? 'Verifying…' : 'Verify OTP'}
        </Button>
      </div>
    </form>
  );
}

/**
 * The checks of Step 2, run again in a compact dialog when a PAN, Aadhaar, GSTIN, name or date of
 * birth was edited (the same service, rules and OTP as the form: runKyc.ts). A Pass or an Exception
 * (which needs a remark) goes on to the save; a Fail blocks it and sends the person back to editing
 * with the reasons. The Aadhaar number is never needed: the check asks only for the OTP.
 */
export default function KycRerunDialog({
  application,
  onContinue,
  onFail,
  onStop,
}: {
  /** The record as edited (its PAN, name, date of birth, occupation and GSTIN are what is checked) */
  application: HomeLoanApplication;
  /** A Pass, or an Exception with its remark */
  onContinue: (rerun: KycRerun) => void;
  /** The result is Fail: the reasons */
  onFail: (reasons: string[]) => void;
  /** The person gave up before the end */
  onStop: () => void;
}) {
  // The dialog is built afresh for each save, so the record at the start is the one that is checked
  const [subject] = useState(application);
  const [rows, setRows] = useState<KycRows>(() => pendingRows(subject));
  const [outcome, setOutcome] = useState<KycOutcome | null>(null);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [remark, setRemark] = useState('');
  const [remarkTouched, setRemarkTouched] = useState(false);
  const waiter = useRef<((code: string | null) => void) | null>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    void runKyc({
      application: subject,
      outage: useAppStore.getState().kycOutage,
      isCurrent: () => current,
      onRows: setRows,
      askOtp: () =>
        new Promise<string | null>((resolve) => {
          waiter.current = resolve;
          setNeedsOtp(true);
        }),
    }).then((done) => {
      if (current && done) setOutcome(done);
    });
    return () => {
      // the dialog went (a save, or Back to edit): a run that is under way stops
      current = false;
      waiter.current?.(null);
      waiter.current = null;
    };
  }, [subject]);

  const result = outcome?.evaluation.result;
  const remarkMissing = result === KycResult.Exception && !hasExceptionRemark(remark);
  const stop = () =>
    result === KycResult.Fail ? onFail(outcome?.evaluation.reasons ?? []) : onStop();

  const askingOtp = needsOtp && rows.aadhaar.status === CheckStatus.OtpRequired;
  // what a screen reader is told as the checks go on (its text changes, so each step is read out)
  const progress = askingOtp
    ? `Aadhaar: enter the OTP sent to the mobile number ending ${subject.mobile.slice(-4) || 'XXXX'}.`
    : result === KycResult.Pass
      ? 'KYC result: Pass. Continue to save the changes.'
      : result === KycResult.Exception
        ? 'KYC result: Exception. Add a remark to continue.'
        : result === KycResult.Fail
          ? 'KYC result: Fail. The changes cannot be saved with this result.'
          : 'Checking the PAN, the Aadhaar and the GST.';

  const goOn = () => {
    if (!outcome || result === KycResult.Fail) return;
    if (remarkMissing) {
      setRemarkTouched(true);
      return;
    }
    onContinue({
      patch: outcome.patch,
      result: outcome.evaluation.result,
      remark: result === KycResult.Exception ? maskAadhaarInText(remark.trim()) : '',
      references: outcome.references.map((r) => ({
        source: r.source,
        status: r.status,
        reference: r.reference,
      })),
    });
  };

  return (
    <Modal
      open
      variant="panel"
      title="KYC checks"
      onClose={stop}
      footer={
        <>
          <Button variant="secondary" onClick={stop}>
            {result === KycResult.Fail ? 'Back to edit' : 'Cancel'}
          </Button>
          {result === KycResult.Pass || result === KycResult.Exception ? (
            <Button onClick={goOn}>Continue</Button>
          ) : null}
        </>
      }
    >
      <div ref={body} className="flex flex-col gap-3">
        <p className="sr-only" role="status" aria-live="polite">
          {progress}
        </p>
        <p className="text-body-m text-subtle">
          An identity field was changed, so the checks run again before the changes are saved.
        </p>
        <ul aria-label="KYC checks" className="flex flex-col gap-2">
          <KycCheckRow
            title="PAN"
            description={`PAN ${subject.pan}`}
            status={rows.pan.status}
            durationMs={rows.pan.durationMs}
            retries={rows.pan.retries}
            final={rows.pan.final}
            maxRetries={KYC_CONFIG.maxRetries}
            detail={
              outcome?.patch.panStatus === CheckStatus.Verified && outcome.patch.panNameAsPerSource
                ? `Name as per source: ${outcome.patch.panNameAsPerSource}`
                : undefined
            }
          />
          <KycCheckRow
            title="Aadhaar"
            description="Confirmed with an OTP"
            status={rows.aadhaar.status}
            durationMs={rows.aadhaar.durationMs}
            retries={rows.aadhaar.retries}
            final={rows.aadhaar.final}
            maxRetries={KYC_CONFIG.maxRetries}
            detail={
              outcome?.patch.aadhaarReference
                ? `Reference ${outcome.patch.aadhaarReference}`
                : undefined
            }
          />
          <KycCheckRow
            title="GST"
            description={
              rows.gst.status === CheckStatus.NotApplicable
                ? 'No GSTIN: the GST check is skipped'
                : `GSTIN ${subject.gstin}`
            }
            status={rows.gst.status}
            durationMs={rows.gst.durationMs}
            retries={rows.gst.retries}
            final={rows.gst.final}
            maxRetries={KYC_CONFIG.maxRetries}
          />
        </ul>

        {askingOtp ? (
          <OtpForm
            mobileLast4={subject.mobile.slice(-4)}
            onCode={(code) => {
              // the form that has the cursor goes: the cursor stays in the dialog
              body.current?.closest<HTMLElement>('[role="dialog"]')?.focus();
              setNeedsOtp(false);
              waiter.current?.(code);
              waiter.current = null;
            }}
          />
        ) : null}

        {result === KycResult.Pass ? (
          <InlineBanner variant="success" title="KYC result: Pass">
            <p>All checks are verified. Continue to save the changes.</p>
          </InlineBanner>
        ) : null}
        {result === KycResult.Exception && outcome ? (
          <>
            <InlineBanner variant="warning" title="KYC result: Exception">
              <ul className="list-disc pl-5">
                {outcome.evaluation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mt-1">You can go on once you add a remark.</p>
            </InlineBanner>
            <FormField
              htmlFor="record-kyc-remark"
              label="KYC Exception Remark"
              required
              error={remarkTouched && remarkMissing ? 'Enter a remark to continue' : undefined}
            >
              <TextArea
                id="record-kyc-remark"
                name="kycExceptionRemark"
                required
                invalid={remarkTouched && remarkMissing}
                aria-describedby="record-kyc-remark-message"
                value={remark}
                onBlur={() => setRemarkTouched(true)}
                onChange={(event) => setRemark(event.target.value)}
              />
            </FormField>
          </>
        ) : null}
        {result === KycResult.Fail && outcome ? (
          <InlineBanner variant="error" title="KYC result: Fail">
            <ul className="list-disc pl-5">
              {outcome.evaluation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-1 font-semibold">The changes cannot be saved with this result.</p>
          </InlineBanner>
        ) : null}
      </div>
    </Modal>
  );
}
