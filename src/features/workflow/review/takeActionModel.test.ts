import { SEED_APPLICATIONS } from '@/data/seed';
import { buildSeedWorkflow } from '@/data/seedWorkflow';
import {
  ACTION_OPTIONS,
  canSubmit,
  commentRequired,
  defaultSanction,
  levelOf,
  needsSanction,
  validateAction,
  type ActionForm,
} from './takeActionModel';

const form = (patch: Partial<ActionForm> = {}): ActionForm => ({
  choice: '',
  comment: '',
  sanctionedAmount: 1800000,
  sanctionDate: '2026-10-12',
  ...patch,
});
const L1 = { level: 1 as const, eligibleAmount: 1950000 };
const L2 = { level: 2 as const, eligibleAmount: 1950000 };

describe('the choices', () => {
  it('are Approve, Reject and Return for correction, in that order', () => {
    expect(ACTION_OPTIONS.map((o) => o.label)).toEqual([
      'Approve',
      'Reject',
      'Return for correction',
    ]);
    expect(ACTION_OPTIONS.map((o) => o.value)).toEqual(['approve', 'reject', 'return']);
  });
});

describe('levelOf', () => {
  const applications = structuredClone(SEED_APPLICATIONS);
  const { workflowInstances } = buildSeedWorkflow(applications);
  const byId = (id: string) => workflowInstances.find((i) => i.id === id)!;

  it('is 1 while the Branch Manager decides and 2 for the Credit approver', () => {
    expect(levelOf(byId('WI-23445215'))).toBe(1);
    expect(levelOf(byId('WI-23445214'))).toBe(2);
  });
});

describe('what each choice needs', () => {
  it('needs a comment to reject or return, not to approve', () => {
    expect(commentRequired('reject')).toBe(true);
    expect(commentRequired('return')).toBe(true);
    expect(commentRequired('approve')).toBe(false);
    expect(commentRequired('')).toBe(false);
  });

  it('needs the sanction fields for an approval at Level 2 only', () => {
    expect(needsSanction('approve', 2)).toBe(true);
    expect(needsSanction('approve', 1)).toBe(false);
    expect(needsSanction('reject', 2)).toBe(false);
    expect(needsSanction('return', 2)).toBe(false);
    expect(needsSanction('', 2)).toBe(false);
  });
});

describe('defaultSanction', () => {
  it('starts with the requested amount and today', () => {
    expect(defaultSanction({ loanAmountRequested: 1800000 }, new Date(2026, 9, 12))).toEqual({
      sanctionedAmount: 1800000,
      sanctionDate: '2026-10-12',
    });
  });

  it('starts with no amount when none was requested', () => {
    expect(
      defaultSanction({ loanAmountRequested: null }, new Date(2026, 9, 12)).sanctionedAmount,
    ).toBeNull();
  });
});

describe('validateAction', () => {
  it('asks for a choice first, and says nothing else until there is one', () => {
    expect(validateAction(form(), L1)).toEqual({
      choice: 'Choose Approve, Reject or Return for correction',
    });
    expect(canSubmit(validateAction(form(), L1))).toBe(false);
  });

  it('lets an approval at Level 1 through with no comment', () => {
    expect(validateAction(form({ choice: 'approve' }), L1)).toEqual({});
    expect(canSubmit({})).toBe(true);
  });

  it('wants a comment to reject, and to return, in words that say which', () => {
    expect(validateAction(form({ choice: 'reject' }), L1).comment).toBe('Add a comment to reject');
    expect(validateAction(form({ choice: 'return' }), L1).comment).toBe(
      'Add a comment to return the application',
    );
  });

  it('does not take spaces for a comment', () => {
    expect(validateAction(form({ choice: 'reject', comment: '   ' }), L1).comment).toBeDefined();
    expect(validateAction(form({ choice: 'reject', comment: ' no ' }), L1)).toEqual({});
  });

  it('does not look at the sanction fields for a rejection or a return, or at Level 1', () => {
    const bad = { sanctionedAmount: null, sanctionDate: '' };
    expect(validateAction(form({ choice: 'reject', comment: 'x', ...bad }), L2)).toEqual({});
    expect(validateAction(form({ choice: 'return', comment: 'x', ...bad }), L2)).toEqual({});
    expect(validateAction(form({ choice: 'approve', ...bad }), L1)).toEqual({});
  });

  it('accepts an approval at Level 2 with an amount up to the Eligible Amount and a date', () => {
    expect(validateAction(form({ choice: 'approve', sanctionedAmount: 1800000 }), L2)).toEqual({});
    expect(validateAction(form({ choice: 'approve', sanctionedAmount: 1950000 }), L2)).toEqual({});
    expect(validateAction(form({ choice: 'approve', sanctionedAmount: 1 }), L2)).toEqual({});
  });

  it('refuses an amount over the Eligible Amount, and says what the limit is', () => {
    expect(
      validateAction(form({ choice: 'approve', sanctionedAmount: 1950001 }), L2).sanctionedAmount,
    ).toBe('The sanctioned amount cannot be more than the Eligible Amount, 19,50,000');
  });

  it('refuses no amount, zero and a negative amount', () => {
    for (const amount of [null, 0, -5, Number.NaN]) {
      expect(
        validateAction(form({ choice: 'approve', sanctionedAmount: amount }), L2).sanctionedAmount,
      ).toBe('Enter the sanctioned amount');
    }
  });

  it('refuses any amount when there is no Eligible Amount', () => {
    expect(
      validateAction(form({ choice: 'approve' }), { level: 2, eligibleAmount: null })
        .sanctionedAmount,
    ).toBe('There is no Eligible Amount to sanction against');
  });

  it('wants a complete date', () => {
    for (const date of ['', '2026-10', '12/10/2026', 'soon']) {
      expect(validateAction(form({ choice: 'approve', sanctionDate: date }), L2).sanctionDate).toBe(
        'Enter the sanction date',
      );
    }
  });

  it('reports the amount and the date together', () => {
    const errors = validateAction(
      form({ choice: 'approve', sanctionedAmount: null, sanctionDate: '' }),
      L2,
    );
    expect(Object.keys(errors).sort()).toEqual(['sanctionDate', 'sanctionedAmount']);
  });
});
