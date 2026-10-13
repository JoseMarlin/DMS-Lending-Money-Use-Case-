/** Addresses of the Home Loan master in the app shell. */
export const RECORD_LIST_PATH = '/metadata/master/home-loan';

/**
 * Where "View" goes for an application: the list with the record in the address
 * (/metadata/master/home-loan?record=HL-2026-0001), which opens the record sheet over it. The part of
 * the address that says which list tab is showing is kept, so closing the sheet comes back to it.
 */
export function recordSheetPath(applicationId: string, current?: URLSearchParams): string {
  const params = new URLSearchParams(current);
  params.delete('section'); // a record opens on its first tab
  params.set('record', applicationId);
  return `${RECORD_LIST_PATH}?${params.toString()}`;
}
