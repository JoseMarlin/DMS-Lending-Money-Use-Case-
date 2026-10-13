import { SEED_APPLICATIONS } from '@/data/seed';
import { ApplicationStatus, CheckStatus, KycResult, type HomeLoanApplication } from '@/data/types';
import { kycChecks, kycSummary, type KycCheckRow } from './kycChecksModel';
import { PANEL_TABS, defaultPanelTab, panelTabOf } from './sidePanelModel';

const [VIJAY, SHOBHA, , , BASAVARAJ] = SEED_APPLICATIONS;

const make = (over: Partial<HomeLoanApplication> = {}): HomeLoanApplication => ({
  ...VIJAY,
  ...over,
});

const byId = (rows: KycCheckRow[], id: KycCheckRow['id']) => rows.find((r) => r.id === id)!;
const status = (app: HomeLoanApplication, id: KycCheckRow['id']) => byId(kycChecks(app), id).status;

/** An application that has not been through the checks. */
const unchecked = (over: Partial<HomeLoanApplication> = {}) =>
  make({
    panStatus: CheckStatus.Pending,
    aadhaarStatus: CheckStatus.Pending,
    gstStatus: CheckStatus.Pending,
    gstinStatus: '',
    nameMatchPercent: null,
    dateOfBirthMatch: '',
    dateOfBirthAsPerSource: '',
    panNameAsPerSource: '',
    gstLegalName: '',
    aadhaarReference: '',
    kycOverallResult: '',
    kycExceptionRemark: '',
    kycCheckedOn: '',
    ...over,
  });

describe('the tabs of the side panel', () => {
  it('are KYC Checks, Comments, Files and Attachments and Audit Log, from the top', () => {
    expect(PANEL_TABS.map((t) => t.title)).toEqual([
      'KYC Checks',
      'Comments',
      'Files and Attachments',
      'Audit Log',
    ]);
    expect(PANEL_TABS.map((t) => t.id)).toEqual(['kyc', 'comments', 'files', 'audit']);
  });

  it('has a title for each one', () => {
    PANEL_TABS.forEach((t) => expect(panelTabOf(t.id)).toBe(t));
  });

  it.each([
    [ApplicationStatus.Draft, 'kyc'],
    [ApplicationStatus.KycDone, 'kyc'],
    [ApplicationStatus.Submitted, 'kyc'],
    [ApplicationStatus.InLevel1, 'kyc'],
    [ApplicationStatus.InLevel2, 'kyc'],
    [ApplicationStatus.Returned, 'comments'],
    [ApplicationStatus.Approved, 'comments'],
    [ApplicationStatus.Rejected, 'comments'],
  ] as const)('open on %s for a record that is %s', (appStatus, tab) => {
    expect(defaultPanelTab(appStatus)).toBe(tab);
  });
});

