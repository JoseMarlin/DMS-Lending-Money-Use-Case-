import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DEMO_USERS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import UserMenu from './UserMenu';

const state = () => useAppStore.getState();

const trigger = () => screen.getByRole('button', { name: /^Account menu for / });
const panel = () => screen.getByRole('region', { name: 'Account' });
const openMenu = () => fireEvent.click(trigger());
const person = (name: RegExp) => within(panel()).getByRole('button', { name });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('UserMenu: the avatar', () => {
  it.each([
    ['priya', 'PK'],
    ['mahesh', 'MJ'],
    ['sunita', 'SH'],
    ['admin', 'AD'],
  ] as [DemoUserId, string][])('shows %s as %s', (id, initials) => {
    state().setCurrentUser(id);
    render(<UserMenu />);
    expect(screen.getByTestId('avatar')).toHaveTextContent(initials);
    expect(trigger()).toHaveAccessibleName(`Account menu for ${DEMO_USERS[id].name}`);
  });

  it('is closed at first', () => {
    render(<UserMenu />);
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('UserMenu: what it shows', () => {
  it.each([
    ['priya', 'Priya Kulkarni', 'Loan officer (maker)', 'Belagavi Main Branch (demo)'],
    ['mahesh', 'Mahesh Joshi', 'Level 1 approver, Branch Manager', 'Belagavi Main Branch (demo)'],
    ['sunita', 'Sunita Hegde', 'Level 2 approver, Credit approver', 'Head Office, Credit (demo)'],
    ['admin', 'Admin', 'Administrator', 'Head Office'],
  ] as [DemoUserId, string, string, string][])(
    'says who %s is: name, role and branch',
    (id, name, role, branch) => {
      state().setCurrentUser(id);
      render(<UserMenu />);
      openMenu();
      const top = panel().firstElementChild as HTMLElement;
      expect(within(top).getByText(name)).toBeInTheDocument();
      expect(within(top).getByText(role)).toBeInTheDocument();
      expect(within(top).getByText(branch)).toBeInTheDocument();
    },
  );

  it('lists the four demo users under "Act as", with the current one ticked', () => {
    render(<UserMenu />);
    openMenu();
    const group = within(panel()).getByRole('group', { name: 'Act as' });
    const rows = within(group).getAllByRole('button');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveAccessibleName('Priya Kulkarni Loan officer (maker) (current)');
    expect(rows[1]).toHaveAccessibleName('Mahesh Joshi Level 1 approver, Branch Manager');
    expect(rows[2]).toHaveAccessibleName('Sunita Hegde Level 2 approver, Credit approver');
    expect(rows[3]).toHaveAccessibleName('Admin Administrator');
    expect(rows.filter((row) => row.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
  });

  it('has Reset demo after the list', () => {
    render(<UserMenu />);
    openMenu();
    const reset = within(panel()).getByRole('button', { name: 'Reset demo' });
    const lastUser = person(/^Admin/);
    expect(lastUser.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the cursor on the current user when it opens', () => {
    state().setCurrentUser('sunita');
    render(<UserMenu />);
    openMenu();
    expect(person(/^Sunita Hegde/)).toHaveFocus();
  });
});

describe('UserMenu: switching the user', () => {
  it('changes the user, the avatar and the menu at once, with no reload', () => {
    render(<UserMenu />);
    openMenu();
    fireEvent.click(person(/^Mahesh Joshi/));
    expect(state().currentUserId).toBe('mahesh');
    expect(screen.getByTestId('avatar')).toHaveTextContent('MJ');
    expect(trigger()).toHaveAccessibleName('Account menu for Mahesh Joshi');
    // the menu is shut, and the cursor is back on the avatar
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    // opening it again shows the new user as current
    openMenu();
    expect(person(/^Mahesh Joshi/)).toHaveAttribute('aria-current', 'true');
    expect(person(/^Priya Kulkarni/)).not.toHaveAttribute('aria-current');
  });

  it('can move through all four users one after the other', () => {
    render(<UserMenu />);
    for (const [id, initials, name] of [
      ['mahesh', 'MJ', /^Mahesh/],
      ['sunita', 'SH', /^Sunita/],
      ['admin', 'AD', /^Admin/],
      ['priya', 'PK', /^Priya/],
    ] as [DemoUserId, string, RegExp][]) {
      openMenu();
      fireEvent.click(person(name));
      expect(state().currentUserId).toBe(id);
      expect(screen.getByTestId('avatar')).toHaveTextContent(initials);
    }
  });

  it('picking the user who is already current just closes the menu', () => {
    render(<UserMenu />);
    openMenu();
    fireEvent.click(person(/^Priya Kulkarni/));
    expect(state().currentUserId).toBe('priya');
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });
});

describe('UserMenu: Reset demo', () => {
  it('puts the demo back to the start, as Priya, and closes the menu', () => {
    state().fillScenario('A');
    state().setCurrentUser('sunita');
    render(<UserMenu />);
    openMenu();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Reset demo' }));
    expect(state().currentUserId).toBe('priya');
    expect(state().activeScenario).toBeNull();
    expect(state().draft.fullNameAsPerPan).toBe('');
    expect(screen.getByTestId('avatar')).toHaveTextContent('PK');
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });
});

describe('UserMenu: closing', () => {
  it('Escape closes it and returns the cursor to the avatar', () => {
    render(<UserMenu />);
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('pressing the avatar again closes it', () => {
    render(<UserMenu />);
    openMenu();
    fireEvent.click(trigger());
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('a click anywhere else closes it', () => {
    render(
      <>
        <button>Elsewhere</button>
        <UserMenu />
      </>,
    );
    openMenu();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('a click inside it does not close it', () => {
    render(<UserMenu />);
    openMenu();
    fireEvent.pointerDown(within(panel()).getByText('Act as'));
    expect(panel()).toBeInTheDocument();
  });

  it('tabbing out of it closes it', () => {
    render(
      <>
        <UserMenu />
        <button>After</button>
      </>,
    );
    openMenu();
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('tells screen readers it is open while it is', () => {
    render(<UserMenu />);
    openMenu();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', panel().id);
  });
});

describe('UserMenu: for a short or zoomed window', () => {
  it('limits its height to the window and scrolls inside, so the last row can always be reached', () => {
    render(<UserMenu />);
    openMenu();
    expect(panel()).toHaveClass('max-h-[calc(100vh-60px)]', 'overflow-y-auto');
  });

  it('is above the Demo controls panel, which would otherwise cover its last rows', () => {
    render(<UserMenu />);
    openMenu();
    expect(panel()).toHaveClass('z-[10000]');
  });
});

describe('UserMenu: telling the change', () => {
  it('says who the user is now, in a message a screen reader hears', () => {
    render(<UserMenu />);
    openMenu();
    fireEvent.click(person(/^Mahesh Joshi/));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Now acting as Mahesh Joshi, Level 1 approver, Branch Manager',
    );
  });

  it('says nothing before the user is changed', () => {
    render(<UserMenu />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('closes the menu first, so a failing save cannot leave it open', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is full');
    });
    render(<UserMenu />);
    openMenu();
    expect(() => fireEvent.click(person(/^Sunita Hegde/))).not.toThrow();
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(state().currentUserId).toBe('sunita');
    setItem.mockRestore();
  });

  it('shows a hover ring and an open ring on the avatar, as the other buttons show theirs', () => {
    render(<UserMenu />);
    expect(trigger()).toHaveClass('hover:ring-2', 'aria-expanded:ring-2');
  });
});
