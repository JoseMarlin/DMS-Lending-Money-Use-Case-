import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/data/store';
import DemoPanel from './DemoPanel';

const state = () => useAppStore.getState();

function renderPanel(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DemoPanel />
    </MemoryRouter>,
  );
}

function openPanel() {
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'Demo controls' }));
}

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('DemoPanel', () => {
  it('starts collapsed and opens and closes', () => {
    renderPanel();
    expect(screen.queryByText('Fill with scenario')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Demo controls' }));
    expect(screen.getByText('Fill with scenario')).toBeInTheDocument();
    expect(screen.getByText('Not part of the product UI')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse demo controls' }));
    expect(screen.queryByText('Fill with scenario')).not.toBeInTheDocument();
  });

  it.each([
    ['A', 'Ramesh Patil'],
    ['B', 'Anita Desai'],
    ['C', 'Kiran Naik'],
  ])('fills the draft with scenario %s', (key, name) => {
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Scenario ${key}`) }));
    expect(state().draft.fullNameAsPerPan).toBe(name);
    expect(state().activeScenario).toBe(key);
    expect(screen.getByRole('button', { name: new RegExp(`Scenario ${key}`) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('no longer has an Act as control: the user is switched from the avatar menu of the shell', () => {
    openPanel();
    expect(screen.queryByLabelText('Act as')).not.toBeInTheDocument();
    expect(screen.queryByText('Act as')).not.toBeInTheDocument();
  });

  it('keeps the scenario buttons, the KYC outage setting and Reset demo', () => {
    openPanel();
    expect(screen.getAllByRole('button', { name: /^Scenario [ABC]/ })).toHaveLength(3);
    expect(screen.getByLabelText('KYC source outage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset demo' })).toBeInTheDocument();
  });

  it('sits at the bottom right inside the shell, clear of the sidebar', () => {
    renderPanel('/dashboard');
    const panel = screen.getByRole('complementary', { name: 'Demo controls' });
    expect(panel).toHaveClass('right-3', 'bottom-3');
    expect(panel).not.toHaveClass('left-3');
  });

  it('sits at the bottom left on the standalone form, clear of its step buttons', () => {
    renderPanel('/apply');
    const panel = screen.getByRole('complementary', { name: 'Demo controls' });
    expect(panel).toHaveClass('left-3', 'bottom-3');
    expect(panel).not.toHaveClass('right-3');
  });

  it('knows the form address in any letter case', () => {
    renderPanel('/Apply');
    expect(screen.getByRole('complementary', { name: 'Demo controls' })).toHaveClass('left-3');
  });

  it('Reset demo clears the draft, the user and the scenario', () => {
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: /Scenario A/ }));
    act(() => state().setCurrentUser('mahesh'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(state().draft.fullNameAsPerPan).toBe('');
    expect(state().currentUserId).toBe('priya');
    expect(state().activeScenario).toBeNull();
  });

  it('sets a KYC source outage and Reset demo clears it', () => {
    openPanel();
    const select = screen.getByLabelText('KYC source outage');
    expect(select).toHaveValue('none');
    fireEvent.change(select, { target: { value: 'pan-down' } });
    expect(state().kycOutage).toBe('pan-down');
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(state().kycOutage).toBe('none');
    expect(screen.getByLabelText('KYC source outage')).toHaveValue('none');
  });
});
