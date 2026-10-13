/**
 * The rows of the KYC Checks panel of the record sheet, worked out from what the application stores
 * (the PAN, Aadhaar and GST statuses, the name match, the date of birth match, the source values).
 * Nothing is looked up again: this is the result that was kept when the checks ran. Aadhaar is the
 * masked number the record holds, never more.
 */
import { KYC_THRESHOLDS } from '@/data/options';
import { CheckStatus, KycResult, type HomeLoanApplication } from '@/data/types';
import { formatListDate, isoToDisplay } from '@/lib/format';
import { validateMaskedAadhaar, validatePan } from '@/features/home-loan/validation/rules';

export type KycRowStatus = 'Passed' | 'Exception' | 'Failed' | 'Unavailable' | 'Not checked';

export type KycCheckId =
  | 'pan-format'
  | 'pan-active'
  | 'aadhaar-valid'
  | 'aadhaar-authentication'
  | 'gst-active'
  | 'name-match'
  | 'dob-match'
  | 'pan-aadhaar-link';

export interface KycDetail {
  label: string;
  value: string;
}

export interface KycCheckRow {
  id: KycCheckId;
  label: string;
  status: KycRowStatus;
  /** One line under the name: what the source says, so a closed row already says something */
  summary: string;
  /** What was entered and what the source says, shown when the row is opened */
  details: KycDetail[];
}

const DASH = '-';
const show = (value: string): string => (value.trim() === '' ? DASH : value);

/** The status of one source check: its answer, or that it was not run (still Pending, or not started). */
function sourceStatus(status: CheckStatus): KycRowStatus {
  switch (status) {
    case CheckStatus.Verified:
      return 'Passed';
    case CheckStatus.Failed:
      return 'Failed';
    case CheckStatus.Unavailable:
      return 'Unavailable';
    default:
      return 'Not checked';
  }
}

const sourceWords = (status: CheckStatus, ok: string, bad: string): string => {
  if (status === CheckStatus.Verified) return ok;
  if (status === CheckStatus.Failed) return bad;
  if (status === CheckStatus.Unavailable) return 'Not available (the source did not answer)';
  return 'Not checked yet';
};

/** The same words for the line under the name of a row: short, with no explanation. */
const shortWords = (status: CheckStatus, ok: string, bad: string): string => {
  if (status === CheckStatus.Verified) return ok;
  if (status === CheckStatus.Failed) return bad;
  if (status === CheckStatus.Unavailable) return 'Source not available';
  return 'Not checked yet';
};

const dobSummary = (match: HomeLoanApplication['dateOfBirthMatch']): string =>
  match === 'Exact'
    ? 'Same as the source'
    : match === 'Mismatch'
      ? 'Different from the source'
      : 'Not checked yet';

const linkSummary = (pair: CheckStatus[]): string =>
  pair.includes(CheckStatus.Failed)
    ? 'Not linked'
    : pair.includes(CheckStatus.Unavailable)
      ? 'Source not available'
      : pair.every((s) => s === CheckStatus.Verified)
        ? 'Linked'
        : 'Not checked yet';

/** Whether the application has a GSTIN to check: the row of the GST check is there only then. */
export function gstApplies(application: HomeLoanApplication): boolean {
  return application.gstin.trim() !== '' && application.gstStatus !== CheckStatus.NotApplicable;
}

