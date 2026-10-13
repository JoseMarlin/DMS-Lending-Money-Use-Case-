import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/data/store';
import type { AppNotification, DemoUserId } from '@/data/types';
import { submitScenario, user } from '@/test/workflowHelpers';
import NotificationsMenu from './NotificationsMenu';

/** A new Application ID takes its year from the clock. */
const YEAR = new Date().getFullYear();

const state = () => useAppStore.getState();

const bell = () => screen.getByRole('button', { name: /^Notifications/ });
const badge = () => screen.queryByTestId('bell-badge');
const panel = () => screen.getByRole('region', { name: 'Pending approvals' });
const actAs = (id: DemoUserId) => act(() => state().setCurrentUser(id));

function note(n: number, userId: DemoUserId, at = '2026-10-09T10:00:00.000Z'): AppNotification {
  return {
    id: `NT-${String(n).padStart(5, '0')}`,
    userId,
    applicationId: 'HL-2026-0001',
    instanceId: 'WI-23445213',
    message: `Message ${n}`,
    at,
    read: false,
  };
}

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('Bell: for a user with nothing waiting', () => {
  it('draws no red badge, and says so to a screen reader', () => {
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).not.toBeInTheDocument();
    expect(bell()).toHaveAccessibleName('Notifications, none new');
  });

  it('opens a dropdown with an empty state', () => {
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    expect(within(panel()).getByText('No pending approval tasks')).toBeInTheDocument();
    expect(within(panel()).getByText(/will appear here/)).toBeInTheDocument();
    expect(within(panel()).queryByRole('listitem')).not.toBeInTheDocument();
    expect(bell()).toHaveAttribute('aria-expanded', 'true');
  });

  it('puts the cursor in the dropdown when it opens, and Escape gives it back', () => {
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    expect(within(panel()).getByRole('heading', { name: 'Pending approvals' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Pending approvals' })).not.toBeInTheDocument();
    expect(bell()).toHaveFocus();
  });

  it('closes on a click anywhere else', () => {
    render(
      <>
        <button>Elsewhere</button>
        <NotificationsMenu />
      </>,
      { wrapper: MemoryRouter },
    );
    fireEvent.click(bell());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('region', { name: 'Pending approvals' })).not.toBeInTheDocument();
  });
});

describe('Bell: the approval tasks come from the workflow', () => {
  it('shows each approver the one task they start with', () => {
    actAs('mahesh');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).toHaveTextContent('1');
    expect(bell()).toHaveAccessibleName('Notifications, 1 new');
    fireEvent.click(bell());
    const items = within(panel()).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Manjunath Hiremath');
    expect(items[0]).toHaveTextContent('HL-2026-0003');
    expect(items[0]).toHaveTextContent('Level 1 approval');
    expect(items[0]).toHaveTextContent(/received \d{2}\/\d{2}\/\d{4}/);
  });

  it('shows the Credit approver the Level 2 task, and the administrator none', () => {
    actAs('sunita');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    expect(within(panel()).getAllByRole('listitem')[0]).toHaveTextContent('Shobha Gaonkar');
    expect(within(panel()).getAllByRole('listitem')[0]).toHaveTextContent('Level 2 approval');
    actAs('admin');
    expect(badge()).not.toBeInTheDocument();
  });

  it('adds a task for the Branch Manager the moment the loan officer submits', () => {
    actAs('mahesh');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).toHaveTextContent('1');
    act(() => void submitScenario('A'));
    actAs('mahesh');
    expect(badge()).toHaveTextContent('2');
    fireEvent.click(bell());
    const items = within(panel()).getAllByRole('listitem');
    // oldest first: the seed task, then the new one
    expect(items[0]).toHaveTextContent('Manjunath Hiremath');
    expect(items[1]).toHaveTextContent('Ramesh Patil');
    expect(items[1]).toHaveTextContent(`HL-${YEAR}-0008`);
  });

  it('moves the task to the Credit approver when the Branch Manager approves, and updates live', () => {
    let id = '';
    act(() => {
      id = submitScenario('A').id;
    });
    actAs('sunita');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).toHaveTextContent('1');
    act(() => void state().approve(id, user('mahesh'), 'ok'));
    expect(badge()).toHaveTextContent('2');
  });

  it('is not counted twice for the person who submitted: the maker has no tasks', () => {
    act(() => void submitScenario('A'));
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).not.toBeInTheDocument();
  });

  it('puts the oldest task first even when the times are written with different time zones', () => {
    act(() => {
      submitScenario('A');
      useAppStore.setState((s) => ({
        workflowInstances: s.workflowInstances.map((i) => {
          // the seed task for Manjunath: 09:00 UTC. The new one: 10:00 at +05:30, which is 04:30 UTC.
          const when =
            i.applicationId === 'HL-2026-0003'
              ? '2026-08-10T09:00:00Z'
              : i.applicationId === `HL-${YEAR}-0008`
                ? '2026-08-10T10:00:00+05:30'
                : null;
          return when
            ? { ...i, nodes: i.nodes.map((n) => (n.index === 1 ? { ...n, actedAt: when } : n)) }
            : i;
        }),
      }));
    });
    actAs('mahesh');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    const items = within(panel()).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ramesh Patil');
    expect(items[1]).toHaveTextContent('Manjunath Hiremath');
  });
});

