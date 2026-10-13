/** Display helpers. Records keep plain numbers and ISO dates; these only change how they look. */

/** 1800000 -> '18,00,000' (Indian digit grouping). null -> ''. */
export function formatIndianNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.trunc(Math.abs(value)));
  if (digits.length <= 3) return sign + digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}${rest},${lastThree}`;
}

/**
 * Text typed in a number field -> number, ignoring commas and anything that is not a digit. At
 * most 12 digits (99,999 crore): more would lose precision and be shown in exponent form.
 */
export function parseNumberInput(text: string): number | null {
  const digits = text.replace(/\D/g, '').slice(0, 12);
  return digits === '' ? null : Number(digits);
}

/** '1984-03-14' -> '14/03/1984'. Anything that is not a full ISO date -> ''. */
export function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** '14/03/1984' -> '1984-03-14'. Returns '' unless it is a real calendar date from 1900 on. */
export function displayToIso(display: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return '';
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1900) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/** While typing: keeps digits and adds the slashes, '14031984' -> '14/03/1984'. */
export function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean);
  return parts.join('/');
}

/** An ISO timestamp as '08/10/2026, 5:52 PM' in the browser's time zone. '' if not a date. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${day}/${month}/${date.getFullYear()}, ${hour12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** An ISO timestamp as '10:15 AM' (the clock of the browser's time zone). '' if not a date. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** An ISO timestamp as '15 Aug 2026, 10:15 AM' (the style of the lists in the design). '' if not a date. */
export function formatListDateTime(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const time = `${hour12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${time}`;
}

/**
 * An ISO date or timestamp as '15 Aug 2026'. '' if not a date. A date with no time ('1979-07-22') is
 * a day of the calendar, not a moment: it is written as it is, whatever the time zone of the browser.
 */
export function formatListDate(iso: string): string {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (plain) {
    const [year, month, day] = [Number(plain[1]), Number(plain[2]), Number(plain[3])];
    const real = new Date(Date.UTC(year, month - 1, day));
    return real.getUTCFullYear() === year &&
      real.getUTCMonth() === month - 1 &&
      real.getUTCDate() === day
      ? `${day} ${MONTHS[month - 1]} ${year}`
      : '';
  }
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** An ISO date or timestamp as '25 Jun, 26' (the short date of the Submission panel). '' if not a date. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${String(date.getFullYear() % 100).padStart(2, '0')}`;
}

/**
 * How long ago, in the words of the Files & Folders design: '5 Secs ago', '1 Min ago', '3 Hours
 * ago', '2 Days ago', '4 Months ago', '1 Year ago'. A time in the future is 'Just now'. '' if not a date.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (!iso || Number.isNaN(then.getTime())) return '';
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 0) return 'Just now';
  const units: [string, number][] = [
    ['Year', 365 * 86400],
    ['Month', 30 * 86400],
    ['Day', 86400],
    ['Hour', 3600],
    ['Min', 60],
  ];
  for (const [name, size] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${name}${count === 1 ? '' : 's'} ago`;
    }
  }
  const secs = Math.max(1, seconds);
  return `${secs} ${secs === 1 ? 'Sec' : 'Secs'} ago`;
}

/** 184320 -> '180 KB', 1126400 -> '1.1 MB' (units of 1024). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/** 'Priya Kulkarni' -> 'PK'. A single name uses its first two letters: 'Admin' -> 'AD'. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
