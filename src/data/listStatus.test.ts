import { listStatusOf } from './listStatus';
import { ApplicationStatus } from './types';

describe('listStatusOf', () => {
  it.each([
    [ApplicationStatus.Submitted, 'In-Progress'],
    [ApplicationStatus.InLevel1, 'In-Progress'],
    [ApplicationStatus.InLevel2, 'In-Progress'],
    [ApplicationStatus.Returned, 'Action Required'],
    [ApplicationStatus.Approved, 'Approved'],
    [ApplicationStatus.Rejected, 'Rejected'],
    [ApplicationStatus.Draft, 'Draft'],
    [ApplicationStatus.KycDone, 'Draft'],
  ])('%s shows as %s', (status, chip) => {
    expect(listStatusOf(status)).toBe(chip);
  });

  it('covers every status of section 6.9', () => {
    for (const status of Object.values(ApplicationStatus)) {
      expect(listStatusOf(status)).toBeTruthy();
    }
  });
});
