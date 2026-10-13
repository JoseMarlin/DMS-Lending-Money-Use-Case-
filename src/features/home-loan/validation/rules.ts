/**
 * Validation rules from PROJECT_OVERVIEW.md section 7. Each rule is a pure function that returns
 * the error message, or null when the value is fine. An empty value is never an error here:
 * "required" is checked separately (see validate.ts), so a rule only judges what was entered.
 *
 * Rules marked (bank) in the overview come from the bank's public Home Loan page and need the
 * bank's confirmation. All limits live in LIMITS (src/data/options.ts).
 */
import { isValidAadhaar } from '@/data/aadhaar';
import { ageOn } from '@/data/application';
import { LIMITS } from '@/data/options';
import type { HomeLoanApplication } from '@/data/types';
import { formatIndianNumber } from '@/lib/format';

// ---------------------------------------------------------------------------
// Messages (exact text from section 7, unless noted)
// ---------------------------------------------------------------------------

export const MESSAGES = {
  pan: 'Enter a valid PAN, for example ABCPP1234F',
  gstin: 'GSTIN does not match the PAN entered',
  aadhaar: 'Enter a valid 12-digit Aadhaar',
  mobile: 'Enter a valid mobile number',
  age: `Applicant age must be between ${LIMITS.minAge} and ${LIMITS.maxAge}`,
  maxLoan: `Maximum home loan is ${formatIndianNumber(LIMITS.maxLoanAmount)}`,
  tenure: `Maximum tenure is ${LIMITS.maxTenureMonths} months`,
  ownerName: "Property must be in the applicant's name",
  // Not in the overview, added so the field has something sensible to say:
  pinCode: 'Enter a valid 6-digit PIN code',
  email: 'Enter a valid email address',
} as const;

/** 'Amount exceeds 75% of the estimate. Maximum 19,50,000' */
export function eligibleAmountMessage(eligibleAmount: number): string {
  return `Amount exceeds ${LIMITS.eligiblePercent}% of the estimate. Maximum ${formatIndianNumber(eligibleAmount)}`;
}

/** 'An application for this PAN already exists: HL-2026-0003' */
export function duplicatePanMessage(applicationId: string): string {
  return `An application for this PAN already exists: ${applicationId}`;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** 5 letters, 4 digits, 1 letter, and the 4th letter is P (an individual). Capitals or not. */
export function validatePan(pan: string): string | null {
  const value = pan.trim().toUpperCase();
  if (value === '') return null;
  return PAN_FORMAT.test(value) && value[3] === 'P' ? null : MESSAGES.pan;
}

const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GST state codes: 01 to 38, 97 (other territory) and 99 (centre jurisdiction). */
export function isValidGstStateCode(code: string): boolean {
  if (!/^\d{2}$/.test(code)) return false;
  const n = Number(code);
  return (n >= 1 && n <= 38) || n === 97 || n === 99;
}

/**
 * GSTIN is 15 characters, starts with a valid state code and contains the PAN entered (positions
 * 3 to 12). The overview gives one message for all of these.
 */
export function validateGstin(gstin: string, pan: string): string | null {
  const value = gstin.trim().toUpperCase();
  if (value === '') return null;
  if (!GSTIN_FORMAT.test(value)) return MESSAGES.gstin;
  if (!isValidGstStateCode(value.slice(0, 2))) return MESSAGES.gstin;
  const enteredPan = pan.trim().toUpperCase();
  if (enteredPan !== '' && value.slice(2, 12) !== enteredPan) return MESSAGES.gstin;
  return null;
}

/** A full number as typed in the form: 12 digits that pass the Verhoeff checksum. */
export function validateAadhaar(value: string): string | null {
  if (value.trim() === '') return null;
  return isValidAadhaar(value) ? null : MESSAGES.aadhaar;
}

/**
 * The Aadhaar value kept in the record. It is masked, so the number itself cannot be checked here;
 * the form only keeps 'XXXX XXXX 1234' for a number that passed the checksum, and 'XXXX XXXX XXXX'
 * for one that did not (see maskForRecord in src/data/aadhaar.ts).
 */
export function validateMaskedAadhaar(masked: string): string | null {
  if (masked.trim() === '') return null;
  return /^XXXX XXXX \d{4}$/.test(masked) ? null : MESSAGES.aadhaar;
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/** 10 digits */
export function validateMobile(mobile: string): string | null {
  if (mobile.trim() === '') return null;
  return /^\d{10}$/.test(mobile.trim()) ? null : MESSAGES.mobile;
}

/** 6 digits */
export function validatePinCode(pin: string): string | null {
  if (pin.trim() === '') return null;
  return /^\d{6}$/.test(pin.trim()) ? null : MESSAGES.pinCode;
}

export function validateEmail(email: string): string | null {
  if (email.trim() === '') return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : MESSAGES.email;
}

// ---------------------------------------------------------------------------
// Applicant and loan
// ---------------------------------------------------------------------------

/** (bank) Age 18 to 55 on the application date. */
export function validateAge(dateOfBirth: string, applicationDate: string): string | null {
  const age = ageOn(dateOfBirth, applicationDate);
  if (age === null) return null;
  return age >= LIMITS.minAge && age <= LIMITS.maxAge ? null : MESSAGES.age;
}

/**
 * (bank) Loan Amount Requested against the Eligible Amount and the 30,00,000 cap.
 * For Construction of house the limit is 75% of the estimate, so that message comes first; any
 * other amount over 30,00,000 gets the cap message.
 */
export function validateLoanAmount(
  amount: number | null,
  context: Pick<HomeLoanApplication, 'loanPurpose' | 'eligibleAmount'>,
): string | null {
  if (amount === null || amount <= 0) return null;
  const { loanPurpose, eligibleAmount } = context;
  if (
    loanPurpose === 'Construction of house' &&
    eligibleAmount !== null &&
    eligibleAmount < LIMITS.maxLoanAmount &&
    amount > eligibleAmount
  ) {
    return eligibleAmountMessage(eligibleAmount);
  }
  return amount > LIMITS.maxLoanAmount ? MESSAGES.maxLoan : null;
}

/** (bank) At most 240 months. */
export function validateTenure(months: number | null): string | null {
  if (months === null || months <= 0) return null;
  return months > LIMITS.maxTenureMonths ? MESSAGES.tenure : null;
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** (bank) The property is in the applicant's name. Case, spaces and full stops do not matter. */
export function validateOwnerName(ownerName: string, applicantName: string): string | null {
  const owner = normaliseName(ownerName);
  const applicant = normaliseName(applicantName);
  if (owner === '' || applicant === '') return null;
  return owner === applicant ? null : MESSAGES.ownerName;
}

// ---------------------------------------------------------------------------
// Across applications
// ---------------------------------------------------------------------------

/**
 * No existing application with the same PAN. The application being filled in is left out, so a
 * saved draft of it does not count as a duplicate.
 */
export function validateDuplicatePan(
  pan: string,
  applications: Pick<HomeLoanApplication, 'applicationId' | 'pan'>[],
  ownApplicationId: string,
): string | null {
  const value = pan.trim().toUpperCase();
  if (value === '' || validatePan(value) !== null) return null;
  const existing = applications.find(
    (a) => a.applicationId !== ownApplicationId && a.pan.trim().toUpperCase() === value,
  );
  return existing ? duplicatePanMessage(existing.applicationId) : null;
}
