import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import Accordion from './Accordion';

function Harness({ initiallyOpen = false, level }: { initiallyOpen?: boolean; level?: 2 | 3 }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Accordion
      title="Applicant"
      summary="3 of 5 required"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      headingLevel={level}
    >
      <input aria-label="Full Name" />
    </Accordion>
  );
}

describe('Accordion', () => {
  it('has a heading that holds a button with the title and the summary', () => {
    render(<Harness level={2} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Applicant');
    expect(heading).toHaveTextContent('3 of 5 required');
    expect(screen.getByRole('button', { name: /Applicant/ })).toBeInTheDocument();
  });

  it('is a level 3 heading by default', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('says whether it is open (aria-expanded) and controls its panel', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: /Applicant/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(panel).toHaveAttribute('hidden');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('hides what is inside while closed, but keeps it in the page', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Full Name', { selector: 'input' })).not.toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Full Name' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Applicant/ }));
    expect(screen.getByRole('textbox', { name: 'Full Name' })).toBeVisible();
  });

  it('keeps what was typed in a field while it is closed and opened again', () => {
    render(<Harness initiallyOpen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Full Name' }), {
      target: { value: 'Ramesh' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Applicant/ }));
    fireEvent.click(screen.getByRole('button', { name: /Applicant/ }));
    expect(screen.getByRole('textbox', { name: 'Full Name' })).toHaveValue('Ramesh');
  });

  it('is labelled by its heading', () => {
    render(<Harness initiallyOpen />);
    expect(screen.getByRole('region', { name: /Applicant/ })).toBeInTheDocument();
  });
});
