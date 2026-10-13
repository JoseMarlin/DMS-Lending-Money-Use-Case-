import { SCENARIOS } from '@/data/seed';
import {
  checkAadhaar,
  checkGst,
  checkPan,
  DEFAULT_KYC_CONFIG,
  InvalidOtpError,
  isOutage,
  isValidOtp,
  KYC_CONFIG,
  mockReferenceId,
  resetKycConfig,
  runWithRetries,
  scenarioForPan,
  verifyAadhaarOtp,
} from './mockKyc';

const A = SCENARIOS.A.application;
const B = SCENARIOS.B.application;
const C = SCENARIOS.C.application;
const panInput = (s: typeof A) => ({
  pan: s.pan!,
  fullName: s.fullNameAsPerPan!,
  dateOfBirth: s.dateOfBirth!,
});

/** Runs a promise to the end with fake timers, returning how many ms it took */
async function timed<T>(promise: Promise<T>) {
  let done = false;
  let value!: T;
  void promise.then((v) => {
    value = v;
    done = true;
  });
  let elapsed = 0;
  while (!done && elapsed < 60_000) {
    await vi.advanceTimersByTimeAsync(10);
    elapsed += 10;
  }
  return { value, elapsed };
}

beforeEach(() => {
  vi.useFakeTimers();
  resetKycConfig(); // the real delays, not the 1 ms of the other tests
});
afterEach(() => {
  vi.useRealTimers();
});

describe('configuration (section 8)', () => {
  it('has the delays of the overview, and the mock OTP', () => {
    expect(DEFAULT_KYC_CONFIG).toMatchObject({
      panDelayMs: 1500,
      aadhaarDelayMs: 2000,
      gstDelayMs: 1500,
      maxRetries: 3,
      otp: '123456',
    });
    expect(KYC_CONFIG).toEqual(DEFAULT_KYC_CONFIG);
  });

  it('the delays can be changed in one place', () => {
    KYC_CONFIG.panDelayMs = 50;
    expect(KYC_CONFIG.panDelayMs).toBe(50);
    resetKycConfig();
    expect(KYC_CONFIG.panDelayMs).toBe(1500);
  });
});

describe('checkPan', () => {
  it('answers after 1.5 seconds, not before', async () => {
    const promise = checkPan(panInput(A));
    let answered = false;
    void promise.then(() => (answered = true));
    await vi.advanceTimersByTimeAsync(1499);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(answered).toBe(true);
  });

  it('scenario A: verified, name as per source, 100%, date of birth exact', async () => {
    const { value } = await timed(checkPan(panInput(A)));
    expect(value).toMatchObject({
      status: 'Verified',
      panActive: true,
      nameAsPerSource: 'RAMESH PATIL',
      nameMatchPercent: 100,
      dateOfBirthOnRecord: '1984-03-14',
      dateOfBirthMatch: 'Exact',
    });
    expect(value.reference).toMatch(/^MOCK-PAN-\d{5}$/);
  });

  it('scenario B: "ANITA R DESAI" at 86%', async () => {
    const { value } = await timed(checkPan(panInput(B)));
    expect(value).toMatchObject({
      status: 'Verified',
      nameAsPerSource: 'ANITA R DESAI',
      nameMatchPercent: 86,
      dateOfBirthMatch: 'Exact',
    });
  });

  it('scenario C: PAN inactive', async () => {
    const { value } = await timed(checkPan(panInput(C)));
    expect(value).toMatchObject({ status: 'Failed', panActive: false });
  });

  it('a PAN that is not one of the scenarios is a clean applicant, with the name as entered', async () => {
    const { value } = await timed(
      checkPan({ pan: 'ABCPK2101L', fullName: 'Vijay Kulkarni', dateOfBirth: '1979-07-22' }),
    );
    expect(value).toMatchObject({
      status: 'Verified',
      nameAsPerSource: 'VIJAY KULKARNI',
      nameMatchPercent: 100,
      dateOfBirthMatch: 'Exact',
    });
  });

  it('reports a date of birth that differs from the source', async () => {
    const { value } = await timed(checkPan({ ...panInput(A), dateOfBirth: '1984-03-15' }));
    expect(value.dateOfBirthMatch).toBe('Mismatch');
    expect(value.dateOfBirthOnRecord).toBe('1984-03-14');
  });

  it('finds the scenario by PAN, in capitals or not', () => {
    expect(scenarioForPan('abcpp1234f')?.nameMatchPercent).toBe(100);
    expect(scenarioForPan(' ABCPD5678K ')?.nameMatchPercent).toBe(86);
    expect(scenarioForPan('ABCPD9012L')?.panActive).toBe(false);
    expect(scenarioForPan('ZZZZZ9999Z')).toBeNull();
  });
});

