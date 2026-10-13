import { ApplicationStatus } from './types';

/**
 * How a status looks in the master list. The store has eight statuses (section 6.9); the list shows
 * five chips, so several statuses share one:
 *
 *   Submitted, In Level 1, In Level 2  ->  In-Progress
 *   Returned                           ->  Action Required
 *   Approved / Rejected                ->  Approved / Rejected
 *   Draft, KYC Done                    ->  Draft (KYC Done is a draft that has passed KYC, not yet submitted)
 */
export type ListStatus = 'In-Progress' | 'Action Required' | 'Approved' | 'Rejected' | 'Draft';

export function listStatusOf(status: ApplicationStatus): ListStatus {
  switch (status) {
    case ApplicationStatus.Submitted:
    case ApplicationStatus.InLevel1:
    case ApplicationStatus.InLevel2:
      return 'In-Progress';
    case ApplicationStatus.Returned:
      return 'Action Required';
    case ApplicationStatus.Approved:
      return 'Approved';
    case ApplicationStatus.Rejected:
      return 'Rejected';
    case ApplicationStatus.Draft:
    case ApplicationStatus.KycDone:
      return 'Draft';
  }
}
