/**
 * The rules of the Take Action dialog, as plain functions: which choices there are, what each one
 * needs (a comment for Reject and Return; the sanctioned amount and date for an approval at Level 2),
 * and what is wrong with the form. The workflow in `src/data/workflow.ts` checks the same rules
 * again when the action is taken, so the dialog and the store never disagree.
 */
import { toISODate } from '@/data/application';
import type { HomeLoanApplication, WorkflowInstance } from '@/data/types';
import { levelOfNode } from '@/data/workflow';
import { formatIndianNumber } from '@/lib/format';

export type ActionChoice = 'approve' | 'reject' | 'return';

/** The three choices, in the order the dialog shows them. "Return for correction" is an addition to the design. */
export const ACTION_OPTIONS: { value: ActionChoice; label: string }[] = [
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'return', label: 'Return for correction' },
];

export interface ActionForm {
  choice: ActionChoice | '';
  comment: string;
  sanctionedAmount: number | null;
  /** ISO date, '' while incomplete */
  sanctionDate: string;
}

export interface ActionErrors {
  choice?: string;
  comment?: string;
  sanctionedAmount?: string;
  sanctionDate?: string;
}

/** 1 when the Branch Manager is deciding, 2 for the Credit approver. */
export const levelOf = (instance: WorkflowInstance): 1 | 2 =>
  levelOfNode(instance.currentNodeIndex);

/** Reject and Return need a comment; an approval does not. */
export const commentRequired = (choice: ActionChoice | ''): boolean =>
  choice === 'reject' || choice === 'return';

/** The sanction fields are for an approval at Level 2 only. */
export const needsSanction = (choice: ActionChoice | '', level: 1 | 2): boolean =>
  choice === 'approve' && level === 2;

/** What the sanction fields start with: the amount that was asked for, and today. */
export function defaultSanction(
  application: Pick<HomeLoanApplication, 'loanAmountRequested'>,
  now: Date = new Date(),
): Pick<ActionForm, 'sanctionedAmount' | 'sanctionDate'> {
  return { sanctionedAmount: application.loanAmountRequested, sanctionDate: toISODate(now) };
}

/** What is wrong with the form now. An empty object means it can be submitted. */
export function validateAction(
  form: ActionForm,
  context: { level: 1 | 2; eligibleAmount: number | null },
): ActionErrors {
  const errors: ActionErrors = {};
  if (form.choice === '') {
    errors.choice = 'Choose Approve, Reject or Return for correction';
    return errors;
  }
  if (commentRequired(form.choice) && form.comment.trim() === '') {
    errors.comment =
      form.choice === 'reject'
        ? 'Add a comment to reject'
        : 'Add a comment to return the application';
  }
  if (needsSanction(form.choice, context.level)) {
    const { eligibleAmount } = context;
    const amount = form.sanctionedAmount;
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      errors.sanctionedAmount = 'Enter the sanctioned amount';
    } else if (eligibleAmount === null) {
      errors.sanctionedAmount = 'There is no Eligible Amount to sanction against';
    } else if (amount > eligibleAmount) {
      errors.sanctionedAmount = `The sanctioned amount cannot be more than the Eligible Amount, ${formatIndianNumber(eligibleAmount)}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.sanctionDate)) {
      errors.sanctionDate = 'Enter the sanction date';
    }
  }
  return errors;
}

/** The form can be submitted: a choice is made and nothing is wrong. */
export const canSubmit = (errors: ActionErrors): boolean => Object.keys(errors).length === 0;
