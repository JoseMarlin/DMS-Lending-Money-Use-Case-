import {
  MASKED_UNKNOWN,
  maskForRecord,
  maskedFromLast4,
  aadhaarDigits,
  aadhaarLast4,
  formatAadhaarInput,
  isMaskedAadhaar,
  isValidAadhaar,
  maskAadhaar,
  maskAadhaarInText,
  passesVerhoeff,
} from './aadhaar';

describe('maskAadhaar', () => {
  it('shows only the last four digits of a plain number', () => {
    expect(maskAadhaar('234500074821')).toBe('XXXX XXXX 4821');
  });

  it('handles a number typed with spaces or dashes', () => {
    expect(maskAadhaar('2345 0007 4821')).toBe('XXXX XXXX 4821');
    expect(maskAadhaar('2345-0007-4821')).toBe('XXXX XXXX 4821');
  });

  it('is safe to call again on a masked value', () => {
    const once = maskAadhaar('234500074821');
    expect(maskAadhaar(once)).toBe(once);
  });

  it('never leaks the first eight digits', () => {
    const masked = maskAadhaar('234500074821');
    expect(masked).not.toContain('2345');
    expect(masked).not.toContain('0007');
    expect(masked).not.toMatch(/\d{5}/);
  });

  it('returns an empty string for empty or blank input', () => {
    expect(maskAadhaar('')).toBe('');
    expect(maskAadhaar('   ')).toBe('');
  });

  it('hides everything when fewer than four digits are present', () => {
    expect(maskAadhaar('12')).toBe('XXXX XXXX XXXX');
  });

  it('does not invent a last four for an incomplete number', () => {
    expect(maskAadhaar('2345 0007')).toBe('XXXX XXXX XXXX');
    expect(maskAadhaar('2345 0007 4')).toBe('XXXX XXXX XXXX');
    expect(maskAadhaar('23450007482')).toBe('XXXX XXXX XXXX');
  });

  it('does not pass off a longer number as its first twelve digits', () => {
    // thirteen digits is not an Aadhaar number: no last four are kept
    expect(maskAadhaar('2345 0007 4821 9')).toBe('XXXX XXXX XXXX');
    expect(maskForRecord('2345 0007 4821 9')).toBe('XXXX XXXX XXXX');
  });
});

describe('maskedFromLast4', () => {
  it('builds the masked form from four digits', () => {
    expect(maskedFromLast4('3345')).toBe('XXXX XXXX 3345');
  });

  it('hides everything for anything else', () => {
    expect(maskedFromLast4('33')).toBe('XXXX XXXX XXXX');
    expect(maskedFromLast4('')).toBe('XXXX XXXX XXXX');
  });
});

describe('aadhaarLast4, aadhaarDigits, isMaskedAadhaar', () => {
  it('extracts the last four digits', () => {
    expect(aadhaarLast4('2345 0007 4821')).toBe('4821');
    expect(aadhaarLast4('XXXX XXXX 7733')).toBe('7733');
    expect(aadhaarLast4('123')).toBe('');
  });

  it('keeps only digits, at most sixteen (the length of a Virtual ID)', () => {
    expect(aadhaarDigits('2345 0007 4821 99')).toBe('23450007482199');
    expect(aadhaarDigits('2345 0007 4821 9999 77')).toBe('2345000748219999');
    expect(aadhaarDigits('ab12-34')).toBe('1234');
  });

  it('recognises masked values', () => {
    expect(isMaskedAadhaar('')).toBe(true);
    expect(isMaskedAadhaar('XXXX XXXX 4821')).toBe(true);
    expect(isMaskedAadhaar('234500074821')).toBe(false);
    expect(isMaskedAadhaar('2345 0007 4821')).toBe(false);
  });
});

describe('formatAadhaarInput', () => {
  it('groups digits in fours', () => {
    expect(formatAadhaarInput('234500074821')).toBe('2345 0007 4821');
    expect(formatAadhaarInput('23450')).toBe('2345 0');
    expect(formatAadhaarInput('')).toBe('');
  });

  it('drops non-digits and anything past sixteen digits', () => {
    expect(formatAadhaarInput('2345-0007-4821-123')).toBe('2345 0007 4821 123');
    expect(formatAadhaarInput('2345 0007 4821 9999 55')).toBe('2345 0007 4821 9999');
  });
});

