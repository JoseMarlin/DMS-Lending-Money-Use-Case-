/**
 * Mock KYC sources (PROJECT_OVERVIEW.md section 8). Nothing here calls anything: each function
 * waits for a fixed delay and answers from the demo data. Dummy data only.
 *
 * Outcomes come from the scenario data in src/data/seed.ts, looked up by the PAN entered:
 *   A (ABCPP1234F): everything verified, name match 100%
 *   B (ABCPD5678K): "ANITA R DESAI" against the name entered, 86% (an Exception)
 *   C (ABCPD9012L): PAN inactive (a Fail)
 * Any other PAN is treated as a clean applicant: verified, name as entered, 100%.
 *
 * A source can also be "Unavailable" (a timeout). The caller retries; see runWithRetries().
 */
import { SCENARIOS, SCENARIO_KEYS } from '@/data/seed';
import type { CheckStatus, KycOutage, ScenarioKycSource } from '@/data/types';

// ---------------------------------------------------------------------------
// Configuration. Delays are constants so they are easy to change.
// ---------------------------------------------------------------------------

export interface KycConfig {
  /** PAN check, milliseconds */
  panDelayMs: number;
  /** Aadhaar check, counted from the moment the OTP is accepted */
  aadhaarDelayMs: number;
  gstDelayMs: number;
  /** How long the OTP takes to be checked */
  otpCheckDelayMs: number;
  /** Pause before an Unavailable source is tried again */
  retryDelayMs: number;
  /** An Unavailable source is retried this many times, then counts as an Exception */
  maxRetries: number;
  /** The OTP of the demo */
  otp: string;
}

export const DEFAULT_KYC_CONFIG: Readonly<KycConfig> = {
  panDelayMs: 1500,
  aadhaarDelayMs: 2000,
  gstDelayMs: 1500,
  otpCheckDelayMs: 400,
  retryDelayMs: 1000,
  maxRetries: 3,
  otp: '123456',
};

/** The settings in use. Tests change them; the app uses the defaults. */
export const KYC_CONFIG: KycConfig = { ...DEFAULT_KYC_CONFIG };

