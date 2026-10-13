import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/data/store';
import TopBar from './TopBar';

const state = () => useAppStore.getState();

function renderBar() {
  return render(
    <MemoryRouter>
      <TopBar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('TopBar', () => {
  it('is a 56px white bar with a line under it', () => {
    renderBar();
    const bar = screen.getByRole('banner');
    expect(bar).toHaveClass('h-header', 'bg-white', 'border-b');
  });

  it('has the search box with the placeholder from the design', () => {
    renderBar();
    const search = screen.getByRole('textbox', {
      name: 'Search files, folders, metadata and more',
    });
    expect(search).toHaveAttribute('placeholder', 'Search files, folders, metadata & etc...');
    expect(screen.getByRole('search')).toContainElement(search);
  });

  it('has the QAI button with its sparkle, a help button, the bell and the avatar, in that order', () => {
    renderBar();
    const buttons = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(buttons).toEqual([
      'QAI',
      'Help',
      'Notifications, none new',
      'Account menu for Priya Kulkarni',
    ]);
    expect(screen.getByRole('button', { name: 'QAI' }).querySelector('svg')).not.toBeNull();
  });

  it('draws the avatar with the initials of the user who is acting', () => {
    renderBar();
    expect(screen.getByTestId('avatar')).toHaveTextContent('PK');
  });
});

describe('TopBar: the parts that are only drawn', () => {
  it('typing in the search box and pressing Enter does nothing', () => {
    renderBar();
    const search = screen.getByRole('textbox');
    fireEvent.change(search, { target: { value: 'sale deed' } });
    expect(fireEvent.submit(search.closest('form')!)).toBe(false); // the submit was cancelled
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('QAI and Help open nothing', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'QAI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('QAI and Help are real buttons, so they take the keyboard focus', () => {
    renderBar();
    for (const name of ['QAI', 'Help']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('type', 'button');
      button.focus();
      expect(button).toHaveFocus();
    }
  });
});

describe('TopBar: spacing of the right cluster', () => {
  it('keeps the buttons 8px apart, with 24px icons in 32px buttons, so the icons end up about 16px apart', () => {
    renderBar();
    const cluster = screen.getByRole('button', { name: 'QAI' }).parentElement!;
    expect(cluster).toHaveClass('gap-2');
    const help = screen.getByRole('button', { name: 'Help' });
    expect(help).toHaveClass('h-8', 'w-8');
    expect(help.querySelector('svg')).toHaveAttribute('width', '24');
    expect(
      screen.getByRole('button', { name: /^Notifications/ }).querySelector('svg'),
    ).toHaveAttribute('width', '24');
  });
});
