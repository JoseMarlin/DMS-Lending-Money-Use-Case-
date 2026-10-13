import { act, fireEvent, render, screen } from '@testing-library/react';
import Tooltip from './Tooltip';

function setup(text: string | null = 'You have no action on this request.') {
  render(
    <Tooltip text={text}>
      {(describedBy) => <button aria-describedby={describedBy}>Take Action</button>}
    </Tooltip>,
  );
  const button = screen.getByRole('button', { name: 'Take Action' });
  return { button, wrapper: button.parentElement as HTMLElement };
}

describe('Tooltip', () => {
  it('points the control at the tip, so a screen reader reads it', () => {
    const { button } = setup();
    expect(screen.getByRole('tooltip')).toHaveTextContent('You have no action on this request.');
    expect(button).toHaveAccessibleDescription('You have no action on this request.');
  });

  it('draws nothing, and describes nothing, when there is no text', () => {
    const { button } = setup(null);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('is hidden until the pointer is over the control or the control has the focus', () => {
    const { button, wrapper } = setup();
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveClass('hidden');

    fireEvent.pointerEnter(wrapper);
    expect(tip).toHaveClass('block');
    fireEvent.pointerLeave(wrapper);
    expect(tip).toHaveClass('hidden');

    act(() => button.focus());
    expect(tip).toHaveClass('block');
    act(() => button.blur());
    expect(tip).toHaveClass('hidden');
  });

  it('stays while the pointer is on the tip (it is inside the same wrapper)', () => {
    const { wrapper } = setup();
    const tip = screen.getByRole('tooltip');
    fireEvent.pointerEnter(wrapper);
    // moving from the control onto the tip does not leave the wrapper, so there is no leave event
    fireEvent.pointerOver(tip);
    expect(tip).toHaveClass('block');
  });

  it('is hidden by Escape without the focus or the pointer moving, and comes back next time', () => {
    const { button, wrapper } = setup();
    const tip = screen.getByRole('tooltip');
    act(() => button.focus());
    fireEvent.pointerEnter(wrapper);
    expect(tip).toHaveClass('block');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(tip).toHaveClass('hidden');
    expect(button).toHaveFocus();

    // away from the control and back: it shows again
    fireEvent.pointerLeave(wrapper);
    act(() => button.blur());
    fireEvent.pointerEnter(wrapper);
    expect(tip).toHaveClass('block');
  });

  it('ignores other keys', () => {
    const { wrapper } = setup();
    const tip = screen.getByRole('tooltip');
    fireEvent.pointerEnter(wrapper);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(tip).toHaveClass('block');
  });

  it('gives each tip an id of its own', () => {
    render(
      <>
        <Tooltip text="First">{(d) => <button aria-describedby={d}>A</button>}</Tooltip>
        <Tooltip text="Second">{(d) => <button aria-describedby={d}>B</button>}</Tooltip>
      </>,
    );
    const [first, second] = screen.getAllByRole('tooltip');
    expect(first.id).not.toBe(second.id);
    expect(screen.getByRole('button', { name: 'B' })).toHaveAccessibleDescription('Second');
  });

  it('lines the tip up with the right edge by default and the left edge on request', () => {
    const { unmount } = render(
      <Tooltip text="Tip">{(d) => <button aria-describedby={d}>A</button>}</Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveClass('right-0');
    unmount();
    render(
      <Tooltip text="Tip" align="start">
        {(d) => <button aria-describedby={d}>A</button>}
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveClass('left-0');
  });
});
