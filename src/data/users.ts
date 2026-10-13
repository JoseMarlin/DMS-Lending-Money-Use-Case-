/**
 * The demo users: PROJECT_OVERVIEW.md section 5. Dummy people. Kept in a file of their own so that
 * the workflow logic and the seed data can both use them without importing each other.
 */
import type { DemoUser, DemoUserId } from './types';

export const DEMO_USERS: Record<DemoUserId, DemoUser> = {
  priya: {
    id: 'priya',
    name: 'Priya Kulkarni',
    role: 'loanOfficer',
    roleLabel: 'Loan officer (maker)',
    branch: 'Belagavi Main Branch (demo)',
  },
  mahesh: {
    id: 'mahesh',
    name: 'Mahesh Joshi',
    role: 'branchManager',
    roleLabel: 'Level 1 approver, Branch Manager',
    branch: 'Belagavi Main Branch (demo)',
  },
  sunita: {
    id: 'sunita',
    name: 'Sunita Hegde',
    role: 'creditApprover',
    roleLabel: 'Level 2 approver, Credit approver',
    branch: 'Head Office, Credit (demo)',
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    role: 'admin',
    roleLabel: 'Administrator',
    branch: 'Head Office',
  },
};

export const DEFAULT_USER_ID: DemoUserId = 'priya';