describe('Aadhaar and the OTP', () => {
  it('the OTP of the demo is 123456', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp(' 123456 ')).toBe(true);
    expect(isValidOtp('123457')).toBe(false);
    expect(isValidOtp('')).toBe(false);
  });

  it('checkAadhaar answers 2 seconds after the OTP', async () => {
    const promise = checkAadhaar({ otp: '123456' });
    let answered = false;
    void promise.then(() => (answered = true));
    await vi.advanceTimersByTimeAsync(1999);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(answered).toBe(true);
    expect((await promise).status).toBe('Verified');
  });

  it('a wrong OTP is turned down quickly, before the 2 second check', async () => {
    const promise = checkAadhaar({ otp: '000000' });
    const caught = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(KYC_CONFIG.otpCheckDelayMs);
    expect(await caught).toBeInstanceOf(InvalidOtpError);
  });

  it('verifyAadhaarOtp says whether the OTP is right', async () => {
    const right = verifyAadhaarOtp('123456');
    const wrong = verifyAadhaarOtp('111111');
    await vi.advanceTimersByTimeAsync(KYC_CONFIG.otpCheckDelayMs);
    expect(await right).toBe(true);
    expect(await wrong).toBe(false);
  });

  it('the reference ID differs between applications and holds no Aadhaar digits', async () => {
    const one = await timed(checkAadhaar({ otp: '123456', referenceSeed: 'HL-2026-0006' }));
    const two = await timed(checkAadhaar({ otp: '123456', referenceSeed: 'HL-2026-0007' }));
    expect(one.value.reference).toMatch(/^MOCK-AAD-\d{5}$/);
    expect(one.value.reference).not.toBe(two.value.reference);
    expect(mockReferenceId('AAD', 'x')).toBe(mockReferenceId('AAD', 'x'));
  });

  it('takes no Aadhaar number at all: only the OTP', () => {
    expect(checkAadhaar.length).toBeLessThanOrEqual(2);
    const source = checkAadhaar.toString();
    expect(source).not.toMatch(/aadhaarInput|\d{12}/);
  });
});

describe('checkGst', () => {
  const gstInput = (s: typeof A) => ({
    gstin: s.gstin!,
    pan: s.pan!,
    fullName: s.fullNameAsPerPan!,
  });

  it('answers after 1.5 seconds', async () => {
    const { elapsed } = await timed(checkGst(gstInput(A)));
    expect(elapsed).toBeGreaterThanOrEqual(1500);
    expect(elapsed).toBeLessThan(1600);
  });

  it('scenario A: verified, active, legal name RAMESH PATIL', async () => {
    const { value } = await timed(checkGst(gstInput(A)));
    expect(value).toMatchObject({
      status: 'Verified',
      legalName: 'RAMESH PATIL',
      gstinStatus: 'Active',
    });
  });

  it('another business is verified with its name as entered', async () => {
    const { value } = await timed(
      checkGst({ gstin: '29ABCPM3302N1Z3', pan: 'ABCPM3302N', fullName: 'Shobha Gaonkar' }),
    );
    expect(value).toMatchObject({ status: 'Verified', legalName: 'SHOBHA GAONKAR' });
  });
});

