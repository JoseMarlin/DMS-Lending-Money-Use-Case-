import { SCENARIOS } from '@/data/seed';
import { CheckStatus, type KycOutage } from '@/data/types';
import { gstApplies, pendingRows, rowsFromRecord, runKyc, type KycRows } from './runKyc';

const A = SCENARIOS.A.application; // Ramesh Patil, Business, clean pass
const B = SCENARIOS.B.application; // Anita Desai, name match 86% (an Exception)
const C = SCENARIOS.C.application; // Kiran Naik, PAN inactive (a Fail)

const subject = (app: typeof A, over: Record<string, string> = {}) =>
  ({
    applicationId: 'HL-2026-0008',
    pan: app.pan ?? '',
    fullNameAsPerPan: app.fullNameAsPerPan ?? '',
    dateOfBirth: app.dateOfBirth ?? '',
    occupation: app.occupation ?? '',
    gstin: app.gstin ?? '',
    ...over,
  }) as Parameters<typeof runKyc>[0]['application'];

const run = (
  application: Parameters<typeof runKyc>[0]['application'],
  options: { otp?: string | null; outage?: KycOutage; stopAfterPan?: boolean } = {},
) => {
  const rows: KycRows[] = [];
  let current = true;
  const promise = runKyc({
    application,
    outage: options.outage ?? 'none',
    isCurrent: () => current,
    onRows: (r) => rows.push(r),
    askOtp: async () => {
      if (options.stopAfterPan) current = false;
      return options.otp === undefined ? '123456' : options.otp;
    },
  });
  return { promise, rows };
};

describe('gstApplies and the rows', () => {
  it('checks the GST only for a Business or Professional applicant who entered a GSTIN', () => {
    expect(gstApplies({ occupation: 'Business', gstin: '29ABCPP1234F1Z5' })).toBe(true);
    expect(gstApplies({ occupation: 'Professional', gstin: '29ABCPP1234F1Z5' })).toBe(true);
    expect(gstApplies({ occupation: 'Business', gstin: '  ' })).toBe(false);
    expect(gstApplies({ occupation: 'Salaried', gstin: '29ABCPP1234F1Z5' })).toBe(false);
  });

  it('starts with the checks pending, and GST not applicable when it does not apply', () => {
    expect(pendingRows({ occupation: 'Business', gstin: 'X' }).gst.status).toBe(
      CheckStatus.Pending,
    );
    expect(pendingRows({ occupation: 'Salaried', gstin: '' })).toMatchObject({
      pan: { status: CheckStatus.Pending },
      aadhaar: { status: CheckStatus.Pending },
      gst: { status: CheckStatus.NotApplicable },
    });
  });

  it('reads the rows of a result that is already on a record', () => {
    const rows = rowsFromRecord({
      panStatus: 'Verified',
      aadhaarStatus: 'Unavailable',
      gstStatus: 'Verified',
      occupation: 'Business',
      gstin: 'X',
    } as never);
    expect(rows.pan).toMatchObject({ status: 'Verified', final: true, retries: 0 });
    expect(rows.aadhaar).toMatchObject({ status: 'Unavailable', final: true, retries: 3 });
    expect(rows.gst.status).toBe('Verified');
  });
});

