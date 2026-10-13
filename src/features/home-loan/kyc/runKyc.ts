/**
 * The KYC checks of PROJECT_OVERVIEW.md section 8 as one function, so that Step 2 of the form and
 * the record sheet (when an identity field is edited) run the very same checks: PAN, then Aadhaar
 * (an OTP is asked for), then GST, an Unavailable source tried again up to three times, and the
 * result worked out by evaluate.ts. It reads nothing and writes nothing: the caller shows the rows
 * as they change and keeps the outcome where it belongs (the draft, or the record being edited).
 */
import { toISODate } from '@/data/application';
import {
  CheckStatus,
  type HomeLoanApplication,
  type KycCheckKey,
  type KycOutage,
  type KycResult,
} from '@/data/types';
import {
  checkAadhaar,
  checkGst,
  checkPan,
  InvalidOtpError,
  KYC_CONFIG,
  runWithRetries,
} from '@/services/mockKyc';
import { evaluateKyc, type KycEvaluation } from './evaluate';

export interface RowState {
  status: CheckStatus;
  /** Retries used so far on this check (0 to 3) */
  retries: number;
  /** While Checking: how long the check takes, for the progress bar */
  durationMs: number | null;
  /**
   * For Unavailable: true once the retries are used up (it will be an Exception), false while
   * another try is still to come
   */
  final?: boolean;
}

export type KycRows = Record<KycCheckKey, RowState>;

export const PENDING: RowState = { status: CheckStatus.Pending, retries: 0, durationMs: null };
export const NOT_APPLICABLE: RowState = {
  status: CheckStatus.NotApplicable,
  retries: 0,
  durationMs: null,
};

/** GST is checked only when the form shows a GSTIN (Business or Professional) and one was entered. */
export function gstApplies(draft: Pick<HomeLoanApplication, 'occupation' | 'gstin'>): boolean {
  const asked = draft.occupation === 'Business' || draft.occupation === 'Professional';
  return asked && draft.gstin.trim() !== '';
}

/** The rows before any check has run. */
export function pendingRows(draft: Pick<HomeLoanApplication, 'occupation' | 'gstin'>): KycRows {
  return { pan: PENDING, aadhaar: PENDING, gst: gstApplies(draft) ? PENDING : NOT_APPLICABLE };
}

/** The rows as the record has them, for a result that is already there. */
export function rowsFromRecord(draft: HomeLoanApplication): KycRows {
  // An Unavailable source in a finished result has used up all its retries
  const row = (status: CheckStatus): RowState => ({
    status,
    retries: status === CheckStatus.Unavailable ? KYC_CONFIG.maxRetries : 0,
    durationMs: null,
    final: true,
  });
  return {
    pan: row(draft.panStatus),
    aadhaar: row(draft.aadhaarStatus),
    gst: gstApplies(draft) ? row(draft.gstStatus) : NOT_APPLICABLE,
  };
}

/** What a finished run gives back. */
export interface KycOutcome {
  /** The KYC fields of section 6.7, to write to the application (its status is the caller's to set) */
  patch: Pick<
    HomeLoanApplication,
    | 'panStatus'
    | 'panNameAsPerSource'
    | 'aadhaarStatus'
    | 'aadhaarReference'
    | 'gstStatus'
    | 'gstLegalName'
    | 'gstinStatus'
    | 'nameMatchPercent'
    | 'dateOfBirthMatch'
    | 'dateOfBirthAsPerSource'
    | 'kycOverallResult'
    | 'kycCheckedOn'
    | 'retryCount'
  >;
  evaluation: KycEvaluation;
  /** The mock reference IDs of the checks that ran, for the audit trail (never the Aadhaar number) */
  references: { source: 'PAN' | 'Aadhaar' | 'GST'; status: CheckStatus; reference: string }[];
}

export interface RunKycOptions {
  /** The application whose identity is checked: PAN, name, date of birth, occupation, GSTIN */
  application: Pick<
    HomeLoanApplication,
    'applicationId' | 'pan' | 'fullNameAsPerPan' | 'dateOfBirth' | 'occupation' | 'gstin'
  >;
  /** The demo's "source is down" setting */
  outage: KycOutage;
  /** Called with the rows each time one changes */
  onRows: (rows: KycRows) => void;
  /** Asks the person for the Aadhaar OTP: the code, or null when they gave up */
  askOtp: () => Promise<string | null>;
  /** Return false to stop (the person left) */
  isCurrent?: () => boolean;
  now?: Date;
}