describe('Unavailable sources', () => {
  it('knows which source is down on which try', () => {
    expect(isOutage('pan', 0, 'none')).toBe(false);
    expect(isOutage('pan', 0, 'pan-once')).toBe(true);
    expect(isOutage('pan', 1, 'pan-once')).toBe(false);
    expect(isOutage('pan', 0, 'pan-down')).toBe(true);
    expect(isOutage('pan', 5, 'pan-down')).toBe(true);
    expect(isOutage('gst', 0, 'gst-down')).toBe(true);
    expect(isOutage('pan', 0, 'gst-down')).toBe(false);
    expect(isOutage('aadhaar', 0, 'pan-down')).toBe(false);
  });

  it('checkPan and checkGst return Unavailable during an outage', async () => {
    const pan = await timed(checkPan(panInput(A), { outage: 'pan-down' }));
    expect(pan.value.status).toBe('Unavailable');
    expect(pan.value.nameMatchPercent).toBeNull();
    const gst = await timed(
      checkGst({ gstin: A.gstin!, pan: A.pan!, fullName: 'x' }, { outage: 'gst-down' }),
    );
    expect(gst.value.status).toBe('Unavailable');
  });

  it('answers on the first retry when the outage is only once', async () => {
    const first = await timed(checkPan(panInput(A), { attempt: 0, outage: 'pan-once' }));
    const second = await timed(checkPan(panInput(A), { attempt: 1, outage: 'pan-once' }));
    expect(first.value.status).toBe('Unavailable');
    expect(second.value.status).toBe('Verified');
  });
});

describe('runWithRetries: up to three retries, then it gives up', () => {
  it('does not retry when the first try answers', async () => {
    const run = vi.fn(async () => ({ status: 'Verified' }));
    const { value } = await timed(runWithRetries(run));
    expect(value).toEqual({ result: { status: 'Verified' }, retries: 0 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('retries once for a source that was down once, and then answers', async () => {
    const run = vi.fn((attempt: number) => checkPan(panInput(A), { attempt, outage: 'pan-once' }));
    const { value, elapsed } = await timed(runWithRetries(run));
    expect(value.result.status).toBe('Verified');
    expect(value.retries).toBe(1);
    expect(run.mock.calls.map((c) => c[0])).toEqual([0, 1]);
    // 1.5 s for the first try, the pause, 1.5 s for the second
    expect(elapsed).toBeGreaterThanOrEqual(1500 + KYC_CONFIG.retryDelayMs + 1500);
  });

  it('tries four times in all (one try and three retries) for a source that stays down', async () => {
    const run = vi.fn((attempt: number) => checkPan(panInput(A), { attempt, outage: 'pan-down' }));
    const { value } = await timed(runWithRetries(run));
    expect(value.result.status).toBe('Unavailable');
    expect(value.retries).toBe(3);
    expect(run).toHaveBeenCalledTimes(4);
    expect(run.mock.calls.map((c) => c[0])).toEqual([0, 1, 2, 3]);
  });

  it('reports each try and each retry as they happen', async () => {
    const attempts: number[] = [];
    const retries: number[] = [];
    await timed(
      runWithRetries((attempt) => checkPan(panInput(A), { attempt, outage: 'pan-down' }), {
        onAttempt: (n) => attempts.push(n),
        onRetry: (n) => retries.push(n),
      }),
    );
    expect(attempts).toEqual([0, 1, 2, 3]);
    expect(retries).toEqual([1, 2, 3]);
  });

  it('waits between retries', async () => {
    let calls = 0;
    const promise = runWithRetries(async () => {
      calls += 1;
      return { status: 'Unavailable' };
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(KYC_CONFIG.retryDelayMs - 1);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(KYC_CONFIG.retryDelayMs * 5);
    expect(await promise).toMatchObject({ retries: 3 });
    expect(calls).toBe(4);
  });

  it('stops when the run is no longer current (the user left the step)', async () => {
    let current = true;
    const run = vi.fn(async () => ({ status: 'Unavailable' }));
    const promise = runWithRetries(run, { isCurrent: () => current });
    await vi.advanceTimersByTimeAsync(0);
    current = false;
    await vi.advanceTimersByTimeAsync(KYC_CONFIG.retryDelayMs * 5);
    const { retries } = await promise;
    expect(run.mock.calls.length).toBeLessThan(4);
    expect(retries).toBeLessThan(3);
  });
});
