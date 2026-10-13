import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/data/store';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();

function renderPage() {
  return render(
    <MemoryRouter>
      <ApplyPage />
    </MemoryRouter>,
  );
}

const SECTION_TITLES = [
  'Application',
  'Applicant',
  'Identity',
  'Property and security',
  'Co-applicant',
  'Sureties',
  'Documents',
  'Consent',
];

/** The header button of a section (its name starts with the title) */
const header = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });
const isOpen = (title: string) => header(title).getAttribute('aria-expanded') === 'true';

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  state().resetDemo();
});

describe('Step 1 sections are accordions', () => {
  it('opens the first section and leaves the rest closed', () => {
    renderPage();
    expect(SECTION_TITLES.map(isOpen)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(screen.getByRole('textbox', { name: /^Loan Amount Requested/ })).toBeVisible();
    expect(screen.queryByRole('textbox', { name: /^Full Name/ })).not.toBeInTheDocument();
  });

  it('opens and closes a section from its header', () => {
    renderPage();
    fireEvent.click(header('Applicant'));
    expect(isOpen('Applicant')).toBe(true);
    expect(screen.getByRole('textbox', { name: /^Full Name/ })).toBeVisible();
    fireEvent.click(header('Applicant'));
    expect(isOpen('Applicant')).toBe(false);
    fireEvent.click(header('Application'));
    expect(isOpen('Application')).toBe(false);
  });

  it('each header is a heading with a real button in it', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(8);
    headings.forEach((h) => expect(within(h).getByRole('button')).toBeInTheDocument());
  });

  it('Expand all sections opens every section, and then offers Collapse all', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
    expect(SECTION_TITLES.every(isOpen)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all sections' }));
    expect(SECTION_TITLES.some(isOpen)).toBe(false);
    expect(screen.getByRole('button', { name: 'Expand all sections' })).toBeInTheDocument();
  });

  it('the label follows a section opened by hand', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
    fireEvent.click(header('Sureties'));
    expect(screen.getByRole('button', { name: 'Expand all sections' })).toBeInTheDocument();
  });

  it('the fields stay in the page while closed: what was typed is still there on opening', () => {
    renderPage();
    fireEvent.click(header('Applicant'));
    fireEvent.change(screen.getByRole('textbox', { name: /^Full Name/ }), {
      target: { value: 'Anita Desai' },
    });
    fireEvent.click(header('Applicant'));
    expect(state().draft.fullNameAsPerPan).toBe('Anita Desai');
    fireEvent.click(header('Applicant'));
    expect(screen.getByRole('textbox', { name: /^Full Name/ })).toHaveValue('Anita Desai');
  });

  it('the Aadhaar number typed in a section is still in memory after the section is closed', () => {
    renderPage();
    fireEvent.click(header('Identity'));
    const aadhaar = screen.getByLabelText('Aadhaar*');
    fireEvent.focus(aadhaar);
    fireEvent.change(aadhaar, { target: { value: '234500074821' } });
    fireEvent.blur(aadhaar);
    fireEvent.click(header('Identity'));
    fireEvent.click(header('Identity'));
    fireEvent.focus(screen.getByLabelText('Aadhaar*'));
    expect(screen.getByLabelText('Aadhaar*')).toHaveValue('2345 0007 4821');
  });
});

describe('what a section header says', () => {
  const summaryOf = (title: string) => header(title).textContent;

  it('how many required fields are filled', () => {
    renderPage();
    expect(summaryOf('Application')).toContain('0 of 3 required');
    expect(summaryOf('Applicant')).toContain('0 of 5 required');
    expect(summaryOf('Identity')).toContain('0 of 2 required'); // GSTIN is not showing yet
    expect(summaryOf('Sureties')).toContain('0 of 6 required');
    expect(summaryOf('Documents')).toContain('0 of 12 required');
    expect(summaryOf('Consent')).toContain('0 of 1 required');
    expect(summaryOf('Co-applicant')).toBe('Co-applicant'); // nothing is required there
  });

  it('follows what is typed', () => {
    renderPage();
    fireEvent.click(header('Application'));
    fireEvent.change(screen.getByLabelText(/^Tenure/), { target: { value: '180' } });
    expect(summaryOf('Application')).toContain('1 of 3 required');
    fireEvent.change(screen.getByLabelText(/^Loan Amount Requested/), {
      target: { value: '1800000' },
    });
    expect(summaryOf('Application')).toContain('2 of 3 required');
    // the Loan Purpose is the third required field of the section
    fireEvent.change(screen.getByLabelText(/^Loan Purpose/), {
      target: { value: 'Purchase of flat' },
    });
    expect(summaryOf('Application')).toContain('Complete');
  });

  it('counts the GSTIN as a third required field of Identity once Business is chosen', () => {
    renderPage();
    fireEvent.click(header('Applicant'));
    fireEvent.change(screen.getByLabelText(/^Occupation/), { target: { value: 'Business' } });
    expect(summaryOf('Identity')).toContain('0 of 3 required');
    fireEvent.change(screen.getByLabelText(/^Occupation/), { target: { value: 'Salaried' } });
    expect(summaryOf('Identity')).toContain('0 of 2 required');
  });

  it('says Complete in green for every filled section of scenario A', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    for (const title of SECTION_TITLES.filter((t) => t !== 'Co-applicant' && t !== 'Consent')) {
      expect(within(header(title)).getByText('Complete')).toHaveClass('text-success');
    }
    expect(summaryOf('Consent')).toContain('0 of 1 required');
  });

  it('shows the number of errors in red instead', () => {
    renderPage();
    fireEvent.click(header('Identity'));
    const pan = screen.getByLabelText('PAN*');
    fireEvent.focus(pan);
    fireEvent.change(pan, { target: { value: 'abc' } });
    fireEvent.blur(pan);
    expect(within(header('Identity')).getByText('1 error')).toHaveClass('text-error-text');
    fireEvent.change(pan, { target: { value: 'ABCPP1234F' } });
    expect(within(header('Identity')).queryByText('1 error')).not.toBeInTheDocument();
  });
});

