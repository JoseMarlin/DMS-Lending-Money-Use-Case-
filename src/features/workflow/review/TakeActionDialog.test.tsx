import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '@/App';
import { useAppStore } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import { submitScenario } from '@/test/workflowHelpers';

const state = () => useAppStore.getState();

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Probe />
    </MemoryRouter>,
  );
}

const L1 = '/workflow/review/WI-23445215'; // Manjunath Hiremath: asks 12,00,000, waits for Mahesh
const L2 = '/workflow/review/WI-23445214'; // Shobha Gaonkar: asks 15,00,000, waits for Sunita
const where = () => screen.getByTestId('location').textContent;
const actAs = (id: DemoUserId) => act(() => state().setCurrentUser(id));
const takeAction = () => screen.getByRole('button', { name: 'Take Action' });
const dialog = () => screen.getByRole('dialog', { name: 'Take Action' });
const open = () => {
  fireEvent.click(takeAction());
  return dialog();
};
const choose = (name: string) => fireEvent.click(within(dialog()).getByRole('radio', { name }));
const comments = () => within(dialog()).getByRole('textbox', { name: /^Comments/ });
const submit = () => within(dialog()).getByRole('button', { name: 'Submit' });
const amount = () => within(dialog()).getByRole('textbox', { name: /^Sanctioned Amount/ });
const date = () => within(dialog()).getByRole('textbox', { name: /^Sanction Date/ });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const instanceOf = (id: string) => state().workflowInstances.find((i) => i.id === id)!;
const appOf = (id: string) =>
  state().applications.find((a) => a.applicationId === instanceOf(id).applicationId)!;

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('opening and closing', () => {
  it('opens as a dialog named Take Action, with the choices, a comment box, Cancel and Submit', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const d = open();
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(within(d).getByRole('group', { name: 'Select Action' })).toBeInTheDocument();
    expect(
      within(d)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['Approve', 'Reject', 'Return for correction']);
    expect(comments()).toHaveAttribute('placeholder', 'Write a comment...');
    expect(within(d).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(submit()).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('starts with nothing chosen, and Submit off', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    for (const radio of within(dialog()).getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(submit()).toBeDisabled();
  });

  it('puts the cursor on the first choice', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    expect(within(dialog()).getByRole('radio', { name: 'Approve' })).toHaveFocus();
  });

  it('closes with Cancel, the cross and Escape, and nothing happens to the request', () => {
    actAs('mahesh');
    renderAt(L1);
    const before = JSON.stringify(instanceOf('WI-23445215'));
    for (const close of [
      () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' })),
      () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' })),
      () => fireEvent.keyDown(document, { key: 'Escape' }),
    ]) {
      open();
      choose('Reject');
      type(comments(), 'Changed my mind');
      close();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(where()).toBe(L1);
      expect(JSON.stringify(instanceOf('WI-23445215'))).toBe(before);
    }
  });

  it('gives the cursor back to Take Action when it closes', () => {
    actAs('mahesh');
    renderAt(L1);
    act(() => takeAction().focus());
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(takeAction()).toHaveFocus();
  });

  it('starts empty each time it is opened', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Reject');
    type(comments(), 'Typed text');
    fireEvent.keyDown(document, { key: 'Escape' });
    open();
    expect(within(dialog()).getByRole('radio', { name: 'Reject' })).not.toBeChecked();
    expect(comments()).toHaveValue('');
  });

  it('does not open for somebody who has no action', () => {
    actAs('priya');
    renderAt(L1);
    fireEvent.click(takeAction());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the form at Level 1', () => {
  it('lets Approve through with no comment, and has no sanction fields', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Approve');
    expect(submit()).toBeEnabled();
    expect(
      within(dialog()).queryByRole('textbox', { name: /^Sanctioned Amount/ }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog()).queryByRole('textbox', { name: /^Sanction Date/ }),
    ).not.toBeInTheDocument();
    expect(within(dialog()).getByText('Optional.')).toBeInTheDocument();
  });

  it('wants a comment to reject, and to return, and says so', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    for (const choice of ['Reject', 'Return for correction']) {
      choose(choice);
      expect(submit()).toBeDisabled();
      expect(within(dialog()).getByText('Required to reject or return.')).toBeInTheDocument();
      type(comments(), '   ');
      expect(submit()).toBeDisabled();
      type(comments(), 'Add the sale deed.');
      expect(submit()).toBeEnabled();
      type(comments(), '');
    }
  });

  it('shows the error under the comment box once it was left empty, and takes it away when filled', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Reject');
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.blur(comments());
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Add a comment to reject');
    expect(comments()).toHaveAttribute('aria-invalid', 'true');
    type(comments(), 'Not eligible.');
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
    choose('Return for correction');
    type(comments(), '');
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'Add a comment to return the application',
    );
  });

  it('turns Submit off again if the choice is a reject and the comment is deleted', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Reject');
    type(comments(), 'x');
    expect(submit()).toBeEnabled();
    type(comments(), '');
    expect(submit()).toBeDisabled();
  });
});

