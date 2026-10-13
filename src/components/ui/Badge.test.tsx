import { render, screen } from '@testing-library/react';
import Badge from './Badge';
import ProgressBar from './ProgressBar';

describe('Badge', () => {
  it('shows its text, so the status is never only a colour', () => {
    render(<Badge tone="success">Verified</Badge>);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('has a different look for each tone', () => {
    const classes = (['neutral', 'info', 'success', 'warning', 'error'] as const).map((tone) => {
      const { unmount } = render(<Badge tone={tone}>x</Badge>);
      const cls = screen.getByText('x').className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(5);
  });

  it('shows a spinner only while busy', () => {
    const { container, rerender } = render(<Badge>Checking</Badge>);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    rerender(<Badge busy>Checking</Badge>);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('is a progress bar with a name and its value', () => {
    render(<ProgressBar label="PAN check" value={100} />);
    const bar = screen.getByRole('progressbar', { name: 'PAN check' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('keeps the value between 0 and 100', () => {
    const { rerender } = render(<ProgressBar label="x" value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar label="x" value={-20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('fills the bar to the value', () => {
    render(<ProgressBar label="x" value={40} />);
    const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('40%');
  });

  it('starts empty and fills over the given time when animated', async () => {
    render(<ProgressBar label="x" value={100} animateMs={1500} />);
    const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('0%');
    expect(fill.style.transitionDuration).toBe('1500ms');
    await vi.waitFor(() => expect(fill.style.width).toBe('100%'));
  });

  it('has no value while it fills, and the value once it is full', async () => {
    render(<ProgressBar label="x" value={100} animateMs={30} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    await vi.waitFor(() => expect(bar).toHaveAttribute('aria-valuenow', '100'));
  });

  it('uses a colour for each tone', () => {
    const classes = (['neutral', 'info', 'success', 'warning', 'error'] as const).map((tone) => {
      const { unmount } = render(<ProgressBar label="x" value={50} tone={tone} />);
      const cls = (screen.getByRole('progressbar').firstElementChild as HTMLElement).className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(5);
  });
});
