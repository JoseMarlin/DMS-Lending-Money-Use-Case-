import { fireEvent, render, screen } from '@testing-library/react';
import Toggle from './Toggle';

describe('Toggle', () => {
  it('is a switch with its label, off by default', () => {
    render(<Toggle id="t" label="Add a co-applicant" checked={false} onCheckedChange={() => {}} />);
    const toggle = screen.getByRole('switch', { name: 'Add a co-applicant' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows the on state', () => {
    render(<Toggle id="t" label="Add a co-applicant" checked onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch').className).toContain('bg-toggle-on');
  });

  it('reports the new value when the switch or its label is clicked', () => {
    const onCheckedChange = vi.fn();
    render(
      <Toggle
        id="t"
        label="Add a co-applicant"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText('Add a co-applicant'));
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('reports false when it is on', () => {
    const onCheckedChange = vi.fn();
    render(<Toggle id="t" label="x" checked onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it('cannot be changed when disabled', () => {
    const onCheckedChange = vi.fn();
    render(<Toggle id="t" label="x" checked disabled onCheckedChange={onCheckedChange} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByText('x'));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
