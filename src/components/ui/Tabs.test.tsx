import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { tabPanelProps } from './tabPanelProps';
import Tabs from './Tabs';

const TABS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

function Harness({ size, flush }: { size?: 'md' | 'sm'; flush?: boolean }) {
  const [value, setValue] = useState('one');
  return (
    <>
      <Tabs
        tabs={TABS}
        value={value}
        onChange={setValue}
        label="Views"
        idPrefix="t"
        size={size}
        flush={flush}
      />
      <div {...tabPanelProps('t', value)}>panel {value}</div>
    </>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('Tabs', () => {
  it('marks the selected tab and points each tab at its panel', () => {
    render(<Harness />);
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Two')).toHaveAttribute('aria-selected', 'false');
    expect(tab('One')).toHaveAttribute('aria-controls', 't-panel-one');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 't-tab-one');
    expect(tab('One')).toHaveAttribute('tabindex', '0');
    expect(tab('Two')).toHaveAttribute('tabindex', '-1');
  });

  it('moves with the arrow keys, round the ends, and with Home and End', () => {
    render(<Harness />);
    tab('One').focus();
    fireEvent.keyDown(tab('One'), { key: 'ArrowLeft' });
    expect(tab('Three')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Three')).toHaveFocus();
    fireEvent.keyDown(tab('Three'), { key: 'ArrowRight' });
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab('One'), { key: 'End' });
    expect(tab('Three')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab('Three'), { key: 'Home' });
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves the browser its own shortcuts: Alt+Left (Back) and Ctrl or Cmd with an arrow', () => {
    render(<Harness />);
    tab('One').focus();
    for (const modifier of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      const notCancelled = fireEvent.keyDown(tab('One'), { key: 'ArrowRight', ...modifier });
      expect(notCancelled).toBe(true); // nobody called preventDefault
      expect(tab('One')).toHaveAttribute('aria-selected', 'true');
    }
    expect(fireEvent.keyDown(tab('One'), { key: 'ArrowRight' })).toBe(false);
    expect(tab('Two')).toHaveAttribute('aria-selected', 'true');
  });

  it('ignores keys it does not use', () => {
    render(<Harness />);
    expect(fireEvent.keyDown(tab('One'), { key: 'a' })).toBe(true);
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');
  });

  it('is 40px high with the hairline of its own by default', () => {
    render(<Harness />);
    expect(tab('One')).toHaveClass('h-10');
    expect(screen.getByRole('tablist')).toHaveClass('border-b');
  });

  it('can be small (36px, 13px text) and flush (the screen draws the hairline)', () => {
    render(<Harness size="sm" flush />);
    expect(tab('One')).toHaveClass('h-9');
    expect(tab('One').className).toContain('text-[13px]');
    expect(screen.getByRole('tablist')).not.toHaveClass('border-b');
  });
});

describe('Tabs in forced-colours mode (Windows High Contrast), where colours are dropped', () => {
  it('marks the selected tab with system colours, and clears the bar of the others', () => {
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
        value="a"
        onChange={() => {}}
        label="x"
        idPrefix="x"
      />,
    );
    expect(screen.getByRole('tab', { name: 'A' }).className).toContain(
      'forced-colors:border-[Highlight]',
    );
    expect(screen.getByRole('tab', { name: 'B' }).className).toContain(
      'forced-colors:border-[Canvas]',
    );
    expect(screen.getByRole('tab', { name: 'B' }).className).not.toContain(
      'forced-colors:border-[Highlight]',
    );
  });
});

describe('Tabs with an alert', () => {
  const tabs = [
    { id: 'a', label: 'A', alert: true },
    { id: 'b', label: 'B' },
  ];

  it('draws a small red dot after the label of a tab that needs attention, and says so to a screen reader', () => {
    render(<Tabs tabs={tabs} value="b" onChange={() => {}} label="x" idPrefix="x" />);
    expect(screen.getByTestId('tab-alert-a')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('tab-alert-a')).toHaveClass('bg-error', 'rounded-full');
    expect(screen.getByRole('tab', { name: 'A, has errors' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'B' })).toBeInTheDocument();
    expect(screen.queryByTestId('tab-alert-b')).toBeNull();
  });

  it('keeps the tab selectable by its label', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="b" onChange={onChange} label="x" idPrefix="x" />);
    fireEvent.click(screen.getByRole('tab', { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});