/** Runs the checks. Gives the outcome, or null when it was stopped on the way. */
export async function runKyc({
  application: d,
  outage,
  onRows,
  askOtp,
  isCurrent = () => true,
  now = new Date(),
}: RunKycOptions): Promise<KycOutcome | null> {
  const applies = gstApplies(d);
  let rows: KycRows = pendingRows(d);
  const show = (patch: Partial<KycRows>) => {
    if (!isCurrent()) return;
    rows = { ...rows, ...patch };
    onRows(rows);
  };
  show({});

  // 1. PAN
  const pan = await runWithRetries(
    (attempt) =>
      checkPan(
        { pan: d.pan, fullName: d.fullNameAsPerPan, dateOfBirth: d.dateOfBirth },
        { attempt, outage },
      ),
    {
      isCurrent,
      onAttempt: (n) =>
        show({
          pan: { status: CheckStatus.Checking, retries: n, durationMs: KYC_CONFIG.panDelayMs },
        }),
      onRetry: (n) =>
        show({
          pan: { status: CheckStatus.Unavailable, retries: n, durationMs: null, final: false },
        }),
    },
  );
  if (!isCurrent()) return null;
  show({ pan: { status: pan.result.status, retries: pan.retries, durationMs: null, final: true } });

  // 2. Aadhaar: wait for the OTP, then check
  show({ aadhaar: { status: CheckStatus.OtpRequired, retries: 0, durationMs: null } });
  const code = await askOtp();
  if (!isCurrent() || code === null) return null;
  let aadhaar;
  try {
    aadhaar = await runWithRetries(
      (attempt) => checkAadhaar({ otp: code, referenceSeed: d.applicationId }, { attempt, outage }),
      {
        isCurrent,
        onAttempt: (n) =>
          show({
            aadhaar: {
              status: CheckStatus.Checking,
              retries: n,
              durationMs: KYC_CONFIG.aadhaarDelayMs,
            },
          }),
        onRetry: (n) =>
          show({
            aadhaar: {
              status: CheckStatus.Unavailable,
              retries: n,
              durationMs: null,
              final: false,
            },
          }),
      },
    );
  } catch (error) {
    if (!(error instanceof InvalidOtpError)) throw error;
    aadhaar = { result: { status: 'Failed' as const, reference: '' }, retries: 0 };
  }
  if (!isCurrent()) return null;
  show({
    aadhaar: {
      status: aadhaar.result.status,
      retries: aadhaar.retries,
      durationMs: null,
      final: true,
    },
  });

  // 3. GST
  let gst = null;
  if (applies) {
    gst = await runWithRetries(
      (attempt) =>
        checkGst({ gstin: d.gstin, pan: d.pan, fullName: d.fullNameAsPerPan }, { attempt, outage }),
      {
        isCurrent,
        onAttempt: (n) =>
          show({
            gst: { status: CheckStatus.Checking, retries: n, durationMs: KYC_CONFIG.gstDelayMs },
          }),
        onRetry: (n) =>
          show({
            gst: { status: CheckStatus.Unavailable, retries: n, durationMs: null, final: false },
          }),
      },
    );
    if (!isCurrent()) return null;
    show({
      gst: { status: gst.result.status, retries: gst.retries, durationMs: null, final: true },
    });
  }

  // 4. The result
  const gstStatus = gst ? gst.result.status : CheckStatus.NotApplicable;
  const evaluation = evaluateKyc({
    panStatus: pan.result.status,
    aadhaarStatus: aadhaar.result.status,
    gstStatus,
    gstinStatus: gst?.result.gstinStatus ?? '',
    nameMatchPercent: pan.result.nameMatchPercent,
    dateOfBirthMatch: pan.result.dateOfBirthMatch,
  });
  return {
    patch: {
      panStatus: pan.result.status,
      panNameAsPerSource: pan.result.nameAsPerSource,
      aadhaarStatus: aadhaar.result.status,
      aadhaarReference: aadhaar.result.reference,
      gstStatus,
      gstLegalName: gst?.result.legalName ?? '',
      gstinStatus: gst?.result.gstinStatus ?? (applies ? '' : 'Not applicable'),
      nameMatchPercent: pan.result.nameMatchPercent,
      dateOfBirthMatch: pan.result.dateOfBirthMatch,
      dateOfBirthAsPerSource: pan.result.dateOfBirthOnRecord,
      kycOverallResult: evaluation.result as KycResult,
      kycCheckedOn: toISODate(now),
      retryCount: pan.retries + aadhaar.retries + (gst?.retries ?? 0),
    },
    evaluation,
    references: [
      { source: 'PAN', status: pan.result.status, reference: pan.result.reference },
      { source: 'Aadhaar', status: aadhaar.result.status, reference: aadhaar.result.reference },
      ...(gst
        ? [{ source: 'GST' as const, status: gst.result.status, reference: gst.result.reference }]
        : []),
    ],
  };
}
