import {
  displayToIso,
  formatDateInput,
  formatDateTime,
  formatFileSize,
  formatIndianNumber,
  isoToDisplay,
  formatListDate,
  formatListDateTime,
  formatRelativeTime,
  formatShortDate,
  initialsOf,
  parseNumberInput,
} from './format';

describe('formatIndianNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [12345, '12,345'],
    [100000, '1,00,000'],
    [150000, '1,50,000'],
    [1800000, '18,00,000'],
    [1950000, '19,50,000'],
    [1237500, '12,37,500'],
    [3000000, '30,00,000'],
    [123456789, '12,34,56,789'],
    [-1800000, '-18,00,000'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatIndianNumber(input)).toBe(expected);
  });

  it('returns an empty string for null and non-finite values', () => {
    expect(formatIndianNumber(null)).toBe('');
    expect(formatIndianNumber(NaN)).toBe('');
  });
});

describe('parseNumberInput', () => {
  it('reads a formatted number back', () => {
    expect(parseNumberInput('18,00,000')).toBe(1800000);
    expect(parseNumberInput('₹ 1,000')).toBe(1000);
  });

  it('keeps at most twelve digits, so the number stays exact', () => {
    expect(parseNumberInput('1234567890123456')).toBe(123456789012);
    expect(Number.isSafeInteger(parseNumberInput('99999999999999999999'))).toBe(true);
  });

  it('returns null when there are no digits', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
  });
});

describe('date display', () => {
  it('converts ISO to DD/MM/YYYY and back', () => {
    expect(isoToDisplay('1984-03-14')).toBe('14/03/1984');
    expect(displayToIso('14/03/1984')).toBe('1984-03-14');
  });

  it('gives an empty string for incomplete or impossible dates', () => {
    expect(isoToDisplay('')).toBe('');
    expect(isoToDisplay('1984-03')).toBe('');
    expect(displayToIso('14/03')).toBe('');
    expect(displayToIso('31/02/2026')).toBe('');
    expect(displayToIso('00/01/2026')).toBe('');
    expect(displayToIso('14/13/2026')).toBe('');
    expect(displayToIso('14/03/1800')).toBe('');
  });

  it('accepts 29 February only in a leap year', () => {
    expect(displayToIso('29/02/2024')).toBe('2024-02-29');
    expect(displayToIso('29/02/2026')).toBe('');
  });

  it('adds slashes while typing', () => {
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('14')).toBe('14');
    expect(formatDateInput('140')).toBe('14/0');
    expect(formatDateInput('1403')).toBe('14/03');
    expect(formatDateInput('14031')).toBe('14/03/1');
    expect(formatDateInput('14031984')).toBe('14/03/1984');
    expect(formatDateInput('14/03/1984')).toBe('14/03/1984');
    expect(formatDateInput('140319841234')).toBe('14/03/1984');
    expect(formatDateInput('ab')).toBe('');
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [900, '900 B'],
    [1024, '1 KB'],
    [184_320, '180 KB'],
    [98_304, '96 KB'],
    [1_126_400, '1.1 MB'],
    [2_150_400, '2.1 MB'],
    [5 * 1024 * 1024, '5 MB'],
    [12 * 1024 * 1024, '12 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it('returns an empty string for a bad size', () => {
    expect(formatFileSize(-1)).toBe('');
    expect(formatFileSize(NaN)).toBe('');
  });
});

describe('formatDateTime', () => {
  it('shows DD/MM/YYYY and a 12-hour time', () => {
    expect(formatDateTime(new Date(2026, 9, 8, 17, 52).toISOString())).toBe('08/10/2026, 5:52 PM');
    expect(formatDateTime(new Date(2026, 0, 2, 0, 5).toISOString())).toBe('02/01/2026, 12:05 AM');
    expect(formatDateTime(new Date(2026, 0, 2, 12, 0).toISOString())).toBe('02/01/2026, 12:00 PM');
    expect(formatDateTime(new Date(2026, 0, 2, 9, 7).toISOString())).toBe('02/01/2026, 9:07 AM');
  });

  it('returns an empty string when there is no valid time', () => {
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime('not a date')).toBe('');
  });
});

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Priya Kulkarni')).toBe('PK');
    expect(initialsOf('Mahesh Joshi')).toBe('MJ');
    expect(initialsOf('Sunita Hegde')).toBe('SH');
  });

  it('uses the first two letters of a single name', () => {
    expect(initialsOf('Admin')).toBe('AD');
    expect(initialsOf('x')).toBe('X');
  });

  it('ignores extra spaces and uses capitals', () => {
    expect(initialsOf('  ramesh   k  patil ')).toBe('RK');
  });

  it('gives nothing for an empty name', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf('   ')).toBe('');
  });
});

