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

function renderAt(path = '/workflow') {
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
const list = () => screen.queryByRole('list', { name: 'Submissions' });
const rows = () => (list() ? within(list()!).getAllByRole('listitem') : []);
const titles = () => rows().map((r) => r.querySelector('p')?.textContent ?? '');
const search = () => screen.getByRole('textbox', { name: 'Search Workflow' });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the page', () => {
  it('is drawn in the shell, with Workflow active in the sidebar and the title Workflow', () => {
    actAs('mahesh');
    renderAt();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Workflow');
    expect(
      within(screen.getByRole('complementary', { name: 'Sidebar' })).getByRole('link', {
        name: 'Workflow',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Workflow | DMS+');
  });

  it('has three tabs with counts, and opens on My Actions', () => {
    actAs('mahesh');
    renderAt();
    expect(tabNames()).toEqual(['My Actions (01)', 'Completed (05)', 'All Workflows (06)']);
    expect(screen.getByRole('tab', { name: /^My Actions/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens on the tab in the address', () => {
    actAs('mahesh');
    renderAt('/workflow?tab=completed');
    expect(screen.getByRole('tab', { name: /^Completed/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(rows()).toHaveLength(5);
  });

  it('opens on My Actions for a tab it does not know', () => {
    actAs('mahesh');
    renderAt('/workflow?tab=nonsense');
    expect(screen.getByRole('tab', { name: /^My Actions/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps the tab in the address, and leaves it off for My Actions', () => {
    actAs('mahesh');
    renderAt();
    fireEvent.click(screen.getByRole('tab', { name: /^All Workflows/ }));
    expect(where()).toBe('/workflow?tab=all');
    fireEvent.click(screen.getByRole('tab', { name: /^My Actions/ }));
    expect(where()).toBe('/workflow');
  });

  it('has the Create Workflow button for the administrator only', () => {
    actAs('admin');
    renderAt();
    expect(screen.getByRole('button', { name: 'Create Workflow' })).toBeInTheDocument();
    for (const id of ['priya', 'mahesh', 'sunita'] as const) {
      actAs(id);
      expect(screen.queryByRole('button', { name: 'Create Workflow' })).not.toBeInTheDocument();
    }
  });

  it('has the toolbar: a working search, and Filter, the date range and Export drawn', () => {
    actAs('mahesh');
    renderAt();
    expect(search()).toBeInTheDocument();
    for (const name of ['Filter', 'DD/MM/YY - DD/MM/YY', 'Export']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { level: 2, name: 'Submissions' })).toBeInTheDocument();
  });

  it('does nothing when Filter, the date range or Export is pressed', () => {
    actAs('mahesh');
    renderAt();
    const before = document.body.innerHTML;
    for (const name of ['Filter', 'DD/MM/YY - DD/MM/YY', 'Export']) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(document.body.innerHTML).toBe(before);
    expect(where()).toBe('/workflow');
  });
});

describe('a row', () => {
  it('reads like the design', () => {
    actAs('mahesh');
    renderAt();
    const [row] = rows();
    expect(row).toHaveTextContent('Form Submitted · Home Loan Application · Manjunath Hiremath');
    expect(row).toHaveTextContent(
      'WI-23445215 · Home Loan Approval · Initiated by Gokak loan officer (demo)',
    );
  });

  it('has Review Request in My Actions, and it opens the review screen of the instance', () => {
    actAs('mahesh');
    renderAt();
    const link = within(rows()[0]).getByRole('link');
    expect(link).toHaveTextContent('Review Request');
    fireEvent.click(link);
    expect(where()).toBe('/workflow/review/WI-23445215');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Form Submitted · Home Loan Application : Manjunath Hiremath',
    );
  });

  it('leaves the app shell for the review screen', () => {
    actAs('mahesh');
    renderAt();
    fireEvent.click(within(rows()[0]).getByRole('link'));
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to Workflow' }));
    expect(where()).toBe('/workflow');
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('has View in Completed, and Review Request only where it is the turn of the user in All Workflows', () => {
    actAs('mahesh');
    renderAt('/workflow?tab=completed');
    expect(rows().every((r) => within(r).getByRole('link').textContent === 'View')).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: /^All Workflows/ }));
    const buttons = rows().map((r) => within(r).getByRole('link').textContent);
    expect(buttons.filter((b) => b === 'Review Request')).toHaveLength(1);
    expect(buttons.filter((b) => b === 'View')).toHaveLength(5);
  });

  it('puts the newest first, and the order button turns it around', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    const newest = titles();
    expect(newest[0]).toContain('Manjunath Hiremath');
    fireEvent.click(screen.getByRole('button', { name: /^Order: newest first/ }));
    expect(titles()).toEqual([...newest].reverse());
    expect(screen.getByRole('button', { name: /^Order: oldest first/ })).toBeInTheDocument();
  });

  it('never shows an Aadhaar number', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    expect(document.body.textContent).not.toMatch(/\d{4}[\s-]?\d{4}[\s-]?\d{4}/);
  });
});

describe('the KYC Exception badge', () => {
  it('is on the row of an application with an Exception result, and on no other', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    const flagged = rows().filter((r) => within(r).queryByText('KYC Exception'));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toHaveTextContent('Basavaraj Kadam');
  });

  it('comes after the title', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    const row = rows().find((r) => within(r).queryByText('KYC Exception'))!;
    const line = row.querySelector('p')!;
    expect(line.lastElementChild).toHaveTextContent('KYC Exception');
  });

  it('is shown to both approvers for a scenario B submission', () => {
    submitScenario('B');
    for (const id of ['mahesh', 'sunita'] as const) {
      actAs(id);
      const { unmount } = renderAt('/workflow?tab=all');
      const flagged = rows().filter((r) => within(r).queryByText('KYC Exception'));
      expect(flagged.map((r) => r.textContent)).toEqual(
        expect.arrayContaining([expect.stringContaining('Basavaraj Kadam')]),
      );
      expect(flagged.length).toBeGreaterThanOrEqual(2); // the seeded one and the new one
      unmount();
    }
  });
});

describe('search', () => {
  it('narrows the rows by the applicant, and clears again', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    fireEvent.change(search(), { target: { value: 'savita' } });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Savita Patil');
    fireEvent.change(search(), { target: { value: '' } });
    expect(rows()).toHaveLength(6);
  });

  it('finds a row by its instance ID', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    fireEvent.change(search(), { target: { value: 'wi-23445215' } });
    expect(titles()).toEqual([expect.stringContaining('Manjunath Hiremath')]);
  });

  it('says so when nothing matches, and Clear search brings the rows back', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(list()).not.toBeInTheDocument();
    expect(screen.getByText('No workflows match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search()).toHaveValue('');
    expect(rows()).toHaveLength(6);
  });

  it('does not change the counts of the tabs', () => {
    actAs('admin');
    renderAt('/workflow?tab=all');
    const before = tabNames();
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(tabNames()).toEqual(before);
  });
});

describe('empty states', () => {
  it('says there is nothing waiting for an approver with no task', () => {
    state().resetDemo();
    act(() => {
      useAppStore.setState({ workflowInstances: [] });
    });
    actAs('mahesh');
    renderAt();
    expect(screen.getByText('Nothing is waiting for you')).toBeInTheDocument();
    expect(list()).not.toBeInTheDocument();
    expect(tabNames()).toEqual(['My Actions (00)', 'Completed (00)', 'All Workflows (00)']);
  });

  it('says only approvers have actions, for the loan officer', () => {
    actAs('priya');
    renderAt();
    expect(screen.getByText('No actions for you')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^My Actions/ })).toHaveTextContent('(00)');
  });

  it('has a line for Completed and for All Workflows when they are empty', () => {
    act(() => {
      useAppStore.setState({ workflowInstances: [] });
    });
    actAs('sunita');
    renderAt('/workflow?tab=completed');
    expect(screen.getByText('No completed actions yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^All Workflows/ }));
    expect(screen.getByText('No workflows yet')).toBeInTheDocument();
  });

  it('gives the administrator an empty My Actions and Completed, but a full All Workflows', () => {
    actAs('admin');
    renderAt();
    expect(tabNames()).toEqual(['My Actions (00)', 'Completed (00)', 'All Workflows (06)']);
    expect(screen.getByText('No actions for you')).toBeInTheDocument();
  });
});

describe('after a submission', () => {
  it('shows it to Priya in Completed and in All Workflows, and no action', () => {
    const { id } = submitScenario('A');
    renderAt();
    expect(tabNames()).toEqual(['My Actions (00)', 'Completed (05)', 'All Workflows (05)']);
    fireEvent.click(screen.getByRole('tab', { name: /^All Workflows/ }));
    expect(screen.getByText(id, { exact: false })).toBeInTheDocument();
  });

  it('shows it to Mahesh as an action, first in the list', () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt();
    expect(tabNames()).toEqual(['My Actions (02)', 'Completed (05)', 'All Workflows (07)']);
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent(id);
    expect(rows()[0]).toHaveTextContent('Initiated by Priya Kulkarni');
    expect(within(rows()[0]).getByRole('link')).toHaveTextContent('Review Request');
  });

  it('does not show it to Sunita yet; it reaches her after Level 1', () => {
    const { id } = submitScenario('A');
    actAs('sunita');
    renderAt();
    expect(tabNames()).toEqual(['My Actions (01)', 'Completed (03)', 'All Workflows (07)']);
    expect(screen.queryByText(id, { exact: false })).not.toBeInTheDocument();
    act(() => {
      expect(state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.').ok).toBe(true);
    });
    expect(tabNames()).toEqual(['My Actions (02)', 'Completed (03)', 'All Workflows (07)']);
    expect(rows()[0]).toHaveTextContent(id);
  });

  it('updates the counts while the page is open, as the user acts', () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt();
    expect(tabNames()).toEqual(['My Actions (02)', 'Completed (05)', 'All Workflows (07)']);
    act(() => {
      expect(state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.').ok).toBe(true);
    });
    expect(tabNames()).toEqual(['My Actions (01)', 'Completed (06)', 'All Workflows (07)']);
    expect(screen.queryByText(id, { exact: false })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Completed/ }));
    expect(screen.getByText(id, { exact: false })).toBeInTheDocument();
  });

  it('moves an instance out of My Actions for everybody once it is rejected', () => {
    const { id } = submitScenario('A');
    act(() => {
      state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
      state().reject(id, DEMO_USERS.sunita, 'Income proof is not enough.');
    });
    for (const who of ['mahesh', 'sunita'] as const) {
      actAs(who);
      const { unmount } = renderAt();
      expect(screen.queryByText(id, { exact: false })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('follows a change of user while the page stays open', () => {
    submitScenario('A');
    actAs('mahesh');
    renderAt();
    expect(tabNames()[0]).toBe('My Actions (02)');
    actAs('sunita');
    expect(tabNames()[0]).toBe('My Actions (01)');
    actAs('priya');
    expect(tabNames()[0]).toBe('My Actions (00)');
  });
});