describe('Next: KYC Validation with errors', () => {
  const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));

  it('opens every section that has a problem, and leaves the others as they were', () => {
    renderPage();
    next();
    for (const title of SECTION_TITLES.filter((t) => t !== 'Co-applicant')) {
      expect(isOpen(title)).toBe(true);
    }
    expect(isOpen('Co-applicant')).toBe(false); // nothing wrong there
  });

  it('opens only the section with the problem when only one thing is wrong', async () => {
    renderPage();
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ consentGiven: true, surety2Pan: '' });
    });
    next();
    expect(isOpen('Sureties')).toBe(true);
    expect(isOpen('Applicant')).toBe(false);
    expect(isOpen('Documents')).toBe(false);
    await waitFor(() => expect(screen.getByLabelText('Surety 2 PAN*')).toHaveFocus());
  });

  it('takes you to the first problem, even in a section that was closed', async () => {
    renderPage();
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ consentGiven: true, fullNameAsPerPan: '' });
    });
    expect(isOpen('Applicant')).toBe(false);
    next();
    expect(isOpen('Applicant')).toBe(true);
    await waitFor(() => expect(screen.getByLabelText(/^Full Name/)).toHaveFocus());
  });

  it('a line of the banner opens its section and goes to the field', async () => {
    renderPage();
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ consentGiven: true, surety2Pan: '' });
    });
    next();
    await waitFor(() => expect(screen.getByLabelText('Surety 2 PAN*')).toHaveFocus());
    fireEvent.click(header('Sureties')); // close it again
    expect(isOpen('Sureties')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Enter Surety 2 PAN' }));
    expect(isOpen('Sureties')).toBe(true);
    await waitFor(() => expect(screen.getByLabelText('Surety 2 PAN*')).toHaveFocus());
  });

  it('the section header shows how many errors it holds', () => {
    renderPage();
    next();
    expect(within(header('Application')).getByText('3 errors')).toBeInTheDocument();
    expect(within(header('Sureties')).getByText('6 errors')).toBeInTheDocument();
    expect(within(header('Documents')).getByText('12 errors')).toBeInTheDocument();
    expect(within(header('Consent')).getByText('1 error')).toBeInTheDocument();
  });
});

describe('the form grid', () => {
  const cell = (label: string | RegExp) => {
    const id = (screen.getByLabelText(label) as HTMLElement).id;
    return document.getElementById(`wrap-${id}`) as HTMLElement;
  };

  it('puts three fields in a row: a field takes a third by default', () => {
    renderPage();
    for (const label of ['Application ID', 'Branch', 'Loan Product']) {
      expect(cell(label)).toHaveClass('lg:col-span-2');
    }
    expect(cell('Application ID').parentElement).toHaveClass('grid', 'lg:grid-cols-6');
  });

  it('gives a long field more room: addresses two thirds, documents half, toggle and consent a row', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
    expect(cell('Address')).toHaveClass('lg:col-span-4');
    expect(cell('Property Address*')).toHaveClass('lg:col-span-4');
    expect(cell('Security Type')).toHaveClass('lg:col-span-4');
    expect(document.getElementById('wrap-field-doc-pan-card')).toHaveClass('lg:col-span-3');
    expect(screen.getByRole('switch').closest('[id^="wrap-"]')).toHaveClass('lg:col-span-6');
    expect(cell(/^I authorise the bank/)).toHaveClass('lg:col-span-6');
  });

  it('a group heading runs across the whole row', () => {
    renderPage();
    fireEvent.click(header('Documents'));
    for (const heading of screen.getAllByRole('heading', { level: 3 })) {
      expect(heading).toHaveClass('lg:col-span-6');
    }
  });

  it('the card takes its width from the theme token (960px, wider than the 654px of the Figma form)', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 }).closest('section')).toHaveClass('w-card');
  });
});
