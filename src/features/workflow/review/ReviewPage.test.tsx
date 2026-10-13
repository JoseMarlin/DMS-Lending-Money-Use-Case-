import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

const L1 = '/workflow/review/WI-23445215'; // Manjunath Hiremath, waits for Mahesh
const L2 = '/workflow/review/WI-23445214'; // Shobha Gaonkar, waits for Sunita
const where = () => screen.getByTestId('location').textContent;
const actAs = (id: DemoUserId) => act(() => state().setCurrentUser(id));
const takeAction = () => screen.getByRole('button', { name: 'Take Action' });
const progress = () => screen.getByRole('complementary', { name: 'Progress' });
const left = () => screen.getByRole('complementary', { name: 'Submission' });
const steps = () => within(progress()).getAllByRole('listitem');
const search = () => within(left()).getByRole('textbox', { name: 'Search submissions' });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the page', () => {
  it('is a full-screen page: no sidebar and no shell around it', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Search files/ })).not.toBeInTheDocument();
  });

  it('has the dark bar: a back arrow and the breadcrumb Workflow > Home Loan Approval', () => {
    actAs('mahesh');
    renderAt(L1);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Workflow' })).toHaveAttribute(
      'href',
      '/workflow',
    );
    expect(within(crumbs).getByText('Home Loan Approval')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Back to Workflow' })).toHaveAttribute(
      'href',
      '/workflow',
    );
  });

  it('goes back to /workflow, inside the shell, from the arrow', () => {
    actAs('mahesh');
    renderAt(L1);
    fireEvent.click(screen.getByRole('link', { name: 'Back to Workflow' }));
    expect(where()).toBe('/workflow');
    expect(screen.getByRole('heading', { level: 1, name: 'Workflow' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('names the browser tab after the request', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(document.title).toBe('Review WI-23445215 | DMS+');
  });

  it('has the heading and the meta line from the brief', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Form Submitted · Home Loan Application : Manjunath Hiremath',
    );
    const meta = screen.getByRole('heading', { level: 1 }).nextElementSibling!;
    expect(meta.textContent).toContain('WI-23445215');
    expect(meta.textContent).toContain('Initiated by Gokak loan officer (demo)');
    expect(meta.textContent).toContain('5 Oct 2026, 10:45 AM');
  });

  it('has the Application ID in the meta line as a link that opens the record sheet', () => {
    actAs('mahesh');
    renderAt(L1);
    const meta = screen.getByRole('heading', { level: 1 }).nextElementSibling as HTMLElement;
    const link = within(meta).getByRole('link', { name: 'Open the record of HL-2026-0003' });
    expect(link).toHaveTextContent('HL-2026-0003');
    expect(link).toHaveAttribute('href', '/metadata/master/home-loan?record=HL-2026-0003');
    fireEvent.click(link);
    expect(where()).toBe('/metadata/master/home-loan?record=HL-2026-0003');
    expect(screen.getByRole('dialog', { name: 'Manjunath Hiremath, record' })).toBeInTheDocument();
  });

  it('has a kebab that is only drawn', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(screen.getByRole('button', { name: 'More options' })).toBeDisabled();
  });

  it('says so, with a way back, for a request that does not exist', () => {
    actAs('mahesh');
    renderAt('/workflow/review/WI-00000000');
    expect(
      screen.getByRole('heading', { level: 1, name: 'This workflow request was not found' }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText(/WI-00000000/)).toBeInTheDocument();
    // the arrow of the bar and the link under the message both lead back
    const back = screen.getAllByRole('link', { name: 'Back to Workflow' });
    expect(back).toHaveLength(2);
    fireEvent.click(back[1]);
    expect(where()).toBe('/workflow');
  });

  it('never shows an Aadhaar number, only the masked one', () => {
    for (const [who, path] of [
      ['mahesh', L1],
      ['sunita', L2],
      ['admin', '/workflow/review/WI-23445217'],
    ] as const) {
      actAs(who);
      const { unmount } = renderAt(path);
      expect(document.body.textContent).toMatch(/XXXX XXXX \d{4}/);
      expect(document.body.textContent).not.toMatch(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
      unmount();
    }
  });
});

describe('Take Action', () => {
  it('is on for the approver whose turn it is', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(takeAction()).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('is on for the Credit approver at Level 2', () => {
    actAs('sunita');
    renderAt(L2);
    expect(takeAction()).not.toHaveAttribute('aria-disabled');
  });

  it('is off, with a tip that says why, for the wrong person', () => {
    actAs('sunita');
    renderAt(L1);
    expect(takeAction()).toHaveAttribute('aria-disabled', 'true');
    expect(takeAction()).toHaveAccessibleDescription(
      'Waiting for Mahesh Joshi (Branch Manager). You have no action on this request.',
    );
  });

  it('is off for the loan officer and the administrator', () => {
    for (const who of ['priya', 'admin'] as const) {
      actAs(who);
      const { unmount } = renderAt(L1);
      expect(takeAction()).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      unmount();
    }
  });

  it('is off on a request that is finished, and says so', () => {
    actAs('mahesh');
    renderAt('/workflow/review/WI-23445213'); // Vijay, completed
    expect(takeAction()).toHaveAttribute('aria-disabled', 'true');
    expect(takeAction()).toHaveAccessibleDescription(
      'This request is completed, so nothing is waiting for action.',
    );
  });

  it('is off for the person who submitted it', () => {
    const { id } = submitScenario('A');
    actAs('priya');
    renderAt(`/workflow/review/${id}`);
    expect(takeAction()).toHaveAccessibleDescription(
      'You submitted this request, so you cannot act on it.',
    );
  });

  it('shows the tip while it has the focus, and Escape hides it', () => {
    actAs('priya');
    renderAt(L1);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveClass('hidden');
    act(() => takeAction().focus());
    expect(tip).toHaveClass('block');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(tip).toHaveClass('hidden');
    expect(takeAction()).toHaveFocus();
  });

  it('does nothing when it is off, and can still be reached with the keyboard', () => {
    actAs('priya');
    renderAt(L1);
    takeAction().focus();
    expect(takeAction()).toHaveFocus();
    fireEvent.click(takeAction());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the Take Action dialog when it is on', () => {
    actAs('mahesh');
    renderAt(L1);
    fireEvent.click(takeAction());
    expect(screen.getByRole('dialog', { name: 'Take Action' })).toBeInTheDocument();
  });

  it('follows the store while the page is open: after Level 1 decides, Mahesh has nothing left', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(takeAction()).not.toHaveAttribute('aria-disabled');
    act(() => {
      expect(state().approve('WI-23445215', DEMO_USERS.mahesh, 'Documents are in order.').ok).toBe(
        true,
      );
    });
    expect(takeAction()).toHaveAttribute('aria-disabled', 'true');
    expect(within(steps()[1]).getByText('Approved')).toBeInTheDocument();
    expect(within(steps()[1]).getByText('Documents are in order.')).toBeInTheDocument();
    expect(within(steps()[2]).getByText('Waiting for approval')).toBeInTheDocument();
  });
});

describe('the Progress panel', () => {
  it('has one step for each node, in order, with the names of the workflow', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(steps()).toHaveLength(4);
    const names = steps().map((s) => s.querySelector('p')?.textContent); // the first line is the name
    expect(names).toEqual([
      'Initiator',
      'Level 1: Branch Manager',
      'Level 2: Credit Approver',
      'Record creation and filing',
    ]);
  });

  it('marks the current step, and tells the approver their approval is required', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(steps()[1]).toHaveAttribute('aria-current', 'step');
    expect(within(steps()[1]).getByText('Your approval required')).toBeInTheDocument();
    expect(within(steps()[0]).getByText('Submitted')).toBeInTheDocument();
    expect(steps().filter((s) => s.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('tells everybody else only that it is waiting', () => {
    actAs('priya');
    renderAt(L1);
    expect(within(steps()[1]).getByText('Waiting for approval')).toBeInTheDocument();
    expect(within(progress()).queryByText('Your approval required')).not.toBeInTheDocument();
  });

  it('shows who and when for a step that is done, and only the name for one that is not', () => {
    actAs('sunita');
    renderAt(L2);
    expect(steps()[1]).toHaveTextContent('Mahesh Joshi · 17 Sep 2026, 11:00 AM');
    expect(within(steps()[1]).getByText('Business income verified.')).toBeInTheDocument();
    expect(within(steps()[2]).getByText('Sunita Hegde')).toBeInTheDocument();
    expect(within(steps()[3]).getByText('System')).toBeInTheDocument();
  });

  it('shows a rejection in the step that did it, with its reason', () => {
    actAs('admin');
    renderAt('/workflow/review/WI-23445217');
    expect(within(steps()[2]).getByText('Rejected')).toBeInTheDocument();
    expect(within(steps()[2]).getByText(/Repayment capacity/)).toBeInTheDocument();
    expect(steps().some((s) => s.hasAttribute('aria-current'))).toBe(false);
  });

  it('can be reached with the keyboard when it has to scroll', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(within(progress()).getByRole('list', { name: 'Progress steps' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });

  it('has a rail with the Progress icon selected and the comments icon only drawn', () => {
    actAs('mahesh');
    renderAt(L1);
    const rail = screen.getByRole('navigation', { name: 'Panels' });
    expect(within(rail).getByRole('button', { name: 'Progress' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(rail).getByRole('button', { name: 'Comments' })).toBeDisabled();
  });
});

describe('the Submission panel', () => {
  it('lists what waits for the current user, with Pending, the ID and the date', () => {
    actAs('mahesh');
    renderAt(L1);
    const list = within(left()).getByRole('list', { name: 'Pending submissions' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Manjunath Hiremath');
    expect(items[0]).toHaveTextContent('Pending');
    expect(items[0]).toHaveTextContent('WI-23445215');
    expect(items[0]).toHaveTextContent('5 Oct, 26');
    expect(within(items[0]).getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('opens another submission when it is selected, and the whole screen follows', () => {
    const { id } = submitScenario('A'); // a second task for Mahesh
    actAs('mahesh');
    renderAt(L1);
    const list = within(left()).getByRole('list', { name: 'Pending submissions' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(within(list).getByRole('button', { name: /Ramesh Patil/ }));
    expect(where()).toBe(`/workflow/review/${id}`);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ramesh Patil');
    expect(document.title).toBe(`Review ${id} | DMS+`);
    expect(
      within(within(left()).getByRole('list', { name: 'Pending submissions' })).getByRole(
        'button',
        {
          name: /Ramesh Patil/,
        },
      ),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('does nothing when the one on screen is selected', () => {
    actAs('mahesh');
    renderAt(L1);
    fireEvent.click(within(left()).getByRole('button', { name: /Manjunath/ }));
    expect(where()).toBe(L1);
  });

  it('narrows by the search, and says so when nothing matches', () => {
    submitScenario('A');
    actAs('mahesh');
    renderAt(L1);
    fireEvent.change(search(), { target: { value: 'ramesh' } });
    const list = within(left()).getByRole('list', { name: 'Pending submissions' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(within(left()).queryByRole('list')).not.toBeInTheDocument();
    expect(within(left()).getByText('No submission matches the search.')).toBeInTheDocument();
    fireEvent.change(search(), { target: { value: '' } });
    expect(
      within(within(left()).getByRole('list', { name: 'Pending submissions' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2);
  });

  it('tells a screen reader how many submissions the list holds, also after a search', () => {
    actAs('mahesh');
    renderAt(L1);
    const status = () => within(left()).getByRole('status');
    expect(status()).toHaveTextContent('1 submission waiting for you');
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(status()).toHaveTextContent('0 submissions match the search');
    fireEvent.change(search(), { target: { value: 'manju' } });
    expect(status()).toHaveTextContent('1 submission match the search');
  });

  it('starts at the top again when another submission is opened', () => {
    submitScenario('A');
    actAs('mahesh');
    renderAt(L1);
    const before = screen.getByRole('tabpanel');
    fireEvent.click(within(left()).getByRole('button', { name: /Ramesh Patil/ }));
    expect(screen.getByRole('tabpanel')).not.toBe(before);
  });

  it('says nothing waits for a user with no tasks, and draws the filter icon only', () => {
    actAs('priya');
    renderAt(L1);
    expect(within(left()).getByText('No submissions are waiting for you.')).toBeInTheDocument();
    expect(within(left()).getByRole('button', { name: 'Filter submissions' })).toBeDisabled();
  });
});

describe('the tabs', () => {
  it('are Record Details, Activity log and Files, and open on Record Details', () => {
    actAs('mahesh');
    renderAt(L1);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Record Details',
      'Activity log',
      'Files',
    ]);
    expect(screen.getByRole('tab', { name: 'Record Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keep the tab in the address, and open on the one in it', () => {
    actAs('mahesh');
    renderAt(`${L1}?tab=files`);
    expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Activity log' }));
    expect(where()).toBe(`${L1}?tab=activity`);
    fireEvent.click(screen.getByRole('tab', { name: 'Record Details' }));
    expect(where()).toBe(L1);
  });

  it('open on Record Details for a tab they do not know', () => {
    actAs('mahesh');
    renderAt(`${L1}?tab=nonsense`);
    expect(screen.getByRole('tab', { name: 'Record Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('move with the arrow keys', () => {
    actAs('mahesh');
    renderAt(L1);
    const first = screen.getByRole('tab', { name: 'Record Details' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Activity log' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Activity log' })).toHaveFocus();
  });
});

describe('Record Details', () => {
  it('has label and value rows under the small headings of the brief', () => {
    actAs('mahesh');
    renderAt(L1);
    const panel = screen.getByRole('tabpanel');
    const headings = within(panel)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(
      expect.arrayContaining([
        'Application',
        'Applicant',
        'Identity',
        'Property',
        'Sureties',
        'Consent',
        'KYC Result',
      ]),
    );
    const id = within(panel).getByText('Application ID');
    expect(id.tagName).toBe('DT');
    expect(id.nextElementSibling?.tagName).toBe('DD');
    expect(id.nextElementSibling).toHaveTextContent(/^HL-2026-\d{4}$/);
    expect(within(panel).getByText('Aadhaar').nextElementSibling).toHaveTextContent(
      /^XXXX XXXX \d{4}$/,
    );
  });

  it('has the KYC Result block with the result, the match percent and the three statuses', () => {
    actAs('admin');
    renderAt('/workflow/review/WI-23445217'); // Basavaraj: Exception
    const panel = screen.getByRole('tabpanel');
    const value = (label: string) => within(panel).getByText(label).nextElementSibling!;
    expect(value('KYC Overall Result')).toHaveTextContent('Exception');
    expect(value('Name Match Percent')).toHaveTextContent('88%');
    expect(value('PAN Status')).toHaveTextContent('Verified');
    expect(value('Aadhaar Status')).toHaveTextContent('Verified');
    expect(value('GST Status')).toHaveTextContent('Verified');
    expect(value('KYC Exception Remark')).toHaveTextContent(/Middle initial missing/);
  });

  it('shows the Level 1 decision row to the Credit approver at Level 2 only', () => {
    actAs('sunita');
    const { unmount } = renderAt(L2);
    const panel = screen.getByRole('tabpanel');
    const row = within(panel).getByText('Level 1 decision');
    expect(row.nextElementSibling).toHaveTextContent('Approved');
    expect(row.nextElementSibling).toHaveTextContent('Mahesh Joshi');
    expect(row.nextElementSibling).toHaveTextContent('Business income verified.');
    unmount();

    actAs('mahesh');
    renderAt(L1);
    expect(screen.queryByText('Level 1 decision')).not.toBeInTheDocument();
  });

  it('does not show the Level 1 decision row to the Credit approver before Level 1 decides', () => {
    actAs('sunita');
    renderAt(L1);
    expect(screen.queryByText('Level 1 decision')).not.toBeInTheDocument();
  });

  it('has no Co-applicant section unless there is a co-applicant', () => {
    actAs('mahesh');
    renderAt(L1);
    const headings = within(screen.getByRole('tabpanel'))
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(headings).not.toContain('Co-applicant');
  });

  it('shows an Aadhaar typed into a comment only masked, in the Progress panel and the Level 1 row', () => {
    act(() => {
      expect(
        state().approve('WI-23445215', DEMO_USERS.mahesh, 'Aadhaar 234500074821 matches the PAN.')
          .ok,
      ).toBe(true);
    });
    actAs('sunita');
    renderAt(L1);
    expect(document.body.textContent).toContain('Aadhaar XXXX XXXX 4821 matches the PAN.');
    expect(document.body.textContent).not.toContain('234500074821');
    expect(document.body.textContent).not.toMatch(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
  });

  it('says so when the application is gone', () => {
    actAs('mahesh');
    act(() => {
      useAppStore.setState({ applications: [] });
    });
    renderAt(L1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('is not in this demo any more');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Form Submitted · Home Loan Application',
    );
  });
});

describe('the KYC Exception (scenario B)', () => {
  it("shows a badge in the heading, and the loan officer's remark, to both approvers", () => {
    const { id } = submitScenario('B');
    for (const [who, setup] of [
      ['mahesh', () => {}],
      [
        'sunita',
        () => {
          const out = state().approve(id, DEMO_USERS.mahesh, 'KYC exception noted.');
          expect(out.ok).toBe(true);
        },
      ],
    ] as const) {
      act(() => setup());
      actAs(who);
      const { unmount } = renderAt(`/workflow/review/${id}`);
      expect(
        within(screen.getByRole('heading', { level: 1 })).getByText('KYC Exception'),
      ).toBeInTheDocument();
      expect(screen.getByRole('tabpanel')).toHaveTextContent(
        'The name on the PAN has a middle initial.',
      );
      expect(
        within(screen.getByRole('tabpanel')).getByText('KYC Overall Result').nextElementSibling,
      ).toHaveTextContent('Exception');
      unmount();
    }
  });

  it('shows no badge for a clean pass, and no remark row', () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}`);
    expect(screen.queryByText('KYC Exception')).not.toBeInTheDocument();
    expect(screen.queryByText('KYC Exception Remark')).not.toBeInTheDocument();
    expect(screen.getByText('KYC Overall Result').nextElementSibling).toHaveTextContent('Pass');
  });
});
