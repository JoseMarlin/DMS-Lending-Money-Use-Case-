import { RECORD_LIST_PATH, recordSheetPath } from './paths';

describe('recordSheetPath', () => {
  it('is the list with the record in the address', () => {
    expect(recordSheetPath('HL-2026-0001')).toBe('/metadata/master/home-loan?record=HL-2026-0001');
    expect(RECORD_LIST_PATH).toBe('/metadata/master/home-loan');
  });

  it('keeps the list tab of the address it is made from', () => {
    expect(recordSheetPath('HL-2026-0004', new URLSearchParams('tab=all-records'))).toBe(
      '/metadata/master/home-loan?tab=all-records&record=HL-2026-0004',
    );
  });

  it('replaces the record that was open, and opens it on its first tab', () => {
    const open = new URLSearchParams('tab=all-records&record=HL-2026-0001&section=kyc');
    expect(recordSheetPath('HL-2026-0002', open)).toBe(
      '/metadata/master/home-loan?tab=all-records&record=HL-2026-0002',
    );
  });

  it('leaves the address it is made from as it was', () => {
    const open = new URLSearchParams('record=HL-2026-0001&section=kyc');
    recordSheetPath('HL-2026-0002', open);
    expect(open.toString()).toBe('record=HL-2026-0001&section=kyc');
  });

  it('writes an Application ID that has special characters safely', () => {
    expect(recordSheetPath('HL 2026/1&x')).toBe(
      '/metadata/master/home-loan?record=HL+2026%2F1%26x',
    );
  });
});
