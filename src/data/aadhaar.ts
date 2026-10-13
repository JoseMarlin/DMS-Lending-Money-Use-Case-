/**
 * Aadhaar helpers. Rule (PROJECT_OVERVIEW.md section 2.5): the full number lives only in the form
 * input state. Everything stored, listed, logged or exported uses maskAadhaar().
 */

const MASKED_PREFIX = 'XXXX XXXX';

/**
 * Keeps only the digits of the input, at most 16 (the length of an Aadhaar Virtual ID). Allowing
 * more than 12 matters: a 13th digit must make the number invalid, not be cut off so that the first
 * 12 digits look like a valid number.
 */
export function aadhaarDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16);
}

/** Last four digits, or '' if there are fewer than four. */
export function aadhaarLast4(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

/**
 * 'XXXX XXXX 1234' for a complete 12-digit number (with or without spaces). An already masked
 * value is returned as it is, so it is safe to call more than once. A number that is incomplete
 * is not a number whose last four digits we know, so it becomes 'XXXX XXXX XXXX'.
 * Returns '' for empty input.
 */
export function maskAadhaar(value: string): string {
  if (!value.trim()) return '';
  if (isMaskedAadhaar(value)) return value;
  const digits = aadhaarDigits(value);
  return digits.length === 12 ? `${MASKED_PREFIX} ${digits.slice(-4)}` : `${MASKED_PREFIX} XXXX`;
}

/** What the record keeps for a number that is not a valid Aadhaar: no digits at all. */
export const MASKED_UNKNOWN = 'XXXX XXXX XXXX';

/**
 * The value to keep in the record for a number typed in the form. A number that passes the
 * Verhoeff checksum is kept as 'XXXX XXXX 4821'; anything else as 'XXXX XXXX XXXX', so the record
 * itself tells whether a valid number was entered even though the number is not kept.
 */
export function maskForRecord(entered: string): string {
  if (aadhaarDigits(entered) === '') return '';
  return isValidAadhaar(entered) ? maskAadhaar(entered) : MASKED_UNKNOWN;
}

/**
 * Hides a full Aadhaar number typed into free text (an address, a remark, a file name): twelve
 * digits, alone or in groups of four, with up to three spaces, hyphens, dots, underscores or
 * slashes between the groups, become 'XXXX XXXX 1234'. It also hides other twelve-digit numbers,
 * which is the safe way round.
 */
export function maskAadhaarInText(text: string): string {
  return text.replace(
    /(?<!\d)\d{4}[\s._/\\-]{0,3}\d{4}[\s._/\\-]{0,3}(\d{4})(?!\d)/g,
    (_match, last4: string) => `${MASKED_PREFIX} ${last4}`,
  );
}

/** 'XXXX XXXX 3345' from the last four digits alone (used by the seed data). */
export function maskedFromLast4(last4: string): string {
  return /^\d{4}$/.test(last4) ? `${MASKED_PREFIX} ${last4}` : `${MASKED_PREFIX} XXXX`;
}

/** True if the value is empty or already in the masked form 'XXXX XXXX 1234'. */
export function isMaskedAadhaar(value: string): boolean {
  return value === '' || /^XXXX XXXX (\d{4}|XXXX)$/.test(value);
}

/** Formats typed digits as '2345 0007 4821' for the input box. */
export function formatAadhaarInput(value: string): string {
  return (aadhaarDigits(value).match(/.{1,4}/g) ?? []).join(' ');
}

// Verhoeff checksum tables
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True if the digits pass the Verhoeff checksum (the last digit is the check digit). */
export function passesVerhoeff(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  [...digits].reverse().forEach((ch, i) => {
    c = D[c][P[i % 8][Number(ch)]];
  });
  return c === 0;
}

/** Section 7: 12 digits and a valid Verhoeff checksum. Spaces are ignored. */
export function isValidAadhaar(value: string): boolean {
  const digits = value.replace(/\s/g, '');
  return /^\d{12}$/.test(digits) && passesVerhoeff(digits);
}
