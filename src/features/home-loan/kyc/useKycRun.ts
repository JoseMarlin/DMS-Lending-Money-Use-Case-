import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/data/store';
import { ApplicationStatus } from '@/data/types';
import { verifyAadhaarOtp } from '@/services/mockKyc';
import { pendingRows, rowsFromRecord, runKyc, type KycRows } from './runKyc';

// The rows and the rules of the checks are in runKyc.ts, shared with the record sheet
export { gstApplies, rowsFromRecord, type KycRows, type RowState } from './runKyc';

export interface OtpState {
  open: boolean;
  /** The OTP is being checked */
  verifying: boolean;
  error: string | null;
  /** For example "A new OTP has been sent" */
  notice: string | null;
}

const CLOSED_OTP: OtpState = { open: false, verifying: false, error: null, notice: null };

/**
 * Runs KYC (PROJECT_OVERVIEW.md section 8) when `enabled` (the user is on Step 2) and the
 * application has no result yet. There is no button: arriving on the step starts it.
 *
 * Order: PAN, then Aadhaar (a pop-up asks for the OTP), then GST. An Unavailable source is tried
 * again up to three times. At the end the result is worked out (evaluate.ts) and written to the
 * application: statuses, names, match percent, overall result, date and retry count.
 *
 * Changing PAN, Aadhaar, GSTIN, name or date of birth later clears the result (see the store), so
 * coming back to this step runs KYC again. Leaving the step stops a run that is under way.
 */
export function useKycRun(enabled: boolean) {
  const draft = useAppStore((s) => s.draft);
  const hasResult = draft.kycOverallResult !== '';

  const [run, setRun] = useState<KycRows | null>(null);
  const [otp, setOtp] = useState<OtpState>(CLOSED_OTP);

  // Plain mutable state that is not drawn: `id` is the latest run (an older run is stale and must
  // stop), `otpWaiter` resolves with the OTP once the pop-up has accepted it.
  const controlRef = useRef({
    id: 0,
    otpWaiter: null as ((code: string | null) => void) | null,
  });

  useEffect(() => {
    if (!enabled || hasResult) return;
    const control = controlRef.current;
    const id = ++control.id;
    const isCurrent = () => control.id === id;

    async function execute() {
      const store = useAppStore.getState();
      const d = store.draft;
      const outcome = await runKyc({
        application: d,
        outage: store.kycOutage,
        isCurrent,
        onRows: setRun,
        // the pop-up asks for the OTP; the promise answers when it has been accepted
        askOtp: () => {
          setOtp({ ...CLOSED_OTP, open: true });
          return new Promise<string | null>((resolve) => {
            control.otpWaiter = resolve;
          }).finally(() => {
            control.otpWaiter = null;
          });
        },
      });
      if (!isCurrent() || !outcome) return;
      useAppStore.getState().updateDraft({
        ...outcome.patch,
        status:
          outcome.evaluation.result === 'Fail'
            ? ApplicationStatus.Draft
            : ApplicationStatus.KycDone,
      });
      setRun(null);
    }

    void execute();

    return () => {
      // leaving the step, or the result was cleared: stop this run
      control.id++;
      control.otpWaiter?.(null);
      control.otpWaiter = null;
      setRun(null);
      setOtp(CLOSED_OTP);
    };
  }, [enabled, hasResult]);

  /** The OTP pop-up's "Verify": accepts the OTP or shows why not. */
  const submitOtp = useCallback(async (code: string) => {
    setOtp((o) => ({ ...o, verifying: true, error: null, notice: null }));
    const ok = await verifyAadhaarOtp(code);
    if (!ok) {
      setOtp((o) => ({
        ...o,
        verifying: false,
        error: 'Wrong OTP. Check the code and try again.',
      }));
      return;
    }
    setOtp(CLOSED_OTP);
    controlRef.current.otpWaiter?.(code);
  }, []);

  const resendOtp = useCallback(() => {
    setOtp((o) => ({ ...o, error: null, notice: 'A new OTP has been sent.' }));
  }, []);

  const openOtp = useCallback(() => setOtp({ ...CLOSED_OTP, open: true }), []);
  const closeOtp = useCallback(() => setOtp(CLOSED_OTP), []);

  /** The "Re-run" link */
  const rerun = useCallback(() => useAppStore.getState().resetKycResult(), []);

  const running = enabled && !hasResult;
  const rows: KycRows = run ?? (hasResult ? rowsFromRecord(draft) : pendingRows(draft));

  return { rows, running, otp, submitOtp, resendOtp, openOtp, closeOtp, rerun };
}

export type KycRun = ReturnType<typeof useKycRun>;