describe('runKyc', () => {
  it('runs PAN, Aadhaar and GST, and passes a clean applicant', async () => {
    const { promise, rows } = run(subject(A));
    const outcome = await promise;
    expect(outcome).not.toBeNull();
    expect(outcome!.evaluation.result).toBe('Pass');
    expect(outcome!.patch).toMatchObject({
      panStatus: 'Verified',
      aadhaarStatus: 'Verified',
      gstStatus: 'Verified',
      nameMatchPercent: 100,
      dateOfBirthMatch: 'Exact',
      kycOverallResult: 'Pass',
      retryCount: 0,
    });
    expect(outcome!.patch.kycCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(outcome!.patch.aadhaarReference).toMatch(/^MOCK-AAD-/);
    // the rows were shown as they changed, ending with all three finished
    const last = rows.at(-1)!;
    expect(last.pan.status).toBe('Verified');
    expect(last.aadhaar.status).toBe('Verified');
    expect(last.gst.status).toBe('Verified');
  });

  it('asks for the OTP between the PAN and the GST checks', async () => {
    const { promise, rows } = run(subject(A));
    await promise;
    const waiting = rows.findIndex((r) => r.aadhaar.status === CheckStatus.OtpRequired);
    expect(waiting).toBeGreaterThan(0);
    expect(rows[waiting].pan.status).toBe('Verified');
    expect(rows[waiting].gst.status).toBe(CheckStatus.Pending);
  });

  it('gives the mock references of the checks, never an Aadhaar number', async () => {
    const outcome = (await run(subject(A)).promise)!;
    expect(outcome.references.map((r) => r.source)).toEqual(['PAN', 'Aadhaar', 'GST']);
    expect(outcome.references.every((r) => /^MOCK-(PAN|AAD|GST)-/.test(r.reference))).toBe(true);
    expect(JSON.stringify(outcome)).not.toMatch(/\d{12}/);
  });

  it('has no GST check for a salaried applicant', async () => {
    const outcome = (await run(subject(B, { occupation: 'Salaried', gstin: '' })).promise)!;
    expect(outcome.patch.gstStatus).toBe('Not applicable');
    expect(outcome.patch.gstinStatus).toBe('Not applicable');
    expect(outcome.references.map((r) => r.source)).toEqual(['PAN', 'Aadhaar']);
  });

  it('gives an Exception for a name that matches 86%', async () => {
    const outcome = (await run(subject(B)).promise)!;
    expect(outcome.evaluation.result).toBe('Exception');
    expect(outcome.patch.nameMatchPercent).toBe(86);
    expect(outcome.evaluation.reasons.join(' ')).toMatch(/86%/);
  });

  it('gives a Fail for a PAN that is inactive', async () => {
    const outcome = (await run(subject(C)).promise)!;
    expect(outcome.evaluation.result).toBe('Fail');
    expect(outcome.patch.panStatus).toBe('Failed');
    expect(outcome.evaluation.reasons.join(' ')).toMatch(/PAN is not found or is inactive/);
  });

  it('fails the Aadhaar check on a wrong OTP', async () => {
    const outcome = (await run(subject(A), { otp: '000000' }).promise)!;
    expect(outcome.patch.aadhaarStatus).toBe('Failed');
    expect(outcome.evaluation.result).toBe('Fail');
  });

  it('counts the retries of a source that is down, and calls it an Exception', async () => {
    const outcome = (await run(subject(A), { outage: 'pan-down' }).promise)!;
    expect(outcome.patch.panStatus).toBe('Unavailable');
    expect(outcome.patch.retryCount).toBe(3);
    expect(outcome.evaluation.result).toBe('Exception');
    expect(outcome.evaluation.reasons.join(' ')).toMatch(
      /PAN source was unavailable after 3 retries/,
    );
  });

  it('recovers when a source times out once', async () => {
    const outcome = (await run(subject(A), { outage: 'pan-once' }).promise)!;
    expect(outcome.patch.panStatus).toBe('Verified');
    expect(outcome.patch.retryCount).toBe(1);
    expect(outcome.evaluation.result).toBe('Pass');
  });

  it('stops, and gives nothing, when the person gives up the OTP', async () => {
    expect(await run(subject(A), { otp: null }).promise).toBeNull();
  });

  it('stops, and gives nothing, when it is no longer current', async () => {
    expect(await run(subject(A), { stopAfterPan: true }).promise).toBeNull();
  });

  it('never needs the Aadhaar number: it is not in what it is given', () => {
    const given = subject(A);
    expect(Object.keys(given)).not.toContain('aadhaar');
  });
});