export function resetKycConfig(): void {
  Object.assign(KYC_CONFIG, DEFAULT_KYC_CONFIG);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckOptions {
  /** 0 for the first try, 1 for the first retry, and so on */
  attempt?: number;
  outage?: KycOutage;
}

type SourceStatus = Extract<CheckStatus, 'Verified' | 'Failed' | 'Unavailable'>;

export interface PanInput {
  pan: string;
  fullName: string;
  /** ISO date as entered */
  dateOfBirth: string;
}

export interface PanResult {
  status: SourceStatus;
  /** PAN found and active at the source */
  panActive: boolean;
  nameAsPerSource: string;
  /** 0 to 100 */
  nameMatchPercent: number | null;
  /** Date of birth on the source's record, ISO */
  dateOfBirthOnRecord: string;
  dateOfBirthMatch: 'Exact' | 'Mismatch' | '';
  reference: string;
}

export interface AadhaarInput {
  /** The OTP entered. The Aadhaar number itself is never passed here. */
  otp: string;
  /** Makes the reference ID differ between applications, for example the Application ID */
  referenceSeed?: string;
}

export interface AadhaarResult {
  status: SourceStatus;
  reference: string;
}

export interface GstInput {
  gstin: string;
  pan: string;
  fullName: string;
}

export interface GstResult {
  status: SourceStatus;
  legalName: string;
  gstinStatus: 'Active' | 'Cancelled' | '';
  reference: string;
}

/** Thrown by checkAadhaar when the OTP is wrong. */
export class InvalidOtpError extends Error {
  constructor() {
    super('The OTP is not correct');
    this.name = 'InvalidOtpError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Looks like a reference from a real source, but is made up. Never contains an Aadhaar number. */
export function mockReferenceId(kind: 'PAN' | 'AAD' | 'GST', seed: string): string {
  let hash = 0;
  for (const ch of `${kind}${seed}`) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return `MOCK-${kind}-${String(hash).padStart(5, '0')}`;
}

/** The scenario whose PAN this is, if any. */
export function scenarioForPan(pan: string): ScenarioKycSource | null {
  const value = pan.trim().toUpperCase();
  const key = SCENARIO_KEYS.find((k) => SCENARIOS[k].application.pan === value);
  return key ? SCENARIOS[key].kycSource : null;
}

/** True when the source does not answer on this try. */
export function isOutage(check: 'pan' | 'aadhaar' | 'gst', attempt: number, outage: KycOutage) {
  if (outage === 'pan-down') return check === 'pan';
  if (outage === 'pan-once') return check === 'pan' && attempt === 0;
  if (outage === 'gst-down') return check === 'gst';
  return false;
}

/** The OTP is correct. */
export function isValidOtp(otp: string): boolean {
  return otp.trim() === KYC_CONFIG.otp;
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

export async function checkPan(
  input: PanInput,
  { attempt = 0, outage = 'none' }: CheckOptions = {},
): Promise<PanResult> {
  await sleep(KYC_CONFIG.panDelayMs);
  const unavailable: PanResult = {
    status: 'Unavailable',
    panActive: false,
    nameAsPerSource: '',
    nameMatchPercent: null,
    dateOfBirthOnRecord: '',
    dateOfBirthMatch: '',
    reference: '',
  };
  if (isOutage('pan', attempt, outage)) return unavailable;

  const source = scenarioForPan(input.pan);
  const nameAsPerSource = source?.panNameAsPerSource ?? input.fullName.trim().toUpperCase();
  const dateOfBirthOnRecord = source?.dateOfBirth ?? input.dateOfBirth;
  const panActive = source?.panActive ?? true;
  return {
    status: panActive ? 'Verified' : 'Failed',
    panActive,
    nameAsPerSource,
    nameMatchPercent: source?.nameMatchPercent ?? 100,
    dateOfBirthOnRecord,
    dateOfBirthMatch: input.dateOfBirth === dateOfBirthOnRecord ? 'Exact' : 'Mismatch',
    reference: mockReferenceId('PAN', input.pan),
  };
}

/**
 * Aadhaar check. It needs the OTP, and answers a fixed time after it. A wrong OTP is turned down
 * quickly with InvalidOtpError; the check then has not started.
 */
export async function checkAadhaar(
  input: AadhaarInput,
  { attempt = 0, outage = 'none' }: CheckOptions = {},
): Promise<AadhaarResult> {
  if (!isValidOtp(input.otp)) {
    await sleep(KYC_CONFIG.otpCheckDelayMs);
    throw new InvalidOtpError();
  }
  await sleep(KYC_CONFIG.aadhaarDelayMs);
  if (isOutage('aadhaar', attempt, outage)) {
    return { status: 'Unavailable', reference: '' };
  }
  return {
    status: 'Verified',
    reference: mockReferenceId('AAD', `${input.referenceSeed ?? ''}-${attempt}`),
  };
}

/** Checks the OTP on its own, so the pop-up can answer before the 2 second check starts. */
export async function verifyAadhaarOtp(otp: string): Promise<boolean> {
  await sleep(KYC_CONFIG.otpCheckDelayMs);
  return isValidOtp(otp);
}

export async function checkGst(
  input: GstInput,
  { attempt = 0, outage = 'none' }: CheckOptions = {},
): Promise<GstResult> {
  await sleep(KYC_CONFIG.gstDelayMs);
  if (isOutage('gst', attempt, outage)) {
    return { status: 'Unavailable', legalName: '', gstinStatus: '', reference: '' };
  }
  const source = scenarioForPan(input.pan);
  const gstinStatus = source ? (source.gstinStatus ?? 'Active') : 'Active';
  return {
    status: gstinStatus === 'Cancelled' ? 'Failed' : 'Verified',
    legalName: source?.gstLegalName ?? input.fullName.trim().toUpperCase(),
    gstinStatus,
    reference: mockReferenceId('GST', input.gstin),
  };
}

// ---------------------------------------------------------------------------
// Retries
// ---------------------------------------------------------------------------

export interface RetryOutcome<T> {
  result: T;
  /** How many times it was tried again (0 when the first try answered) */
  retries: number;
}

/**
 * Runs a check again while its source is Unavailable, up to maxRetries times (three), waiting
 * retryDelayMs between tries. If the source never answers, the last Unavailable result comes back
 * and the caller counts it as an Exception.
 */
export async function runWithRetries<T extends { status: string }>(
  run: (attempt: number) => Promise<T>,
  {
    onAttempt,
    onRetry,
    isCurrent = () => true,
  }: {
    /** Called before every try, with 0 for the first */
    onAttempt?: (attempt: number) => void;
    /** Called when a try found the source Unavailable and another try will follow */
    onRetry?: (retry: number) => void;
    /** Return false to stop (the user left the step) */
    isCurrent?: () => boolean;
  } = {},
): Promise<RetryOutcome<T>> {
  let retries = 0;
  onAttempt?.(0);
  let result = await run(0);
  while (result.status === 'Unavailable' && retries < KYC_CONFIG.maxRetries && isCurrent()) {
    retries += 1;
    onRetry?.(retries);
    await sleep(KYC_CONFIG.retryDelayMs);
    if (!isCurrent()) break;
    onAttempt?.(retries);
    result = await run(retries);
  }
  return { result, retries };
}