/** The checks of an application, in the order of the panel. The GST one is left out when there is no GSTIN. */
export function kycChecks(application: HomeLoanApplication): KycCheckRow[] {
  const a = application;
  const rows: KycCheckRow[] = [];
  const pan = a.pan.trim().toUpperCase();
  const aadhaar = a.aadhaar.trim();

  // PAN format: the form refuses a wrong one, so this is a check of what is stored
  rows.push({
    id: 'pan-format',
    label: 'PAN format',
    status: pan === '' ? 'Not checked' : validatePan(pan) === null ? 'Passed' : 'Failed',
    summary: show(pan),
    details: [
      { label: 'PAN entered', value: show(pan) },
      { label: 'Expected', value: '5 letters, 4 digits and a letter; the 4th letter is P' },
    ],
  });

  rows.push({
    id: 'pan-active',
    label: 'PAN active',
    status: sourceStatus(a.panStatus),
    summary: shortWords(a.panStatus, 'Active', 'Not found or inactive'),
    details: [
      { label: 'PAN entered', value: show(pan) },
      {
        label: 'As per source',
        value: sourceWords(a.panStatus, 'Active', 'Not found or inactive'),
      },
    ],
  });

  rows.push({
    id: 'aadhaar-valid',
    label: 'Aadhaar valid',
    // the form keeps 'XXXX XXXX 1234' for a number that passed the check and 'XXXX XXXX XXXX' for one that did not
    status:
      aadhaar === ''
        ? 'Not checked'
        : validateMaskedAadhaar(aadhaar) === null
          ? 'Passed'
          : 'Failed',
    summary:
      aadhaar !== '' && validateMaskedAadhaar(aadhaar) !== null
        ? 'Not a valid number'
        : show(aadhaar),
    details: [
      { label: 'Aadhaar entered', value: show(aadhaar) },
      {
        label: 'Expected',
        value: '12 digits with a correct check digit (checked when it was entered)',
      },
    ],
  });

  rows.push({
    id: 'aadhaar-authentication',
    label: 'Aadhaar authentication',
    status: sourceStatus(a.aadhaarStatus),
    summary: shortWords(a.aadhaarStatus, 'Authenticated by OTP', 'Not authenticated'),
    details: [
      { label: 'Aadhaar entered', value: show(aadhaar) },
      {
        label: 'As per source',
        value: sourceWords(a.aadhaarStatus, 'Authenticated by OTP', 'Not authenticated'),
      },
      { label: 'Reference ID', value: show(a.aadhaarReference) },
    ],
  });

  if (gstApplies(a)) {
    const cancelled = a.gstinStatus === 'Cancelled';
    rows.push({
      id: 'gst-active',
      label: 'GST active',
      status: cancelled ? 'Failed' : sourceStatus(a.gstStatus),
      summary: cancelled
        ? 'Registration cancelled'
        : shortWords(a.gstStatus, 'Registration active', 'Not found'),
      details: [
        { label: 'GSTIN entered', value: show(a.gstin) },
        {
          label: 'As per source',
          value: cancelled
            ? 'Registration cancelled'
            : sourceWords(a.gstStatus, 'Registration active', 'Not found'),
        },
        { label: 'Legal name as per source', value: show(a.gstLegalName) },
      ],
    });
  }

  const percent = a.nameMatchPercent;
  const { passNameMatch, failNameMatch } = KYC_THRESHOLDS;
  const panUnavailable = sourceStatus(a.panStatus) === 'Unavailable';
  const nameStatus: KycRowStatus =
    percent === null
      ? panUnavailable
        ? 'Unavailable'
        : 'Not checked'
      : percent >= passNameMatch
        ? 'Passed'
        : percent >= failNameMatch
          ? 'Exception'
          : 'Failed';
  rows.push({
    id: 'name-match',
    label: 'Name match percent',
    status: nameStatus,
    summary:
      percent !== null
        ? `${percent}% match`
        : nameStatus === 'Unavailable'
          ? 'Source not available'
          : 'Not checked yet',
    details: [
      { label: 'Name entered', value: show(a.fullNameAsPerPan) },
      { label: 'As per source', value: show(a.panNameAsPerSource) },
      { label: 'Match', value: percent === null ? DASH : `${percent}%` },
      {
        label: 'Rule',
        value: `Passes at ${passNameMatch}% or more, is an exception from ${failNameMatch}%, fails below`,
      },
    ],
  });

  const dobSource =
    a.dateOfBirthAsPerSource || (a.dateOfBirthMatch === 'Exact' ? a.dateOfBirth : '');
  const dobStatus: KycRowStatus =
    a.dateOfBirthMatch === 'Exact'
      ? 'Passed'
      : a.dateOfBirthMatch === 'Mismatch'
        ? 'Failed'
        : panUnavailable
          ? 'Unavailable'
          : 'Not checked';
  rows.push({
    id: 'dob-match',
    label: 'Date of birth match',
    status: dobStatus,
    summary: dobStatus === 'Unavailable' ? 'Source not available' : dobSummary(a.dateOfBirthMatch),
    details: [
      { label: 'Date of birth entered', value: show(isoToDisplay(a.dateOfBirth)) },
      { label: 'As per source', value: show(isoToDisplay(dobSource)) },
    ],
  });

  // The link of the PAN to the Aadhaar is what the two sources say together: it is as sure as they are
  const pair = [a.panStatus, a.aadhaarStatus];
  rows.push({
    id: 'pan-aadhaar-link',
    label: 'PAN and Aadhaar link',
    status: pair.includes(CheckStatus.Failed)
      ? 'Failed'
      : pair.includes(CheckStatus.Unavailable)
        ? 'Unavailable'
        : pair.every((s) => s === CheckStatus.Verified)
          ? 'Passed'
          : 'Not checked',
    summary: linkSummary(pair),
    details: [
      { label: 'PAN entered', value: show(pan) },
      { label: 'Aadhaar entered', value: show(aadhaar) },
      {
        label: 'As per source',
        value: pair.includes(CheckStatus.Failed)
          ? 'Not linked'
          : pair.includes(CheckStatus.Unavailable)
            ? 'Not available (a source did not answer)'
            : pair.every((s) => s === CheckStatus.Verified)
              ? 'Linked'
              : 'Not checked yet',
      },
    ],
  });

  return rows;
}

export interface KycSummary {
  /** The overall result, or '' before the checks have run */
  result: KycResult | '';
  /** The line under the title: what the result is and when it came */
  text: string;
  /** The remark of an exception that went on with one */
  remark: string;
}

/** The result of the checks as a whole, from the stored result. */
export function kycSummary(application: HomeLoanApplication): KycSummary {
  const { kycOverallResult: result, kycCheckedOn, kycExceptionRemark } = application;
  if (result === '') {
    return {
      result,
      text: 'The KYC checks have not been run for this application yet.',
      remark: '',
    };
  }
  const on = kycCheckedOn ? ` on ${formatListDate(kycCheckedOn)}` : '';
  return {
    result,
    text: `KYC result: ${result}, checked${on}.`,
    remark: result === KycResult.Exception ? kycExceptionRemark.trim() : '',
  };
}
