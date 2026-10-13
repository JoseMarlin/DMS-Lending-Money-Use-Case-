/**
 * The workflow from end to end, through the screens: a loan officer submits, the two approvers
 * decide in the Take Action dialog, and everything else follows by itself (the lists and their
 * counts, the bell, the master list, the Files and Activity log tabs). Only the submission is made
 * through the store (the form has its own tests); every decision is taken through the dialog.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '@/App';
import { useAppStore } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import { submitScenario, user } from '@/test/workflowHelpers';

/** A toast by its words: an Application ID in it is in a span of its own, so it is not one text node. */
const toastText = (text: string) =>
  screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(text));

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

const where = () => screen.getByTestId('location').textContent;
const actAs = (id: DemoUserId) => act(() => state().setCurrentUser(id));
const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);
const bell = () =>
  screen.getByRole('button', { name: /^Notifications, / }).getAttribute('aria-label');
const dialog = () => screen.getByRole('dialog', { name: 'Take Action' });

/** From /workflow: open the request of this applicant with Review Request. */
function openFromList(name: RegExp) {
  const list = screen.getByRole('list', { name: 'Submissions' });
  const link = within(list)
    .getAllByRole('link')
    .find((a) => name.test(a.getAttribute('aria-label') ?? ''))!;
  fireEvent.click(link);
}

