import { ACTION_LABELS, ROLE_ACTIONS, actionsOf, can } from './roles';
import { DEMO_USERS } from './seed';
import type { UserAction } from './types';

const ALL_ACTIONS = Object.keys(ACTION_LABELS) as UserAction[];

describe('roles', () => {
  it('gives every demo user a role that has actions', () => {
    for (const user of Object.values(DEMO_USERS)) {
      expect(actionsOf(user.role).length).toBeGreaterThan(0);
    }
  });

  it('lets the loan officer and the administrator create a record, and nobody else', () => {
    expect(can('loanOfficer', 'createApplication')).toBe(true);
    expect(can('admin', 'createApplication')).toBe(true);
    expect(can('branchManager', 'createApplication')).toBe(false);
    expect(can('creditApprover', 'createApplication')).toBe(false);
  });

  it('lets only the loan officer resubmit a returned application', () => {
    expect(can('loanOfficer', 'resubmitApplication')).toBe(true);
    for (const role of ['branchManager', 'creditApprover', 'admin'] as const) {
      expect(can(role, 'resubmitApplication')).toBe(false);
    }
  });

  it('lets each approver review at their own level only', () => {
    expect(can('branchManager', 'reviewLevel1')).toBe(true);
    expect(can('branchManager', 'reviewLevel2')).toBe(false);
    expect(can('creditApprover', 'reviewLevel2')).toBe(true);
    expect(can('creditApprover', 'reviewLevel1')).toBe(false);
  });

  it('lets the administrator look at everything but approve nothing', () => {
    expect(can('admin', 'viewAllApplications')).toBe(true);
    expect(can('admin', 'viewWorkflow')).toBe(true);
    expect(can('admin', 'reviewLevel1')).toBe(false);
    expect(can('admin', 'reviewLevel2')).toBe(false);
  });

  it('has a plain-words label for every action, and no action nobody can do', () => {
    for (const action of ALL_ACTIONS) {
      expect(ACTION_LABELS[action].length).toBeGreaterThan(10);
      expect(Object.values(ROLE_ACTIONS).some((list) => list.includes(action))).toBe(true);
    }
  });
});