describe('the form at Level 2', () => {
  it('asks for the Sanctioned Amount and the Sanction Date when approving, with the defaults', () => {
    actAs('sunita');
    renderAt(L2);
    open();
    expect(
      within(dialog()).queryByRole('textbox', { name: /^Sanctioned Amount/ }),
    ).not.toBeInTheDocument();
    choose('Approve');
    expect(amount()).toHaveValue('15,00,000'); // what was asked for, in Indian grouping
    const today = new Date();
    const expected = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    expect(date()).toHaveValue(expected);
    expect(amount()).toBeRequired();
    expect(date()).toBeRequired();
    expect(submit()).toBeEnabled();
  });

  it('says what was asked for and the limit under the amount', () => {
    actAs('sunita');
    renderAt(L2);
    open();
    choose('Approve');
    const eligible = appOf('WI-23445214').eligibleAmount!.toLocaleString('en-IN');
    expect(
      within(dialog()).getByText(`Asked for 15,00,000. Up to ${eligible}.`),
    ).toBeInTheDocument();
  });

  it('keeps the fields off for a rejection and a return', () => {
    actAs('sunita');
    renderAt(L2);
    open();
    for (const choice of ['Reject', 'Return for correction']) {
      choose(choice);
      expect(
        within(dialog()).queryByRole('textbox', { name: /^Sanctioned Amount/ }),
      ).not.toBeInTheDocument();
    }
  });

  it('writes the amount with Indian grouping as it is typed', () => {
    actAs('sunita');
    renderAt(L2);
    open();
    choose('Approve');
    type(amount(), '1250000');
    expect(amount()).toHaveValue('12,50,000');
  });

  it('refuses an amount over the Eligible Amount, with the limit, and turns Submit off', () => {
    actAs('sunita');
    renderAt(L2);
    const eligible = appOf('WI-23445214').eligibleAmount!;
    open();
    choose('Approve');
    type(amount(), String(eligible + 1));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      /cannot be more than the Eligible Amount, /,
    );
    expect(amount()).toHaveAttribute('aria-invalid', 'true');
    expect(submit()).toBeDisabled();
    type(amount(), String(eligible));
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('turns Submit off for an empty amount and for an incomplete date', () => {
    actAs('sunita');
    renderAt(L2);
    open();
    choose('Approve');
    type(amount(), '');
    expect(submit()).toBeDisabled();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Enter the sanctioned amount');
    type(amount(), '1000000');
    expect(submit()).toBeEnabled();
    type(date(), '12/10');
    expect(submit()).toBeDisabled();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Enter the sanction date');
  });
});

describe('Submit at Level 1', () => {
  it('approves: Level 2 gets the task, the toast says so, and the user is back at /workflow', async () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Approve');
    type(comments(), 'Documents are in order.');
    fireEvent.click(submit());
    expect(await screen.findByText('Approved and sent to Level 2')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(where()).toBe('/workflow');
    expect(instanceOf('WI-23445215').currentNodeIndex).toBe(3);
    expect(appOf('WI-23445215').status).toBe('In Level 2');
    expect(appOf('WI-23445215').level1Remarks).toBe('Documents are in order.');
  });

  it('approves with no comment', async () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Approve');
    fireEvent.click(submit());
    expect(await screen.findByText('Approved and sent to Level 2')).toBeInTheDocument();
    expect(instanceOf('WI-23445215').nodes[1].comment).toBe('');
  });

  it('rejects with the comment, and says so', async () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Reject');
    type(comments(), 'Income is not enough.');
    fireEvent.click(submit());
    expect(await screen.findByText('Application rejected')).toBeInTheDocument();
    expect(where()).toBe('/workflow');
    expect(instanceOf('WI-23445215').status).toBe('Rejected');
    expect(appOf('WI-23445215').status).toBe('Rejected');
    expect(state().masterRecords).toHaveLength(0);
  });

  it('returns for correction, and says it went to the loan officer', async () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Return for correction');
    type(comments(), 'Add the sale deed.');
    fireEvent.click(submit());
    expect(await screen.findByText('Returned to loan officer')).toBeInTheDocument();
    expect(instanceOf('WI-23445215').status).toBe('Returned');
    expect(appOf('WI-23445215').status).toBe('Returned');
  });

  it('trims the comment, and keeps an Aadhaar number out of everything it writes', async () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Reject');
    type(comments(), '  Aadhaar 234500074821 is not the applicant’s.  ');
    fireEvent.click(submit());
    await screen.findByText('Application rejected');
    const comment = instanceOf('WI-23445215').nodes[1].comment;
    expect(comment).toBe('Aadhaar XXXX XXXX 4821 is not the applicant’s.');
    expect(JSON.stringify(state())).not.toContain('234500074821');
  });
});