/** In the review screen: Take Action, a choice, a comment (and fields), Submit. */
function decide(choice: string, comment: string, fields?: { amount?: string; date?: string }) {
  fireEvent.click(screen.getByRole('button', { name: 'Take Action' }));
  fireEvent.click(within(dialog()).getByRole('radio', { name: choice }));
  if (fields?.amount !== undefined) {
    fireEvent.change(within(dialog()).getByRole('textbox', { name: /^Sanctioned Amount/ }), {
      target: { value: fields.amount },
    });
  }
  if (fields?.date !== undefined) {
    fireEvent.change(within(dialog()).getByRole('textbox', { name: /^Sanction Date/ }), {
      target: { value: fields.date },
    });
  }
  if (comment) {
    fireEvent.change(within(dialog()).getByRole('textbox', { name: /^Comments/ }), {
      target: { value: comment },
    });
  }
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Submit' }));
}

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('scenario A: a clean pass, approved at both levels', () => {
  it('runs from the submission to the record, and every screen follows', async () => {
    const { id, applicationId } = submitScenario('A'); // Ramesh Patil, 18,00,000
    // the seed has seven applications (the last is HL-2026-0007), so the new one is the eighth
    expect(applicationId).toBe('HL-2026-0008');

    // --- Priya has just submitted: nothing for her to act on, her request is in All Workflows
    renderAt('/workflow');
    // (a loan officer sees her own requests: the four seeded ones with a workflow, 0001, 0002, 0004
    // and 0006, and the new one; the draft 0007 has no workflow)
    expect(tabNames()).toEqual(['My Actions (00)', 'Completed (05)', 'All Workflows (05)']);

    // --- Level 1: Mahesh has two tasks, opens the new one and approves
    // (the six seeded instances and the new one are all in his list: he has decided on five of the
    // six, and the sixth, 0003, waits for him with the new one)
    actAs('mahesh');
    expect(tabNames()).toEqual(['My Actions (02)', 'Completed (05)', 'All Workflows (07)']);
    expect(bell()).toBe('Notifications, 2 new');
    openFromList(/Ramesh Patil/);
    expect(where()).toBe(`/workflow/review/${id}`);
    decide('Approve', 'Documents are in order.');
    expect(await screen.findByText('Approved and sent to Level 2')).toBeInTheDocument();
    expect(where()).toBe('/workflow');
    // counts, bell and lists follow: the task is gone from My Actions and is under Completed
    expect(tabNames()).toEqual(['My Actions (01)', 'Completed (06)', 'All Workflows (07)']);
    expect(bell()).toBe('Notifications, 1 new');
    expect(screen.queryByText(/Ramesh Patil/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Completed/ }));
    expect(screen.getByText(/Ramesh Patil/)).toBeInTheDocument();

    // --- Level 2: the task is in Sunita's inbox; she approves with the sanction
    actAs('sunita');
    expect(tabNames()[0]).toBe('My Actions (02)');
    fireEvent.click(screen.getByRole('tab', { name: /^My Actions/ }));
    openFromList(/Ramesh Patil/);
    // she sees what Level 1 said
    expect(screen.getByText('Level 1 decision').nextElementSibling).toHaveTextContent(
      'Documents are in order.',
    );
    decide('Approve', 'Sanctioned as requested.', { amount: '1750000', date: '15/10/2026' });
    expect(await screen.findByText('Application approved and record created')).toBeInTheDocument();
    expect(where()).toBe('/workflow');
    // (she has decided on 0001, 0005 and 0006 before, and now on the new one)
    expect(tabNames()).toEqual(['My Actions (01)', 'Completed (04)', 'All Workflows (07)']);

    // --- the store: the record, the approval fields, the filing and the trail
    const record = state().masterRecords.find((r) => r.applicationId === applicationId)!;
    expect(record.status).toBe('Approved');
    expect(record.sanctionedAmount).toBe(1750000);
    expect(record.sanctionDate).toBe('2026-10-15');
    expect(record.level1Approver).toBe('Mahesh Joshi');
    expect(record.level2Approver).toBe('Sunita Hegde');
    expect(record.documents.every((d) => d.filing)).toBe(true);
    expect(state().workflowInstances.find((i) => i.id === id)!.status).toBe('Completed');
  });

  it('shows the approved application in the master list, with a new record in All Records', async () => {
    const { id, applicationId } = submitScenario('A');
    actAs('mahesh');
    const first = renderAt(`/workflow/review/${id}`);
    decide('Approve', 'Documents are in order.');
    await screen.findByText('Approved and sent to Level 2');
    first.unmount();
    actAs('sunita');
    const second = renderAt(`/workflow/review/${id}`);
    decide('Approve', '', { amount: '1750000' });
    await screen.findByText('Application approved and record created');
    second.unmount();

    // the loan officer: My Submissions shows it as Approved, All Records has the new row
    actAs('priya');
    const list = renderAt('/metadata/master/home-loan');
    const mine = screen.getByRole('table', { name: 'My Submissions' });
    const row = within(mine).getByText('Ramesh Patil').closest('tr')!;
    expect(row).toHaveTextContent('Approved');
    list.unmount();

    renderAt('/metadata/master/home-loan?tab=all-records');
    const records = screen.getByRole('table', { name: 'All Records' });
    const recordRow = within(records).getByText('Ramesh Patil').closest('tr')!;
    expect(recordRow).toHaveTextContent(applicationId);
    expect(recordRow).toHaveTextContent('₹ 17,50,000');
  });

  it('shows the Files and the Activity log of the approved request, and Priya is told', async () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    const one = renderAt(`/workflow/review/${id}`);
    decide('Approve', 'Documents are in order.');
    await screen.findByText('Approved and sent to Level 2');
    one.unmount();
    actAs('sunita');
    const two = renderAt(`/workflow/review/${id}`);
    decide('Approve', 'Sanctioned.');
    await screen.findByText('Application approved and record created');
    two.unmount();

    actAs('priya');
    const inbox = renderAt('/workflow');
    expect(bell()).not.toBe('Notifications, none new'); // messages for the loan officer
    inbox.unmount();
    const files = renderAt(`/workflow/review/${id}?tab=files`);
    const table = screen.getByRole('table', { name: 'Files of the application' });
    expect(within(table).queryByText('Pending filing')).not.toBeInTheDocument();
    const folderLink = within(within(table).getAllByRole('row')[1]).getByRole('link');
    expect(folderLink).toHaveAttribute('href', expect.stringMatching(/^\/files\?folder=/));
    expect(folderLink).toHaveAttribute(
      'title',
      expect.stringContaining('/ Belagavi Main Branch (demo) / '),
    );
    expect(within(within(table).getAllByRole('row')[1]).getByText('Filed')).toBeInTheDocument();
    files.unmount();

    renderAt(`/workflow/review/${id}?tab=activity`);
    const entries = within(
      screen.getByRole('list', { name: 'Activity, newest first' }),
    ).getAllByRole('listitem');
    expect(entries[0]).toHaveTextContent('Files stored');
    expect(entries[1]).toHaveTextContent('Record created');
    expect(screen.getAllByText('Level 1 decision').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Level 2 decision').length).toBeGreaterThan(0);
  });
});

