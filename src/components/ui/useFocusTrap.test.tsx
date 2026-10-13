import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from './useFocusTrap';

function Dialog({
  name,
  onClose,
  initialFocus,
}: {
  name: string;
  onClose: () => void;
  initialFocus?: 'firstField' | 'panel';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(true, ref, onClose, initialFocus);
  return (
    <div ref={ref} role="dialog" aria-label={name} tabIndex={-1}>
      <input aria-label={`${name} box`} />
      <button type="button">{name} first</button>
      <button type="button">{name} last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('puts the cursor on the first text box, or on the panel when asked', () => {
    const { unmount } = render(<Dialog name="A" onClose={() => {}} />);
    expect(screen.getByLabelText('A box')).toHaveFocus();
    unmount();
    render(<Dialog name="B" onClose={() => {}} initialFocus="panel" />);
    expect(screen.getByRole('dialog', { name: 'B' })).toHaveFocus();
  });

  it('keeps Tab inside, in both directions', () => {
    render(<Dialog name="A" onClose={() => {}} />);
    const input = screen.getByLabelText('A box');
    const last = screen.getByRole('button', { name: 'A last' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(input).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('brings the cursor back from outside, for Tab and for Shift+Tab', () => {
    render(
      <>
        <button type="button">Outside</button>
        <Dialog name="A" onClose={() => {}} />
      </>,
    );
    const outside = screen.getByRole('button', { name: 'Outside' });
    outside.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('A box')).toHaveFocus();
    outside.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'A last' })).toHaveFocus();
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<Dialog name="A" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives the cursor back to where it was when the dialog goes', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(<Dialog name="A" onClose={() => {}} />);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  describe('a dialog over a dialog', () => {
    it('lets only the one on top answer Escape and Tab', () => {
      const under = vi.fn();
      const over = vi.fn();
      const { rerender } = render(<Dialog name="Under" onClose={under} />);
      rerender(
        <>
          <Dialog name="Under" onClose={under} />
          <Dialog name="Over" onClose={over} />
        </>,
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(over).toHaveBeenCalledTimes(1);
      expect(under).not.toHaveBeenCalled();
      // Tab goes round in the top one, and does not pull the cursor down into the other
      const overLast = screen.getByRole('button', { name: 'Over last' });
      overLast.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(screen.getByLabelText('Over box')).toHaveFocus();
    });

    it('gives the keys back to the dialog under when the top one goes', () => {
      const under = vi.fn();
      const { rerender } = render(
        <>
          <Dialog name="Under" onClose={under} />
          <Dialog name="Over" onClose={() => {}} />
        </>,
      );
      rerender(<Dialog name="Under" onClose={under} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(under).toHaveBeenCalledTimes(1);
    });
  });

  describe('a dropdown of the top bar over the dialog', () => {
    it('lets Tab move on its own while the cursor is in a popover panel', () => {
      render(
        <>
          <Dialog name="A" onClose={() => {}} />
          <div data-popover-panel>
            <button type="button">In the dropdown</button>
          </div>
        </>,
      );
      const inside = screen.getByRole('button', { name: 'In the dropdown' });
      inside.focus();
      // true: nothing called preventDefault
      expect(fireEvent.keyDown(inside, { key: 'Tab' })).toBe(true);
      expect(inside).toHaveFocus();
    });
  });
});