describe('maskAadhaarInText', () => {
  it('hides a twelve-digit number, whether run together or in groups', () => {
    expect(maskAadhaarInText('234500074821')).toBe('XXXX XXXX 4821');
    expect(maskAadhaarInText('Aadhaar 2345 0007 4821 here')).toBe('Aadhaar XXXX XXXX 4821 here');
    expect(maskAadhaarInText('2345-0007-4821.pdf')).toBe('XXXX XXXX 4821.pdf');
  });

  it('hides a number whose groups are separated by dots, underscores, slashes or more spaces', () => {
    expect(maskAadhaarInText('Aadhaar_2345_0007_4821.pdf')).toBe('Aadhaar_XXXX XXXX 4821.pdf');
    expect(maskAadhaarInText('2345.0007.4821.jpg')).toBe('XXXX XXXX 4821.jpg');
    expect(maskAadhaarInText('2345/0007/4821')).toBe('XXXX XXXX 4821');
    expect(maskAadhaarInText('2345\\0007\\4821')).toBe('XXXX XXXX 4821');
    expect(maskAadhaarInText('2345  0007  4821')).toBe('XXXX XXXX 4821');
    expect(maskAadhaarInText('2345 - 0007 - 4821')).toBe('XXXX XXXX 4821');
    expect(maskAadhaarInText('2345\u00a00007\u00a04821')).toBe('XXXX XXXX 4821');
  });

  it('still leaves other numbers alone: a phone number, an amount, a date, a PIN', () => {
    expect(maskAadhaarInText('Mobile 9876500203, PIN 590001')).toBe(
      'Mobile 9876500203, PIN 590001',
    );
    expect(maskAadhaarInText('Loan 18,00,000 on 2026-10-09')).toBe('Loan 18,00,000 on 2026-10-09');
    expect(maskAadhaarInText('HL-2026-0001')).toBe('HL-2026-0001');
    expect(maskAadhaarInText('23450007482')).toBe('23450007482');
    expect(maskAadhaarInText('2345 0007 4821 5')).toBe('XXXX XXXX 4821 5');
  });

  it('hides every number in the text', () => {
    expect(maskAadhaarInText('234500074821 and 987654321098')).toBe(
      'XXXX XXXX 4821 and XXXX XXXX 1098',
    );
  });

  it('leaves other text alone, and is safe to run twice', () => {
    const text = 'Plot 21, Shivaji Nagar, PIN 590001, call 9876543210';
    expect(maskAadhaarInText(text)).toBe(text);
    expect(maskAadhaarInText('')).toBe('');
    const once = maskAadhaarInText('Aadhaar 234500074821');
    expect(maskAadhaarInText(once)).toBe(once);
  });

  it('does not touch a number that is longer or shorter than twelve digits', () => {
    expect(maskAadhaarInText('2345000748219')).toBe('2345000748219');
    expect(maskAadhaarInText('23450007482')).toBe('23450007482');
  });
});

describe('Verhoeff validation', () => {
  it('accepts the standard test vector and rejects a changed digit', () => {
    expect(passesVerhoeff('2363')).toBe(true);
    expect(passesVerhoeff('2364')).toBe(false);
  });

  it('accepts the dummy numbers used by scenarios A, B and C', () => {
    expect(isValidAadhaar('234500074821')).toBe(true);
    expect(isValidAadhaar('234500037733')).toBe(true);
    expect(isValidAadhaar('234500042290')).toBe(true);
  });

  it('accepts spaces in the number', () => {
    expect(isValidAadhaar('2345 0007 4821')).toBe(true);
  });

  it('rejects a wrong check digit, wrong length and non-digits', () => {
    expect(isValidAadhaar('234500074822')).toBe(false);
    expect(isValidAadhaar('23450007482')).toBe(false);
    expect(isValidAadhaar('2345000748211')).toBe(false);
    expect(isValidAadhaar('2345000748ab')).toBe(false);
    expect(isValidAadhaar('')).toBe(false);
  });
});

describe('maskForRecord', () => {
  it('keeps the last four of a valid number', () => {
    expect(maskForRecord('234500074821')).toBe('XXXX XXXX 4821');
    expect(maskForRecord('2345 0037 733')).toBe(MASKED_UNKNOWN); // 11 digits
    expect(maskForRecord('2345 0003 7733')).toBe('XXXX XXXX 7733');
  });

  it('keeps no digits of a number that fails the checksum, so the record can tell', () => {
    expect(maskForRecord('234500074822')).toBe(MASKED_UNKNOWN);
    expect(MASKED_UNKNOWN).toBe('XXXX XXXX XXXX');
  });

  it('keeps no digits of an incomplete number, and nothing when empty', () => {
    expect(maskForRecord('2345')).toBe(MASKED_UNKNOWN);
    expect(maskForRecord('23450007')).toBe(MASKED_UNKNOWN);
    expect(maskForRecord('')).toBe('');
    expect(maskForRecord('   ')).toBe('');
  });
});