describe('list dates', () => {
  it('writes a date and time as in the design: 15 Aug 2026, 10:15 AM', () => {
    expect(formatListDateTime('2026-08-15T10:15:00')).toBe('15 Aug 2026, 10:15 AM');
    expect(formatListDateTime('2026-09-02T00:05:00')).toBe('2 Sep 2026, 12:05 AM');
    expect(formatListDateTime('2026-09-02T12:00:00')).toBe('2 Sep 2026, 12:00 PM');
    expect(formatListDateTime('2026-09-02T23:59:00')).toBe('2 Sep 2026, 11:59 PM');
  });

  it('writes a date alone as 26 Aug 2026', () => {
    expect(formatListDate('2026-08-26T15:00:00')).toBe('26 Aug 2026');
    expect(formatListDate('2026-08-26')).toBe('26 Aug 2026');
  });

  it('gives nothing for a value that is not a date', () => {
    expect(formatListDateTime('')).toBe('');
    expect(formatListDateTime('soon')).toBe('');
    expect(formatListDate('')).toBe('');
    expect(formatListDate('soon')).toBe('');
  });
});

describe('formatShortDate', () => {
  it('writes the short date of the Submission panel: 25 Jun, 26', () => {
    expect(formatShortDate('2026-06-25T15:00:00')).toBe('25 Jun, 26');
    expect(formatShortDate('2026-10-05T09:00:00')).toBe('5 Oct, 26');
  });

  it('keeps two digits for the year, with a leading zero', () => {
    expect(formatShortDate('2005-01-09T09:00:00')).toBe('9 Jan, 05');
  });

  it('gives nothing for a value that is not a date', () => {
    expect(formatShortDate('')).toBe('');
    expect(formatShortDate('soon')).toBe('');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it('counts seconds, minutes, hours, days, months and years, with the unit in capitals as in the design', () => {
    expect(formatRelativeTime(ago(5), now)).toBe('5 Secs ago');
    expect(formatRelativeTime(ago(59), now)).toBe('59 Secs ago');
    expect(formatRelativeTime(ago(60), now)).toBe('1 Min ago');
    expect(formatRelativeTime(ago(25 * 60), now)).toBe('25 Mins ago');
    expect(formatRelativeTime(ago(3600), now)).toBe('1 Hour ago');
    expect(formatRelativeTime(ago(5 * 3600), now)).toBe('5 Hours ago');
    expect(formatRelativeTime(ago(86400), now)).toBe('1 Day ago');
    expect(formatRelativeTime(ago(12 * 86400), now)).toBe('12 Days ago');
    expect(formatRelativeTime(ago(30 * 86400), now)).toBe('1 Month ago');
    expect(formatRelativeTime(ago(140 * 86400), now)).toBe('4 Months ago');
    expect(formatRelativeTime(ago(365 * 86400), now)).toBe('1 Year ago');
    expect(formatRelativeTime(ago(800 * 86400), now)).toBe('2 Years ago');
  });

  it('says 1 Sec at the least, and Just now for a time that has not come yet', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('1 Sec ago');
    expect(formatRelativeTime(ago(1), now)).toBe('1 Sec ago');
    expect(formatRelativeTime(ago(-30), now)).toBe('Just now');
  });

  it('gives nothing for a value that is not a date', () => {
    expect(formatRelativeTime('', now)).toBe('');
    expect(formatRelativeTime('soon', now)).toBe('');
  });
});

describe('formatListDate for a date without a time', () => {
  it('writes the calendar day as it is, with no time zone in it', () => {
    expect(formatListDate('1979-07-22')).toBe('22 Jul 1979');
    expect(formatListDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatListDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('gives nothing for a day that is not on the calendar', () => {
    expect(formatListDate('2026-02-31')).toBe('');
    expect(formatListDate('2026-13-01')).toBe('');
    expect(formatListDate('2026-00-10')).toBe('');
  });

  it('is not moved by a time zone west of UTC, where midnight UTC is the evening before', () => {
    // 1979-07-22T00:00Z read in New York is the 21st; the plain date must not be read that way
    const getDate = vi.spyOn(Date.prototype, 'getDate').mockReturnValue(21);
    try {
      expect(formatListDate('1979-07-22')).toBe('22 Jul 1979');
    } finally {
      getDate.mockRestore();
    }
  });
});
