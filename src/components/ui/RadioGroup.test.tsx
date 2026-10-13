import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import RadioGroup from './RadioGroup';

const OPTIONS = [
  { value: 'a', label: 'Approve' },
  { value: 'r', label: 'Reject' },
  { value: 'x', label: 'Return for correction' },
] as const;

function Harness({ initial = '' as '' | 'a' | 'r' | 'x', onChange = () => {} }) {
  const [value, setValue] = useState<'' | 'a' | 'r' | 'x'>(initial);
  return (
    <RadioGroup
      legend="Select Action"
      name="act"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange();
      }}
      options={[...OPTIONS]}
    />
  );
}

describe('RadioGroup', () => {
  it('is a group named by its legend, with a native radio for each option', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Select Action' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual([
      'a',
      'r',
      'x',
    ]);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('type', 'radio');
      expect(radio).toHaveAttribute('name', 'act');
    }
  });

  it('names each radio by its label, and the label is clickable', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Return for correction' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reject'));
    expect(screen.getByRole('radio', { name: 'Reject' })).toBeChecked();
  });

  it('shows nothing chosen when the value is empty, and the chosen one otherwise', () => {
    const { unmount } = render(<Harness />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    unmount();
    render(<Harness initial="x" />);
    expect(screen.getByRole('radio', { name: 'Return for correction' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Approve' })).not.toBeChecked();
  });

  it('chooses one at a time', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Reject' }));
    expect(screen.getByRole('radio', { name: 'Approve' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Reject' })).toBeChecked();
  });

  it('tells the owner what was chosen', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Approve' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('still shows which one is chosen in forced-colours mode (a thick ring)', () => {
    render(<Harness initial="a" />);
    expect(screen.getByRole('radio', { name: 'Approve' }).className).toContain(
      'forced-colors:checked:border-[5px]',
    );
  });

  it('draws the ring grey and the chosen one blue with a dot', () => {
    render(<Harness initial="a" />);
    expect(screen.getByRole('radio', { name: 'Reject' }).className).toContain('border-muted');
    expect(screen.getByRole('radio', { name: 'Approve' }).className).toContain(
      'checked:border-primary',
    );
  });
});
