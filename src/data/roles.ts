/**
 * What each demo role can do. PROJECT_OVERVIEW.md sections 4 and 5 describe the roles but do not
 * list their actions in one place, so this table is an assumption: the maker creates and resubmits,
 * the two approvers review at their level, and the administrator looks at everything and can also
 * create a record (the Create Record button of the master list is for the loan officer and the
 * administrator). Screens ask `can(role, action)` so that switching the user changes what they
 * offer, with no reload.
 */
import type { UserAction, UserRole } from './types';

export const ROLE_ACTIONS: Record<UserRole, UserAction[]> = {
  loanOfficer: ['createApplication', 'resubmitApplication'],
  branchManager: ['reviewLevel1'],
  creditApprover: ['reviewLevel2'],
  admin: ['createApplication', 'viewAllApplications', 'viewWorkflow'],
};

/** One line for each action, in plain words, for screens that list what a user can do. */
export const ACTION_LABELS: Record<UserAction, string> = {
  createApplication: 'Create and submit Home Loan applications',
  resubmitApplication: 'Correct and resubmit applications that were returned',
  reviewLevel1: 'Review applications at Level 1, then approve, return or reject them',
  reviewLevel2:
    'Review applications at Level 2, enter the sanctioned amount, then approve, return or reject',
  viewAllApplications: 'See every application with its KYC result and documents',
  viewWorkflow: 'See how the Home Loan Approval workflow is built and where each application is',
};

export function can(role: UserRole, action: UserAction): boolean {
  return ROLE_ACTIONS[role].includes(action);
}

/** The actions of a role, in the order of the table above. */
export function actionsOf(role: UserRole): UserAction[] {
  return ROLE_ACTIONS[role];
}
