import { render, screen } from '@testing-library/react';
import FormCard from './FormCard';

describe('FormCard', () => {
  it('shows the title, the sub header, the body and the footer', () => {
    render(
      <FormCard
        title="Home Loan Application"
        subHeader={<p>Steps</p>}
        footer={<button>Next</button>}
      >
        <p>Body</p>
      </FormCard>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Home Loan Application' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('keeps the sub header and the footer outside the scrolling body', () => {
    render(
      <FormCard title="T" subHeader={<p>Steps</p>} footer={<button>Next</button>}>
        <p>Body</p>
      </FormCard>,
    );
    const body = screen.getByText('Body').parentElement!;
    expect(body).toHaveClass('overflow-y-auto');
    expect(body).toContainElement(screen.getByText('Body'));
    expect(body).not.toContainElement(screen.getByText('Steps'));
    expect(body).not.toContainElement(screen.getByRole('button', { name: 'Next' }));
  });

  it('makes the body the containing block, so hidden file inputs cannot stretch the page', () => {
    render(
      <FormCard title="T">
        <p>Body</p>
      </FormCard>,
    );
    expect(screen.getByText('Body').parentElement).toHaveClass('relative');
  });

  it('leaves out the footer and the sub header when there are none', () => {
    render(
      <FormCard title="T">
        <p>Body</p>
      </FormCard>,
    );
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('scrolls the body back to the top when the scroll reset key changes, and only then', () => {
    const card = (key: number) => (
      <FormCard title="T" scrollResetKey={key}>
        <p>Body</p>
      </FormCard>
    );
    const { rerender } = render(card(1));
    const body = screen.getByText('Body').parentElement!;
    body.scrollTop = 120;
    rerender(card(1));
    expect(body.scrollTop).toBe(120);
    rerender(card(2));
    expect(body.scrollTop).toBe(0);
  });
});