describe('Bell: messages for the loan officer', () => {
  function rejectNewApplication() {
    const { id } = submitScenario('A');
    act(() => {
      state().reject(id, user('mahesh'), 'Income proof is missing.');
      state().setCurrentUser('priya');
    });
  }

  it('shows the loan officer a red count when a decision is made', () => {
    rejectNewApplication();
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).toHaveTextContent('1');
    expect(bell()).toHaveAccessibleName('Notifications, 1 new');
  });

  it('lists the message with the reason', () => {
    rejectNewApplication();
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    const messages = within(panel()).getByRole('region', { name: 'Messages' });
    expect(messages).toHaveTextContent(
      `Application HL-${YEAR}-0008 was rejected. Reason: Income proof is missing.`,
    );
    expect(within(panel()).getByText('No pending approval tasks.')).toBeInTheDocument();
  });

  it('counts the messages as read when the bell is opened, so the red count goes', () => {
    rejectNewApplication();
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    expect(badge()).not.toBeInTheDocument();
    expect(state().notifications.every((n) => n.read)).toBe(true);
    // the message is still in the list
    expect(within(panel()).getByRole('region', { name: 'Messages' })).toBeInTheDocument();
  });

  it('does not show a message meant for somebody else', () => {
    rejectNewApplication();
    actAs('sunita');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    expect(within(panel()).queryByRole('region', { name: 'Messages' })).not.toBeInTheDocument();
  });

  it('shows the newest message first', () => {
    act(() => {
      useAppStore.setState({
        notifications: [
          note(1, 'priya', '2026-10-01T10:00:00.000Z'),
          note(2, 'priya', '2026-10-05T10:00:00.000Z'),
        ],
      });
    });
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    const items = within(within(panel()).getByRole('region', { name: 'Messages' })).getAllByRole(
      'listitem',
    );
    expect(items[0]).toHaveTextContent('Message 2');
    expect(items[1]).toHaveTextContent('Message 1');
  });

  it('shows 99+ for a long list', () => {
    act(() => {
      useAppStore.setState({
        notifications: Array.from({ length: 120 }, (_, i) => note(i + 1, 'priya')),
      });
    });
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).toHaveTextContent('99+');
    expect(bell()).toHaveAccessibleName('Notifications, 120 new');
  });

  it('is emptied by Reset demo', () => {
    rejectNewApplication();
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(badge()).toBeInTheDocument();
    act(() => state().resetDemo());
    expect(badge()).not.toBeInTheDocument();
  });
});

describe('Bell: a short or zoomed window, and what the keyboard sees', () => {
  it('limits its height to the window and scrolls inside', () => {
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    expect(panel()).toHaveClass('max-h-[calc(100vh-60px)]', 'overflow-y-auto', 'z-[10000]');
  });

  it('shows where the cursor is when the keyboard opened it (the heading has a focus ring)', () => {
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    const heading = within(panel()).getByRole('heading', { name: 'Pending approvals' });
    expect(heading).toHaveFocus();
    expect(heading.className).toContain('focus-visible:outline-2');
    expect(heading.className).toContain('focus-visible:outline-primary');
    // outline-none would also switch the ring off for the keyboard (it sets the outline style to none)
    expect(heading.className).not.toMatch(/(^| )outline-none/);
  });

  it('shows an open state on the bell', () => {
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    expect(bell()).toHaveClass('aria-expanded:bg-primary-50');
  });
});

describe('Bell: links to the record', () => {
  it('gives each waiting task a link that opens the record sheet of its application', () => {
    actAs('mahesh');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    const link = within(panel()).getByRole('link', {
      name: 'View record of Manjunath Hiremath, HL-2026-0003',
    });
    expect(link).toHaveAttribute('href', '/metadata/master/home-loan?record=HL-2026-0003');
  });

  it('gives each message a link to the record it is about', () => {
    act(() => useAppStore.setState({ notifications: [note(1, 'priya')] }));
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    const link = within(panel()).getByRole('link', { name: 'View record HL-2026-0001' });
    expect(link).toHaveAttribute('href', '/metadata/master/home-loan?record=HL-2026-0001');
  });

  it('closes the dropdown when a link is followed', () => {
    actAs('mahesh');
    render(<NotificationsMenu />, { wrapper: MemoryRouter });
    fireEvent.click(bell());
    fireEvent.click(within(panel()).getByRole('link', { name: /^View record of/ }));
    expect(screen.queryByRole('region', { name: 'Pending approvals' })).not.toBeInTheDocument();
  });
});
