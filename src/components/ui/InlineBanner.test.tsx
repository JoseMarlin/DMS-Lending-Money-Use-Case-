import { render, screen } from '@testing-library/react';
import InlineBanner from './InlineBanner';

describe('InlineBanner', () => {
  it('shows a title and its content', () => {
    render(
      <InlineBanner variant="error" title="Fix 2 errors">
        <p>Details here</p>
      </InlineBanner>,
    );
    expect(screen.getByText('Fix 2 errors')).toBeInTheDocument();
    expect(screen.getByText('Details here')).toBeInTheDocument();
  });

  it('announces an error at once (role alert)', () => {
    render(<InlineBanner variant="error" title="Oops" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Oops');
  });

  it.each(['info', 'warning', 'success'] as const)('%s is a polite status message', (variant) => {
    render(<InlineBanner variant={variant} title="Note" />);
    expect(screen.getByRole('status')).toHaveTextContent('Note');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is info by default and has an icon', () => {
    const { container } = render(<InlineBanner title="Hello" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('uses a different colour for each variant', () => {
    const classes = (['info', 'warning', 'error', 'success'] as const).map((variant) => {
      const { unmount } = render(<InlineBanner variant={variant} title="x" />);
      const cls = screen.getByText('x').closest('div[role]')!.className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(4);
  });
});