describe('the KYC checks of an application', () => {
  it('are the eight, in the order of the panel, and the GST one only when there is a GSTIN', () => {
    const withGst = kycChecks(SHOBHA);
    expect(withGst.map((r) => r.label)).toEqual([
      'PAN format',
      'PAN active',
      'Aadhaar valid',
      'Aadhaar authentication',
      'GST active',
      'Name match percent',
      'Date of birth match',
      'PAN and Aadhaar link',
    ]);
    const without = kycChecks(VIJAY);
    expect(without).toHaveLength(7);
    expect(without.map((r) => r.id)).not.toContain('gst-active');
  });

  it('are all passed for the approved seed application', () => {
    expect(kycChecks(VIJAY).map((r) => r.status)).toEqual(Array(7).fill('Passed'));
  });

  it('says Passed for every check of a business application that passed', () => {
    expect(kycChecks(SHOBHA).map((r) => r.status)).toEqual(Array(8).fill('Passed'));
  });

  it('has an exception for a name match of 70 to 94 percent, and a fail below 70', () => {
    expect(status(BASAVARAJ, 'name-match')).toBe('Exception');
    expect(status(make({ nameMatchPercent: 94 }), 'name-match')).toBe('Exception');
    expect(status(make({ nameMatchPercent: 95 }), 'name-match')).toBe('Passed');
    expect(status(make({ nameMatchPercent: 70 }), 'name-match')).toBe('Exception');
    expect(status(make({ nameMatchPercent: 69 }), 'name-match')).toBe('Failed');
  });

  it('follows the PAN source: active, not found or inactive, not available', () => {
    expect(status(make({ panStatus: CheckStatus.Verified }), 'pan-active')).toBe('Passed');
    expect(status(make({ panStatus: CheckStatus.Failed }), 'pan-active')).toBe('Failed');
    expect(status(make({ panStatus: CheckStatus.Unavailable }), 'pan-active')).toBe('Unavailable');
  });

  it('follows the Aadhaar source', () => {
    expect(status(make({ aadhaarStatus: CheckStatus.Verified }), 'aadhaar-authentication')).toBe(
      'Passed',
    );
    expect(status(make({ aadhaarStatus: CheckStatus.Failed }), 'aadhaar-authentication')).toBe(
      'Failed',
    );
    expect(status(make({ aadhaarStatus: CheckStatus.Unavailable }), 'aadhaar-authentication')).toBe(
      'Unavailable',
    );
  });

  it('fails a GSTIN that is cancelled, and is unavailable when the GST source did not answer', () => {
    expect(status(make({ ...SHOBHA, gstinStatus: 'Cancelled' }), 'gst-active')).toBe('Failed');
    expect(status(make({ ...SHOBHA, gstStatus: CheckStatus.Unavailable }), 'gst-active')).toBe(
      'Unavailable',
    );
    expect(status(make({ ...SHOBHA, gstStatus: CheckStatus.Verified }), 'gst-active')).toBe(
      'Passed',
    );
  });

  it('leaves the GST check out for an application with no GSTIN, or with GST not applicable', () => {
    expect(kycChecks(make({ gstin: '' })).map((r) => r.id)).not.toContain('gst-active');
    expect(
      kycChecks(make({ ...SHOBHA, gstStatus: CheckStatus.NotApplicable })).map((r) => r.id),
    ).not.toContain('gst-active');
  });

  it('checks the date of birth: exact passes, a mismatch fails', () => {
    expect(status(make({ dateOfBirthMatch: 'Exact' }), 'dob-match')).toBe('Passed');
    expect(status(make({ dateOfBirthMatch: 'Mismatch' }), 'dob-match')).toBe('Failed');
  });

  it('checks the format of the PAN from what is stored', () => {
    expect(status(make({ pan: 'ABCPK2101L' }), 'pan-format')).toBe('Passed');
    expect(status(make({ pan: 'abcpk2101l' }), 'pan-format')).toBe('Passed');
    expect(status(make({ pan: 'ABCDK2101L' }), 'pan-format')).toBe('Failed'); // 4th letter is not P
    expect(status(make({ pan: '12345' }), 'pan-format')).toBe('Failed');
  });

  it('links the PAN to the Aadhaar when both sources say they are the same person', () => {
    expect(status(make(), 'pan-aadhaar-link')).toBe('Passed');
    expect(status(make({ panStatus: CheckStatus.Failed }), 'pan-aadhaar-link')).toBe('Failed');
    expect(status(make({ aadhaarStatus: CheckStatus.Failed }), 'pan-aadhaar-link')).toBe('Failed');
    expect(status(make({ aadhaarStatus: CheckStatus.Unavailable }), 'pan-aadhaar-link')).toBe(
      'Unavailable',
    );
  });

  it('says Not checked for the checks of a draft that has not been through KYC', () => {
    const rows = kycChecks(unchecked());
    expect(byId(rows, 'pan-active').status).toBe('Not checked');
    expect(byId(rows, 'aadhaar-authentication').status).toBe('Not checked');
    expect(byId(rows, 'name-match').status).toBe('Not checked');
    expect(byId(rows, 'dob-match').status).toBe('Not checked');
    expect(byId(rows, 'pan-aadhaar-link').status).toBe('Not checked');
    // what is known without a source still shows: the PAN has its format, the Aadhaar its form
    expect(byId(rows, 'pan-format').status).toBe('Passed');
    expect(byId(rows, 'aadhaar-valid').status).toBe('Passed');
  });

  it('fails the Aadhaar valid check for a number that was kept as not valid, and says so', () => {
    const row = byId(kycChecks(unchecked({ aadhaar: 'XXXX XXXX XXXX' })), 'aadhaar-valid');
    expect(row.status).toBe('Failed');
    expect(row.summary).toBe('Not a valid number');
    expect(byId(kycChecks(unchecked({ aadhaar: 'XXXX XXXX 4821' })), 'aadhaar-valid').status).toBe(
      'Passed',
    );
  });

  it('says the same in the chip and in the line under it when the PAN source was not available', () => {
    const rows = kycChecks(
      make({
        panStatus: CheckStatus.Unavailable,
        nameMatchPercent: null,
        dateOfBirthMatch: '',
        dateOfBirthAsPerSource: '',
        panNameAsPerSource: '',
      }),
    );
    for (const id of ['name-match', 'dob-match'] as const) {
      expect(byId(rows, id).status).toBe('Unavailable');
      expect(byId(rows, id).summary).toBe('Source not available');
    }
  });

  it('has nothing to show for a PAN and an Aadhaar that are empty', () => {
    const rows = kycChecks(unchecked({ pan: '', aadhaar: '' }));
    expect(byId(rows, 'pan-format').status).toBe('Not checked');
    expect(byId(rows, 'aadhaar-valid').status).toBe('Not checked');
  });

  it('shows the name and the date of birth that were entered and the ones of the source', () => {
    const name = byId(kycChecks(BASAVARAJ), 'name-match');
    expect(name.details).toContainEqual({
      label: 'Name entered',
      value: BASAVARAJ.fullNameAsPerPan,
    });
    expect(name.details).toContainEqual({ label: 'As per source', value: 'BASAVARAJ S KADAM' });
    expect(name.details).toContainEqual({ label: 'Match', value: '88%' });
    const dob = byId(kycChecks(VIJAY), 'dob-match');
    expect(dob.details).toContainEqual({ label: 'Date of birth entered', value: '22/07/1979' });
    expect(dob.details).toContainEqual({ label: 'As per source', value: '22/07/1979' });
  });

  it('shows the reference ID of the Aadhaar authentication, and the legal name of the GST check', () => {
    const aadhaar = byId(kycChecks(SHOBHA), 'aadhaar-authentication');
    expect(aadhaar.details).toContainEqual({
      label: 'Reference ID',
      value: SHOBHA.aadhaarReference,
    });
    const gst = byId(kycChecks(SHOBHA), 'gst-active');
    expect(gst.details).toContainEqual({
      label: 'Legal name as per source',
      value: SHOBHA.gstLegalName,
    });
  });

  it('gives each row a line under its name, and a value for every detail', () => {
    SEED_APPLICATIONS.forEach((app) => {
      kycChecks(app).forEach((row) => {
        expect(row.summary).not.toBe('');
        row.details.forEach((d) => {
          expect(d.label).not.toBe('');
          expect(d.value).not.toBe('');
        });
      });
    });
  });

  it('shows the Aadhaar as the masked number only, whatever the application holds', () => {
    SEED_APPLICATIONS.forEach((app) => {
      const text = JSON.stringify(kycChecks(app));
      expect(text).toContain('XXXX XXXX');
      expect(text).not.toMatch(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/);
    });
  });
});

describe('the summary of the result', () => {
  it('says what the result was and when it was checked', () => {
    expect(kycSummary(VIJAY)).toEqual({
      result: KycResult.Pass,
      text: 'KYC result: Pass, checked on 18 Aug 2026.',
      remark: '',
    });
  });

  it('has the remark of an exception', () => {
    const summary = kycSummary(BASAVARAJ);
    expect(summary.result).toBe('Exception');
    expect(summary.remark).toBe(
      'Middle initial missing in the application. Documents show the same person.',
    );
  });

  it('says that the checks have not been run before they have', () => {
    expect(kycSummary(unchecked())).toEqual({
      result: '',
      text: 'The KYC checks have not been run for this application yet.',
      remark: '',
    });
  });

  it('does not show a remark for a pass or a fail', () => {
    expect(kycSummary(make({ kycExceptionRemark: 'left over' })).remark).toBe('');
  });
});
