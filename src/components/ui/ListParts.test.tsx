import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ListStatus } from '@/data/listStatus';
import Button from './Button';
import EmptyState from './EmptyState';
import FilterChip from './FilterChip';
import StatusChip from './StatusChip';
import Tabs from './Tabs';
import { tabPanelProps } from './tabPanelProps';

describe('StatusChip', () => {
  const ALL: ListStatus[] = ['In-Progress', 'Action Required', 'Approved', 'Rejected', 'Draft'];

  it.each(ALL)('writes the word "%s" in the chip', (status) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('uses a different colour set for each status, so no two chips look alike', () => {
    const classes = ALL.map((status) => {
      const { unmount, container } = render(<StatusChip status={status} />);
      const cls = (container.firstElementChild as HTMLElement).className;
      unmount();
      return cls.match(/bg-status-[a-z]+-bg/)?.[0];
    });
    expect(new Set(classes).size).toBe(5);
  });

  it('is a pill 24px high', () => {
    render(<StatusChip status="Approved" />);
    expect(screen.getByText('Approved')).toHaveClass('h-6', 'rounded-full');
  });
});

describe('FilterChip', () => {
  it('shows the label and the count, and tells whether it is the one in use', () => {
    const { rerender } = render(
      <FilterChip label="Approved" count={3} selected={false} onClick={() => {}} />,
    );
    const chip = screen.getByRole('button', { name: 'Approved 3' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    rerender(<FilterChip label="Approved" count={3} selected onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approved 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('is clicked', () => {
    const onClick = vi.fn();
    render(<FilterChip label="All" count={10} selected={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows a zero', () => {
    render(<FilterChip label="Rejected" count={0} selected={false} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Rejected 0' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('says what is missing, why, and offers what to do', () => {
    render(
      <EmptyState title="No records yet" action={<Button>Clear</Button>}>
        Nothing has been approved.
      </EmptyState>,
    );
    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing has been approved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('can be only a title', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});

describe('Button outline', () => {
  it('is white with a blue outline and blue text', () => {
    render(<Button variant="outline">Import</Button>);
    const button = screen.getByRole('button', { name: 'Import' });
    expect(button).toHaveClass('bg-white', 'text-primary', 'border-primary-border');
  });
});

const TABS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

function TabsHarness({ start = 'one' }: { start?: string }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <Tabs tabs={TABS} value={value} onChange={setValue} label="Views" idPrefix="t" />
      <div {...tabPanelProps('t', value)}>Panel of {value}</div>
    </>
  );
}

describe('Tabs', () => {
  it('is a tab list with one selected tab, and only that one in the tab order', () => {
    render(<TabsHarness start="two" />);
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '-1');
  });

  it('points each tab at its panel, and the panel back at its tab', () => {
    render(<TabsHarness />);
    const panel = screen.getByRole('tabpanel');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAccessibleName('One');
    expect(panel).toHaveTextContent('Panel of one');
  });

  it('changes on a click', () => {
    render(<TabsHarness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Three' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel of three');
  });

  it('moves with the arrow keys, wrapping round, and with Home and End', () => {
    render(<TabsHarness />);
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();
  });

  it('ignores other keys', () => {
    render(<TabsHarness />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'a' });
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
  });

  it('draws the selected tab in dark blue with the bar under it', () => {
    render(<TabsHarness />);
    expect(screen.getByRole('tab', { name: 'One' })).toHaveClass(
      'border-primary',
      'text-tab-active',
    );
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveClass('border-transparent');
  });
});
