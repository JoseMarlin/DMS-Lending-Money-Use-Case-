import { KycResult } from '@/data/types';

/** True when the remark box has a remark (an Exception cannot go on without one). */
export function hasExceptionRemark(remark: string): boolean {
  return remark.trim() !== '';
}

/**
 * Whether the application may go on to review and be submitted (PROJECT_OVERVIEW.md section 8):
 * Pass: yes. Exception: only with a remark. Fail, or no result yet: no.
 */
export function kycAllowsSubmit(result: string, remark: string): boolean {
  return (
    result === KycResult.Pass || (result === KycResult.Exception && hasExceptionRemark(remark))
  );
}