describe('Submit at Level 2', () => {
  it('approves with the amount and date: the record is created and the files are filed', async () => {
    actAs('sunita');
    renderAt(L2);
    open();
    choose('Approve');
    type(amount(), '1400000');
    type(date(), '15/10/2026');
    type(comments(), 'Sanctioned.');
    fireEvent.click(submit());
    expect(await screen.findByText('Application approved and record created')).toBeInTheDocument();
    expect(where()).toBe('/workflow');
    const app = appOf('WI-23445214');
    expect(app.status).toBe('Approved');
    expect(app.sanctionedAmount).toBe(1400000);
    expect(app.sanctionDate).toBe('2026-10-15');
    expect(app.level2Remarks).toBe('Sanctioned.');
    expect(instanceOf('WI-23445214').status).toBe('Completed');
    expect(state().masterRecords.map((r) => r.applicationId)).toContain(app.applicationId);
    expect(app.documents.every((d) => d.filing)).toBe(true);
  });

  it('approves with the defaults: the requested amount and today', async () => {
    actAs('sunita');
    renderAt(L2);
    open();
    choose('Approve');
    fireEvent.click(submit());
    await screen.findByText('Application approved and record created');
    expect(appOf('WI-23445214').sanctionedAmount).toBe(1500000);
    expect(appOf('WI-23445214').sanctionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects, and no record is made and no file is filed', async () => {
    actAs('sunita');
    renderAt(L2);
    open();
    choose('Reject');
    type(comments(), 'Repayment capacity is low.');
    fireEvent.click(submit());
    expect(await screen.findByText('Application rejected')).toBeInTheDocument();
    expect(state().masterRecords).toHaveLength(0);
    expect(appOf('WI-23445214').documents.some((d) => d.filing)).toBe(false);
    expect(instanceOf('WI-23445214').status).toBe('Rejected');
  });

  it('returns for correction', async () => {
    actAs('sunita');
    renderAt(L2);
    open();
    choose('Return for correction');
    type(comments(), 'Please explain the income gap.');
    fireEvent.click(submit());
    expect(await screen.findByText('Returned to loan officer')).toBeInTheDocument();
    expect(appOf('WI-23445214').status).toBe('Returned');
  });
});

describe('when the store refuses', () => {
  it('shows what it said in the dialog, keeps the dialog open and changes nothing', () => {
    actAs('mahesh');
    renderAt(L1);
    open();
    choose('Reject');
    type(comments(), 'Not eligible.');
    // somebody else decides while the dialog is open: it is no longer Mahesh's step
    act(() => {
      expect(state().approve('WI-23445215', DEMO_USERS.mahesh, 'Done.').ok).toBe(true);
    });
    fireEvent.click(submit());
    expect(within(dialog()).getByText('This step is for the Credit Approver')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(where()).toBe(L1);
    expect(instanceOf('WI-23445215').status).toBe('In Progress');
    // the message goes away when the form is changed
    type(comments(), 'Not eligible at all.');
    expect(
      within(dialog()).queryByText('This step is for the Credit Approver'),
    ).not.toBeInTheDocument();
  });
});

describe('on a new submission', () => {
  it('works on the request the user has just been given', async () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}`);
    open();
    choose('Approve');
    fireEvent.click(submit());
    expect(await screen.findByText('Approved and sent to Level 2')).toBeInTheDocument();
    expect(instanceOf(id).currentNodeIndex).toBe(3);
  });
});

/** Buttons that move through the history, as the browser's Back and Forward do. */
function History() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>history back</button>
      <button onClick={() => navigate(1)}>history forward</button>
      <button onClick={() => navigate('/workflow/review/WI-00000000')}>
        go to an unknown request
      </button>
    </>
  );
}

function renderHistory(entries: string[], index: number) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <App />
      <Probe />
      <History />
    </MemoryRouter>,
  );
}

describe('the dialog belongs to the request it was opened on', () => {
  const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

  it('closes when the browser goes Back to another request, and does not apply the old form there', () => {
    const { id } = submitScenario('A'); // a second task for Mahesh
    actAs('mahesh');
    renderHistory([L1, `/workflow/review/${id}`], 1);
    open();
    choose('Return for correction');
    type(comments(), 'sale deed unclear (about Ramesh)');
    press('history back');
    expect(where()).toBe(L1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // nothing was decided for Manjunath
    expect(instanceOf('WI-23445215').status).toBe('In Progress');
    expect(appOf('WI-23445215').status).toBe('In Level 1');
  });

  it('is not open when the user comes Forward again, and starts empty when opened', () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderHistory([L1, `/workflow/review/${id}`], 1);
    open();
    choose('Reject');
    type(comments(), 'Typed for Ramesh');
    press('history back');
    press('history forward');
    expect(where()).toBe(`/workflow/review/${id}`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    open();
    expect(within(dialog()).getByRole('radio', { name: 'Reject' })).not.toBeChecked();
    expect(comments()).toHaveValue('');
  });

  it('does not come back by itself after a trip through "request not found"', () => {
    actAs('mahesh');
    renderHistory([L1], 0);
    open();
    press('go to an unknown request');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    press('history back');
    expect(where()).toBe(L1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the dialog open while the same request stays on screen', () => {
    actAs('mahesh');
    renderHistory([L1], 0);
    open();
    choose('Reject');
    type(comments(), 'Still here');
    // the store changes (another request is added): the open dialog is not disturbed
    act(() => void submitScenario('A'));
    actAs('mahesh');
    expect(dialog()).toBeInTheDocument();
    expect(comments()).toHaveValue('Still here');
  });
});
