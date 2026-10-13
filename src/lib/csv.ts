/** Writing a CSV file for the Export buttons. Plain text in, a file download out. */

/** A cell that a spreadsheet would read as a formula starts with one of these. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell. Quotes, commas and line breaks are wrapped in double quotes (and inner quotes
 * doubled). A text that starts with = + - @ is prefixed with an apostrophe, so that opening the
 * file in a spreadsheet can never run it as a formula. Numbers are written as they are.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows of cells to CSV text. Lines end with CRLF, as the CSV standard says. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Starts a download of the text as a file. A byte order mark is put in front so that Excel reads
 * names in other scripts (Kannada, Devanagari) correctly.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // the browser has taken the file by now; free the link
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
