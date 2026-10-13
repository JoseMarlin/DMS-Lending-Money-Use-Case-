import { fireEvent, render, screen } from '@testing-library/react';
import Checkbox from './Checkbox';

describe('Checkbox', () => {
  it('is a checkbox named by its text', () => {
    render(
      <Checkbox id="c" label="I authorise the bank" checked={false} onCheckedChange={() => {}} />,
    );
    expect(screen.getByRole('checkbox', { name: 'I authorise the bank' })).not.toBeChecked();
  });

  it('reports the new value when the box or the text is clicked', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        id="c"
        label="I authorise the bank"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText('I authorise the bank'));
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('shows the checked state and reports false when unticked', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox id="c" label="x" checked onCheckedChange={onCheckedChange} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it('tells assistive technology that it is required', () => {
    render(<Checkbox id="c" label="x" required checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-required', 'true');
  });

  it('shows a red asterisk when required', () => {
    render(<Checkbox id="c" label="x" required checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByText('x').textContent).toContain('*');
  });

  it('cannot be changed when disabled and can be marked invalid', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        id="c"
        label="x"
        disabled
        invalid
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeInvalid();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
