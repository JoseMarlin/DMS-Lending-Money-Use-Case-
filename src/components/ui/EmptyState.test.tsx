import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('says what happened, with a line of help and an action', () => {
    render(
      <EmptyState title="No results" action={<button type="button">Clear</button>}>
        Try something else.
      </EmptyState>,
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try something else.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('has the hairline of a list under it by default', () => {
    render(<EmptyState title="Nothing" />);
    expect(screen.getByText('Nothing').parentElement).toHaveClass('border-b', 'border-line');
  });

  it('can be drawn without it, when no table sits above it', () => {
    render(<EmptyState title="Nothing" bordered={false} />);
    expect(screen.getByText('Nothing').parentElement).not.toHaveClass('border-b');
  });
});
