/**
 * Helpers for tests that need an application in the workflow: they go through the store, as the
 * screens do. Not part of the app.
 */
import { useAppStore } from '@/data/store';
import type { DemoUserId, ScenarioKey } from '@/data/types';
import { DEMO_USERS } from '@/data/users';

const state = () => useAppStore.getState();

/**
 * Fills a scenario as the loan officer, gives it a KYC result the way Step 2 would (Pass for A,
 * Exception with a remark for B), and submits it. Gives the new instance id and the Application ID.
 */
export function submitScenario(key: Exclude<ScenarioKey, 'C'> = 'A', as: DemoUserId = 'priya') {
  state().setCurrentUser(as);
  state().fillScenario(key);
  const exception = key === 'B';
  state().updateDraft({
    consentGiven: true,
    panStatus: 'Verified',
    aadhaarStatus: 'Verified',
    gstStatus: key === 'A' ? 'Verified' : 'Not applicable',
    nameMatchPercent: exception ? 86 : 100,
    dateOfBirthMatch: 'Exact',
    kycOverallResult: exception ? 'Exception' : 'Pass',
    kycExceptionRemark: exception ? 'The name on the PAN has a middle initial.' : '',
    kycCheckedOn: '2026-10-09',
  });
  const outcome = state().submitApplication();
  if (!outcome.ok) throw new Error(`submit failed: ${outcome.code}: ${outcome.error}`);
  return { id: outcome.instance.id, applicationId: outcome.instance.applicationId };
}

/** The demo user, as the store functions want them. */
export const user = (id: DemoUserId) => DEMO_USERS[id];

/** Level 1 approves, then Level 2 approves with the full Eligible Amount. */
export function approveBothLevels(id: string) {
  const one = state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
  if (!one.ok) throw new Error(`level 1: ${one.code}`);
  const app = state().applications.find((a) => a.applicationId === one.instance.applicationId)!;
  const two = state().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
    sanctionedAmount: app.eligibleAmount ?? app.loanAmountRequested ?? 1,
    sanctionDate: '2026-10-10',
  });
  if (!two.ok) throw new Error(`level 2: ${two.code}`);
}
