/**
 * The KYC result rules of PROJECT_OVERVIEW.md section 8, as pure functions.
 *
 * Precedence: any Fail condition makes the result Fail; otherwise any Exception condition makes it
 * Exception; otherwise Pass.
 *
 *   Fail:      PAN not found or inactive, GST cancelled, date of birth mismatch, name match below 70%
 *   Exception: name match 70 to 94%, or a source Unavailable after three retries
 *   Pass:      all checks Verified (or Not applicable), name match at least 95%, date of birth exact
 *
 * Not in the overview, so assumed: a check that came back Failed in any other way (Aadhaar, GST)
 * also fails the result, because it is not a Pass and it is not an outage.
 */
import { KYC_THRESHOLDS } from '@/data/options';
import { CheckStatus, KycResult, type HomeLoanApplication } from '@/data/types';

export interface KycInputs {
  panStatus: CheckStatus;
  aadhaarStatus: CheckStatus;
  gstStatus: CheckStatus;
  gstinStatus: HomeLoanApplication['gstinStatus'];
  nameMatchPercent: number | null;
  dateOfBirthMatch: HomeLoanApplication['dateOfBirthMatch'];
}

export interface KycEvaluation {
  result: KycResult;
  /** Plain-language reasons, for the banner. Empty for a Pass. */
  reasons: string[];
}

const FINISHED: CheckStatus[] = [
  CheckStatus.Verified,
  CheckStatus.Failed,
  CheckStatus.Unavailable,
  CheckStatus.NotApplicable,
];

/** True when every check has an answer, so the result can be worked out. */
export function checksFinished(
  inputs: Pick<KycInputs, 'panStatus' | 'aadhaarStatus' | 'gstStatus'>,
) {
  return [inputs.panStatus, inputs.aadhaarStatus, inputs.gstStatus].every((s) =>
    FINISHED.includes(s),
  );
}

export function evaluateKyc(inputs: KycInputs): KycEvaluation {
  const { passNameMatch, failNameMatch } = KYC_THRESHOLDS;
  const name = inputs.nameMatchPercent;
  const fail: string[] = [];
  const exception: string[] = [];

  // Fail conditions
  if (inputs.panStatus === CheckStatus.Failed) fail.push('PAN is not found or is inactive');
  if (inputs.gstinStatus === 'Cancelled') fail.push('GST registration is cancelled');
  else if (inputs.gstStatus === CheckStatus.Failed) fail.push('GST check failed');
  if (inputs.aadhaarStatus === CheckStatus.Failed) fail.push('Aadhaar could not be verified');
  if (inputs.dateOfBirthMatch === 'Mismatch') fail.push('Date of birth does not match the source');
  if (name !== null && name < failNameMatch) {
    fail.push(`Name match is ${name}%, below ${failNameMatch}%`);
  }
  if (fail.length > 0) return { result: KycResult.Fail, reasons: fail };

  // Exception conditions
  if (name !== null && name < passNameMatch) {
    exception.push(`Name match is ${name}%, below ${passNameMatch}%`);
  }
  const unavailable: [string, CheckStatus][] = [
    ['PAN', inputs.panStatus],
    ['Aadhaar', inputs.aadhaarStatus],
    ['GST', inputs.gstStatus],
  ];
  unavailable.forEach(([label, status]) => {
    if (status === CheckStatus.Unavailable) {
      exception.push(`${label} source was unavailable after 3 retries`);
    }
  });
  if (exception.length > 0) return { result: KycResult.Exception, reasons: exception };

  return { result: KycResult.Pass, reasons: [] };
}

// ---------------------------------------------------------------------------
// Display helpers for the comparison table
// ---------------------------------------------------------------------------

export type Indicator = 'match' | 'partial' | 'mismatch';

/** Name match: green from 95%, amber from 70%, red below. */
export function nameIndicator(percent: number | null): Indicator {
  if (percent === null) return 'partial';
  if (percent >= KYC_THRESHOLDS.passNameMatch) return 'match';
  if (percent >= KYC_THRESHOLDS.failNameMatch) return 'partial';
  return 'mismatch';
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Two names are the same apart from case, spaces and full stops. */
export function sameName(a: string, b: string): boolean {
  return normalise(a) !== '' && normalise(a) === normalise(b);
}
