import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from './Toast';
import { useToast, type ToastOptions } from './useToast';

function Trigger({ options }: { options: ToastOptions | string }) {
  const toast = useToast();
  return <button onClick={() => toast.show(options)}>Show</button>;
}

const show = () => fireEvent.click(screen.getByRole('button', { name: 'Show' }));

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('has its message area in the page from the start, so a screen reader hears each new message', () => {
    render(
      <ToastProvider>
        <p>Page</p>
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows a message that is given as plain text', () => {
    render(
      <ToastProvider>
        <Trigger options="Saved" />
      </ToastProvider>,
    );
    show();
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('shows the message and an action, and the action does its work and closes the message', () => {
    const open = vi.fn();
    render(
      <ToastProvider>
        <Trigger
          options={{ message: 'Files stored.', action: { label: 'Open folder', onClick: open } }}
        />
      </ToastProvider>,
    );
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Files stored/)).not.toBeInTheDocument();
  });

  it('closes with its close button', () => {
    render(
      <ToastProvider>
        <Trigger options="Saved" />
      </ToastProvider>,
    );
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Close notification' }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('goes away by itself after six seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options="Saved" />
      </ToastProvider>,
    );
    show();
    act(() => void vi.advanceTimersByTime(5900));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('stays 20 seconds when it has an action: the keyboard needs time to reach it', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger
          options={{
            message: 'Files stored.',
            action: { label: 'Open folder', onClick: () => {} },
          }}
        />
      </ToastProvider>,
    );
    show();
    act(() => void vi.advanceTimersByTime(19_900));
    expect(screen.getByRole('button', { name: 'Open folder' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole('button', { name: 'Open folder' })).not.toBeInTheDocument();
  });

  it('keeps an Application ID on one line, and the rest of the message as it is', () => {
    render(
      <ToastProvider>
        <Trigger options="Files stored in Loans / Home Loan / Branch / HL-2026-0006 for you" />
      </ToastProvider>,
    );
    show();
    const id = screen.getByText('HL-2026-0006');
    expect(id).toHaveClass('whitespace-nowrap');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Files stored in Loans / Home Loan / Branch / HL-2026-0006 for you',
    );
  });

  it('can be asked to stay shorter or longer', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ message: 'Quick', durationMs: 1000 }} />
      </ToastProvider>,
    );
    show();
    act(() => void vi.advanceTimersByTime(1100));
    expect(screen.queryByText('Quick')).not.toBeInTheDocument();
  });

  it('stays while the pointer is on it, and starts counting again when it leaves', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options="Saved" />
      </ToastProvider>,
    );
    show();
    const toast = screen.getByText('Saved').closest('div')!;
    fireEvent.mouseEnter(toast);
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => void vi.advanceTimersByTime(6100));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('keeps the three newest when more come', () => {
    render(
      <ToastProvider>
        <Trigger options="one" />
      </ToastProvider>,
    );
    for (let i = 0; i < 4; i++) show();
    expect(screen.getAllByText('one')).toHaveLength(3);
  });

  it('does nothing, and does not fail, when there is no provider', () => {
    render(<Trigger options="Saved" />);
    expect(() => show()).not.toThrow();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('is above the dimmed page of a dialog', () => {
    render(<ToastProvider>x</ToastProvider>);
    expect(screen.getByRole('status')).toHaveClass('z-[10001]');
  });
});