describe('scenario B: a KYC Exception', () => {
  it('shows the badge and the loan officer’s remark to both approvers, all the way', async () => {
    const { applicationId } = submitScenario('B'); // Anita Desai, remark from the loan officer
    const remark = 'The name on the PAN has a middle initial.';

    // Level 1: the badge is in the list and in the review screen, with the remark
    actAs('mahesh');
    const list = renderAt('/workflow');
    const row = within(screen.getByRole('list', { name: 'Submissions' }))
      .getByText(/Anita Desai/)
      .closest('li')!;
    expect(within(row).getByText('KYC Exception')).toBeInTheDocument();
    openFromList(/Anita Desai/);
    expect(
      within(screen.getByRole('heading', { level: 1 })).getByText('KYC Exception'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent(remark);
    decide('Approve', 'Exception noted: the documents match.');
    await screen.findByText('Approved and sent to Level 2');
    list.unmount();

    // Level 2: the same badge and remark, and what Level 1 wrote
    actAs('sunita');
    const two = renderAt('/workflow');
    expect(
      within(
        within(screen.getByRole('list', { name: 'Submissions' }))
          .getByText(/Anita Desai/)
          .closest('li')!,
      ).getByText('KYC Exception'),
    ).toBeInTheDocument();
    openFromList(/Anita Desai/);
    expect(
      within(screen.getByRole('heading', { level: 1 })).getByText('KYC Exception'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent(remark);
    expect(screen.getByText('Level 1 decision').nextElementSibling).toHaveTextContent(
      'Exception noted: the documents match.',
    );
    decide('Approve', 'Sanctioned.');
    await screen.findByText('Application approved and record created');
    two.unmount();

    // the record keeps the result and the remark
    const record = state().masterRecords.find((r) => r.applicationId === applicationId)!;
    expect(record.kycOverallResult).toBe('Exception');
    expect(record.kycExceptionRemark).toBe(remark);
  });
});

describe('a rejection at Level 2', () => {
  it('makes no record, files nothing, and every screen says Rejected', async () => {
    const { id, applicationId } = submitScenario('A');
    actAs('mahesh');
    const one = renderAt(`/workflow/review/${id}`);
    decide('Approve', 'Documents are in order.');
    await screen.findByText('Approved and sent to Level 2');
    one.unmount();

    actAs('sunita');
    const two = renderAt('/workflow');
    openFromList(/Ramesh Patil/);
    decide('Reject', 'Repayment capacity is not enough.');
    expect(await screen.findByText('Application rejected')).toBeInTheDocument();
    expect(where()).toBe('/workflow');
    // it is no longer in My Actions; it is under Completed
    expect(tabNames()).toEqual(['My Actions (01)', 'Completed (04)', 'All Workflows (07)']);
    two.unmount();

    // no master record, the files stay in the workflow
    expect(state().masterRecords).toHaveLength(0);
    const app = state().applications.find((a) => a.applicationId === applicationId)!;
    expect(app.status).toBe('Rejected');
    expect(app.documents.some((d) => d.filing)).toBe(false);

    // the loan officer: Rejected in My Submissions, nothing in All Records
    actAs('priya');
    const mine = renderAt('/metadata/master/home-loan');
    expect(
      within(
        within(screen.getByRole('table', { name: 'My Submissions' }))
          .getByText('Ramesh Patil')
          .closest('tr')!,
      ).getByText('Rejected'),
    ).toBeInTheDocument();
    mine.unmount();
    const all = renderAt('/metadata/master/home-loan?tab=all-records');
    expect(screen.getByText('No records yet')).toBeInTheDocument();
    all.unmount();

    // the review screen: the reason, a Rejected step, and files that were never filed
    const review = renderAt(`/workflow/review/${id}`);
    const steps = within(screen.getByRole('complementary', { name: 'Progress' })).getAllByRole(
      'listitem',
    );
    expect(within(steps[2]).getByText('Rejected')).toBeInTheDocument();
    expect(within(steps[2]).getByText('Repayment capacity is not enough.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take Action' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    review.unmount();
    renderAt(`/workflow/review/${id}?tab=files`);
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(screen.queryByText('In the workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending filing')).not.toBeInTheDocument();
  });

  it('is also what a rejection at Level 1 does', async () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}`);
    decide('Reject', 'KYC does not match.');
    expect(await screen.findByText('Application rejected')).toBeInTheDocument();
    // Sunita never gets it
    actAs('sunita');
    expect(tabNames()[0]).toBe('My Actions (01)');
    expect(state().masterRecords).toHaveLength(0);
  });
});

describe('a return for correction', () => {
  it('goes back to the loan officer as Action Required, and leaves the approvers’ inboxes', async () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}`);
    decide('Return for correction', 'The sale deed is not clear.');
    expect(await screen.findByText('Returned to loan officer')).toBeInTheDocument();
    expect(tabNames()).toEqual(['My Actions (01)', 'Completed (06)', 'All Workflows (07)']);
    actAs('sunita');
    expect(tabNames()[0]).toBe('My Actions (01)');

    // the loan officer is told (the page is /workflow, so the bell is on screen)
    actAs('priya');
    expect(bell()).not.toBe('Notifications, none new');
  });
});

describe('the files, after a decision', () => {
  /** Scenario A, submitted and approved at Level 1 (through the store: the dialog has its own tests). */
  function atLevel2() {
    const submitted = submitScenario('A');
    const one = state().approve(submitted.id, user('mahesh'), 'Documents are in order.');
    if (!one.ok) throw new Error(one.error);
    return submitted;
  }

  it('tells where the files were stored after the final approval, and "Open folder" opens it', async () => {
    const { id, applicationId } = atLevel2();
    actAs('sunita');
    renderAt(`/workflow/review/${id}`);
    decide('Approve', 'Sanctioned.');
    expect(await screen.findByText('Application approved and record created')).toBeInTheDocument();
    const notice = toastText(
      `Files stored in Loans / Home Loan / Belagavi Main Branch (demo) / ${applicationId}`,
    );
    expect(notice).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(where()).toBe(
      `/files?folder=${encodeURIComponent(`Loans/Home Loan/Belagavi Main Branch (demo)/${applicationId} Ramesh Patil`)}`,
    );
    // the folder is there, with its subfolders, and the Sanction Summary in 04 Sanction
    expect(
      await screen.findByRole('heading', { name: 'Files & Folders', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^04 Sanction/ })).toBeInTheDocument();
  });

  it('says "Files held in Rejected" after a rejection, and opens that folder', async () => {
    const { id, applicationId } = atLevel2();
    actAs('sunita');
    renderAt(`/workflow/review/${id}`);
    decide('Reject', 'Repayment capacity is not enough.');
    expect(await screen.findByText('Application rejected')).toBeInTheDocument();
    expect(screen.getByText('Files held in Rejected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(where()).toBe(
      `/files?folder=${encodeURIComponent(`Loans/Home Loan/Rejected/${applicationId} Ramesh Patil`)}`,
    );
  });

  it('says nothing about the files for a decision that does not move them: Level 1 approval, a return', async () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}`);
    decide('Approve', 'Documents are in order.');
    expect(await screen.findByText('Approved and sent to Level 2')).toBeInTheDocument();
    expect(screen.queryByText(/^Files (stored|held)/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open folder' })).not.toBeInTheDocument();
  });

  it('says nothing about the files after a return: they stay in Pending Approval', async () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}`);
    decide('Return for correction', 'The Income Proof is not readable.');
    expect(await screen.findByText('Returned to loan officer')).toBeInTheDocument();
    expect(screen.queryByText(/^Files (stored|held)/)).not.toBeInTheDocument();
    expect(state().movedFolders.some((f) => f.includes('/Rejected'))).toBe(false);
  });
});
