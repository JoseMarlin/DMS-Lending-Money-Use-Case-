import { fireEvent, render, screen } from '@testing-library/react';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('is named by its label, shows it as the placeholder, and reports what is typed', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} label="Search Record" />);
    const box = screen.getByRole('textbox', { name: 'Search Record' });
    expect(box).toHaveAttribute('placeholder', 'Search Record');
    fireEvent.change(box, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('is 32px high by default and 38px in the size md of Files & Folders', () => {
    const { rerender } = render(<SearchInput value="" onChange={() => {}} label="Search" />);
    expect(screen.getByRole('textbox')).toHaveClass('h-8');
    rerender(<SearchInput value="" onChange={() => {}} label="Search" size="md" />);
    expect(screen.getByRole('textbox')).toHaveClass('h-[38px]');
    expect(screen.getByRole('textbox')).not.toHaveClass('h-8');
  });
});
