import { SCENARIOS } from '@/data/seed';
import { CheckStatus, KycResult } from '@/data/types';
import { checksFinished, evaluateKyc, nameIndicator, sameName, type KycInputs } from './evaluate';
import { hasExceptionRemark, kycAllowsSubmit } from './gating';

/** The inputs of a clean applicant (scenario A, which has a GSTIN) */
const clean: KycInputs = {
  panStatus: CheckStatus.Verified,
  aadhaarStatus: CheckStatus.Verified,
  gstStatus: CheckStatus.Verified,
  gstinStatus: 'Active',
  nameMatchPercent: 100,
  dateOfBirthMatch: 'Exact',
};
const salaried: KycInputs = { ...clean, gstStatus: CheckStatus.NotApplicable, gstinStatus: '' };
const input = (patch: Partial<KycInputs>): KycInputs => ({ ...clean, ...patch });

describe('evaluateKyc: Pass', () => {
  it('scenario A: everything verified, 100%, exact date of birth', () => {
    expect(evaluateKyc(clean)).toEqual({ result: 'Pass', reasons: [] });
  });

  it('a salaried applicant passes with GST Not applicable', () => {
    expect(evaluateKyc(salaried).result).toBe(KycResult.Pass);
  });

  it('a name match of exactly 95% passes', () => {
    expect(evaluateKyc(input({ nameMatchPercent: 95 })).result).toBe('Pass');
  });
});

describe('evaluateKyc: Exception', () => {
  it('scenario B: 86% is an Exception', () => {
    const b = SCENARIOS.B.kycSource;
    const evaluation = evaluateKyc({ ...salaried, nameMatchPercent: b.nameMatchPercent });
    expect(evaluation.result).toBe('Exception');
    expect(evaluation.reasons).toEqual(['Name match is 86%, below 95%']);
  });

  it.each([94, 90, 86, 70])('a name match of %i%% is an Exception', (percent) => {
    expect(evaluateKyc(input({ nameMatchPercent: percent })).result).toBe('Exception');
  });

  it('a source that is Unavailable after the retries is an Exception, whichever it is', () => {
    const pan = evaluateKyc(
      input({ panStatus: CheckStatus.Unavailable, nameMatchPercent: null, dateOfBirthMatch: '' }),
    );
    expect(pan.result).toBe('Exception');
    expect(pan.reasons).toEqual(['PAN source was unavailable after 3 retries']);
    expect(evaluateKyc(input({ gstStatus: CheckStatus.Unavailable })).reasons).toEqual([
      'GST source was unavailable after 3 retries',
    ]);
    expect(evaluateKyc(input({ aadhaarStatus: CheckStatus.Unavailable })).result).toBe('Exception');
  });

  it('never rejects on Unavailable alone', () => {
    expect(evaluateKyc(input({ gstStatus: CheckStatus.Unavailable })).result).not.toBe('Fail');
  });

  it('lists every exception reason', () => {
    const evaluation = evaluateKyc(
      input({ nameMatchPercent: 80, gstStatus: CheckStatus.Unavailable }),
    );
    expect(evaluation.reasons).toHaveLength(2);
  });
});

describe('evaluateKyc: Fail', () => {
  it('scenario C: PAN inactive is a Fail', () => {
    const evaluation = evaluateKyc({
      ...salaried,
      panStatus: CheckStatus.Failed,
      nameMatchPercent: SCENARIOS.C.kycSource.nameMatchPercent,
    });
    expect(evaluation).toEqual({ result: 'Fail', reasons: ['PAN is not found or is inactive'] });
  });

  it('GST cancelled is a Fail', () => {
    const evaluation = evaluateKyc(
      input({ gstStatus: CheckStatus.Failed, gstinStatus: 'Cancelled' }),
    );
    expect(evaluation).toEqual({ result: 'Fail', reasons: ['GST registration is cancelled'] });
  });

  it('a date of birth mismatch is a Fail', () => {
    expect(evaluateKyc(input({ dateOfBirthMatch: 'Mismatch' }))).toEqual({
      result: 'Fail',
      reasons: ['Date of birth does not match the source'],
    });
  });

  it.each([69, 50, 0])('a name match of %i%% is a Fail', (percent) => {
    const evaluation = evaluateKyc(input({ nameMatchPercent: percent }));
    expect(evaluation.result).toBe('Fail');
    expect(evaluation.reasons).toEqual([`Name match is ${percent}%, below 70%`]);
  });

  it('any other failed check also fails the result (assumption)', () => {
    expect(evaluateKyc(input({ aadhaarStatus: CheckStatus.Failed })).result).toBe('Fail');
    expect(evaluateKyc(input({ gstStatus: CheckStatus.Failed })).result).toBe('Fail');
  });
});

describe('evaluateKyc: precedence (Fail, then Exception, then Pass)', () => {
  it('a Fail condition wins over an Exception condition', () => {
    const evaluation = evaluateKyc(
      input({
        panStatus: CheckStatus.Failed,
        nameMatchPercent: 80,
        gstStatus: CheckStatus.Unavailable,
      }),
    );
    expect(evaluation.result).toBe('Fail');
    expect(evaluation.reasons).toEqual(['PAN is not found or is inactive']);
  });

  it('a Fail name match wins over an unavailable source', () => {
    expect(
      evaluateKyc(input({ nameMatchPercent: 60, gstStatus: CheckStatus.Unavailable })).result,
    ).toBe('Fail');
  });

  it('an Exception wins over a Pass', () => {
    expect(evaluateKyc(input({ nameMatchPercent: 94 })).result).toBe('Exception');
  });

  it('lists all Fail reasons together', () => {
    const evaluation = evaluateKyc(
      input({ panStatus: CheckStatus.Failed, dateOfBirthMatch: 'Mismatch', nameMatchPercent: 40 }),
    );
    expect(evaluation.reasons).toHaveLength(3);
  });
});

describe('checksFinished', () => {
  it('is true once every check has an answer', () => {
    expect(checksFinished(clean)).toBe(true);
    expect(checksFinished(salaried)).toBe(true);
    expect(checksFinished(input({ gstStatus: CheckStatus.Unavailable }))).toBe(true);
  });

  it('is false while something is pending, running or waiting for the OTP', () => {
    expect(checksFinished(input({ panStatus: CheckStatus.Pending }))).toBe(false);
    expect(checksFinished(input({ aadhaarStatus: CheckStatus.OtpRequired }))).toBe(false);
    expect(checksFinished(input({ gstStatus: CheckStatus.Checking }))).toBe(false);
  });
});

describe('match indicators', () => {
  it('name match: green from 95, amber from 70, red below', () => {
    expect(nameIndicator(100)).toBe('match');
    expect(nameIndicator(95)).toBe('match');
    expect(nameIndicator(94)).toBe('partial');
    expect(nameIndicator(86)).toBe('partial');
    expect(nameIndicator(70)).toBe('partial');
    expect(nameIndicator(69)).toBe('mismatch');
    expect(nameIndicator(null)).toBe('partial');
  });

  it('two names are the same apart from case, spaces and full stops', () => {
    expect(sameName('Ramesh Patil', 'RAMESH PATIL')).toBe(true);
    expect(sameName('Anita R. Desai', 'ANITA R DESAI')).toBe(true);
    expect(sameName('Anita Desai', 'ANITA R DESAI')).toBe(false);
    expect(sameName('', '')).toBe(false);
  });
});

describe('gating: who can go on to review and submit', () => {
  it('Pass can, without a remark', () => {
    expect(kycAllowsSubmit('Pass', '')).toBe(true);
  });

  it('an Exception can only with a remark', () => {
    expect(kycAllowsSubmit('Exception', '')).toBe(false);
    expect(kycAllowsSubmit('Exception', '   ')).toBe(false);
    expect(kycAllowsSubmit('Exception', 'Same person, middle initial missing')).toBe(true);
  });

  it('a Fail never can, even with a remark', () => {
    expect(kycAllowsSubmit('Fail', 'please')).toBe(false);
  });

  it('no result yet cannot', () => {
    expect(kycAllowsSubmit('', '')).toBe(false);
  });

  it('a remark must have something in it', () => {
    expect(hasExceptionRemark('')).toBe(false);
    expect(hasExceptionRemark(' \n ')).toBe(false);
    expect(hasExceptionRemark('x')).toBe(true);
  });
});
