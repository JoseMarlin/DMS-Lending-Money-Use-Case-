import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SCENARIOS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();
const field = (label: string | RegExp) => screen.getByLabelText(label);
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));

const AMOUNT = /^Loan Amount Requested/;
const PURPOSE = /^Loan Purpose/;
/** A blank form is wrong in 32 places: the 31 required fields that show, and Loan Purpose */
const BLANK_FORM_ERRORS = 32;
const PAN = 'PAN*';
const OVER_75 = 'Amount exceeds 75% of the estimate. Maximum 19,50,000';

function renderBare() {
  return render(
    <MemoryRouter>
      <ApplyPage />
    </MemoryRouter>,
  );
}

function renderPage() {
  const view = renderBare();
  // the sections are accordions and the first one is open: open them all, as a presenter would
  fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
  return view;
}

/** Type a value and leave the field, as a user does */
function enter(label: string | RegExp, value: string) {
  const input = field(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

/** Scenario filled and the consent ticked, ready for Next */
function fill(key: 'A' | 'B' | 'C', consent = true) {
  act(() => {
    state().fillScenario(key);
    if (consent) state().updateDraft({ consentGiven: true });
  });
}

/** The error text under a field, or null */
function errorOf(label: string | RegExp): string | null {
  const id = `${field(label).id}-message`;
  const el = document.getElementById(id);
  return el && el.getAttribute('role') === 'alert' ? el.textContent : null;
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  localStorage.clear();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  state().resetDemo();
});

describe('errors when the user leaves a field', () => {
  it('shows nothing while typing, then the error in red under the field when leaving it', () => {
    renderPage();
    const pan = field(PAN);
    fireEvent.focus(pan);
    fireEvent.change(pan, { target: { value: 'abc' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.blur(pan);
    expect(errorOf(PAN)).toBe('Enter a valid PAN, for example ABCPP1234F');
    expect(pan).toBeInvalid();
    expect(pan).toHaveAccessibleDescription('Enter a valid PAN, for example ABCPP1234F');
    expect(document.getElementById('field-pan-message')).toHaveClass('text-error-text');
  });

  it('clears as soon as the value is fixed, without leaving the field again', () => {
    renderPage();
    enter(PAN, 'abc');
    expect(errorOf(PAN)).not.toBeNull();
    fireEvent.change(field(PAN), { target: { value: 'abcpp1234f' } });
    expect(errorOf(PAN)).toBeNull();
    expect(field(PAN)).toBeValid();
    expect(field(PAN)).toHaveValue('ABCPP1234F');
  });

  it('asks for a required field that was left empty, and clears when it is filled', () => {
    renderPage();
    fireEvent.focus(field(/^Full Name/));
    fireEvent.blur(field(/^Full Name/));
    expect(errorOf(/^Full Name/)).toBe('Enter Full Name (as per PAN)');
    fireEvent.change(field(/^Full Name/), { target: { value: 'Ramesh Patil' } });
    expect(errorOf(/^Full Name/)).toBeNull();
  });

  it('asks for a dropdown with Select', () => {
    renderPage();
    fireEvent.blur(field(/^Occupation/));
    expect(errorOf(/^Occupation/)).toBe('Select Occupation');
    fireEvent.change(field(/^Occupation/), { target: { value: 'Salaried' } });
    expect(errorOf(/^Occupation/)).toBeNull();
  });

  it('shows the error only under the field that was left', () => {
    renderPage();
    enter(PAN, 'abc');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    fireEvent.change(field(/^Mobile/), { target: { value: '12' } });
    expect(screen.getAllByRole('alert')).toHaveLength(1); // Mobile not left yet
  });

  it('does not make a fuss about an optional field that is empty', () => {
    renderPage();
    fireEvent.blur(field('Monthly Income'));
    fireEvent.blur(field('PIN Code'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    [/^Mobile/, '12345', 'Enter a valid mobile number'],
    [/^Email/, 'not an email', 'Enter a valid email address'],
    ['PIN Code', '5900', 'Enter a valid 6-digit PIN code'],
    [/^Tenure/, '241', 'Maximum tenure is 240 months'],
    ['Surety 1 Mobile*', '98765', 'Enter a valid mobile number'],
    ['Surety 2 PAN*', 'abcde1234f', 'Enter a valid PAN, for example ABCPP1234F'],
  ])('%s: %s', (label, value, message) => {
    renderPage();
    enter(label, value);
    expect(errorOf(label)).toBe(message);
  });

  it('Date of Birth: age must be 18 to 55', () => {
    renderPage();
    enter(/^Date of Birth/, '08/10/2015');
    expect(errorOf(/^Date of Birth/)).toBe('Applicant age must be between 18 and 55');
    fireEvent.change(field(/^Date of Birth/), { target: { value: '14/03/1984' } });
    expect(errorOf(/^Date of Birth/)).toBeNull();
  });

  it('Property Owner Name must be the applicant, and follows a change of the applicant name', () => {
    renderPage();
    fireEvent.change(field(/^Full Name/), { target: { value: 'Ramesh Patil' } });
    enter(/^Property Owner Name/, 'Suresh Patil');
    expect(errorOf(/^Property Owner Name/)).toBe("Property must be in the applicant's name");
    fireEvent.change(field(/^Full Name/), { target: { value: 'Suresh Patil' } });
    expect(errorOf(/^Property Owner Name/)).toBeNull();
  });

  it('GSTIN must hold the PAN entered, and follows a change of the PAN', () => {
    renderPage();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Business' } });
    enter(PAN, 'ABCPP1234F');
    enter('GSTIN*', '29ABCPD5678K1Z5');
    expect(errorOf('GSTIN*')).toBe('GSTIN does not match the PAN entered');
    fireEvent.change(field(PAN), { target: { value: 'ABCPD5678K' } });
    expect(errorOf('GSTIN*')).toBeNull();
  });

  it('GSTIN is asked for once it shows, and clears when it is filled', () => {
    renderPage();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Professional' } });
    fireEvent.focus(field('GSTIN*'));
    fireEvent.blur(field('GSTIN*'));
    expect(errorOf('GSTIN*')).toBe('Enter GSTIN');
    fireEvent.change(field('GSTIN*'), { target: { value: '29ABCPP1234F1Z5' } });
    expect(errorOf('GSTIN*')).toBeNull();
  });

  it('asks for the Loan Purpose with Select, and clears when one is chosen', () => {
    renderPage();
    fireEvent.blur(field(PURPOSE));
    expect(errorOf(PURPOSE)).toBe('Select Loan Purpose');
    fireEvent.change(field(PURPOSE), { target: { value: 'Purchase of flat' } });
    expect(errorOf(PURPOSE)).toBeNull();
  });

  it('Aadhaar: a number that fails the checksum is flagged, and kept as no digits', () => {
    renderPage();
    const aadhaar = field('Aadhaar*');
    fireEvent.focus(aadhaar);
    fireEvent.change(aadhaar, { target: { value: '234500074822' } });
    fireEvent.blur(aadhaar);
    expect(errorOf('Aadhaar*')).toBe('Enter a valid 12-digit Aadhaar');
    expect(state().draft.aadhaar).toBe('XXXX XXXX XXXX');
    expect(aadhaar).toHaveValue('XXXX XXXX XXXX');

    // fix it: the real number is still in memory while the page stays open
    fireEvent.focus(aadhaar);
    expect(aadhaar).toHaveValue('2345 0007 4822');
    fireEvent.change(aadhaar, { target: { value: '234500074821' } });
    fireEvent.blur(aadhaar);
    expect(errorOf('Aadhaar*')).toBeNull();
    expect(state().draft.aadhaar).toBe('XXXX XXXX 4821');
  });

  it('Aadhaar: a half-typed number is flagged too', () => {
    renderPage();
    enter('Aadhaar*', '2345 0007');
    expect(errorOf('Aadhaar*')).toBe('Enter a valid 12-digit Aadhaar');
  });
});

describe('scenario A: 22,00,000 requested', () => {
  it('shows "Amount exceeds 75% of the estimate. Maximum 19,50,000" on leaving the field', () => {
    renderPage();
    fill('A');
    expect(errorOf(AMOUNT)).toBeNull();
    enter(AMOUNT, '2200000');
    expect(field(AMOUNT)).toHaveValue('22,00,000');
    expect(errorOf(AMOUNT)).toBe(OVER_75);
  });

  it('clears when the amount is fixed, and when the estimate is raised so that it fits', () => {
    renderPage();
    fill('A');
    enter(AMOUNT, '2200000');
    fireEvent.change(field(AMOUNT), { target: { value: '1800000' } });
    expect(errorOf(AMOUNT)).toBeNull();

    enter(AMOUNT, '2200000');
    expect(errorOf(AMOUNT)).toBe(OVER_75);
    fireEvent.change(field(/^Estimated Cost/), { target: { value: '3000000' } });
    expect(field('Eligible Amount')).toHaveValue('22,50,000');
    expect(errorOf(AMOUNT)).toBeNull();
  });

  it('follows the new maximum when the estimate changes', () => {
    renderPage();
    fill('A');
    enter(AMOUNT, '2200000');
    fireEvent.change(field(/^Estimated Cost/), { target: { value: '2800000' } });
    expect(errorOf(AMOUNT)).toBe('Amount exceeds 75% of the estimate. Maximum 21,00,000');
  });

  it('over 30,00,000 on another purpose gives the cap message', () => {
    renderPage();
    fill('A');
    fireEvent.change(field(PURPOSE), { target: { value: 'Purchase of flat' } });
    enter(AMOUNT, '3100000');
    expect(errorOf(AMOUNT)).toBe('Maximum home loan is 30,00,000');
  });
});

describe('Next: KYC Validation with errors', () => {
  it('on a blank form stays on step 1 and lists every problem in a banner at the top', () => {
    renderPage();
    next();
    expect(state().currentStep).toBe(1);

    const banner = screen
      .getByText(new RegExp(`^Fix ${BLANK_FORM_ERRORS} errors before moving to KYC Validation$`))
      .closest('[role="alert"]')!;
    expect(banner).toBeInTheDocument();
    const lines = within(banner as HTMLElement)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(lines).toHaveLength(BLANK_FORM_ERRORS);
    expect(lines[0]).toBe('Select Loan Purpose');
    expect(lines[1]).toBe('Enter Loan Amount Requested');
    expect(lines).toContain('Enter Full Name (as per PAN)');
    expect(lines).toContain('Upload PAN Card');
    expect(lines).toContain('Tick the consent to continue');
  });

  it('puts the banner above the scrolling form, not inside it', () => {
    renderPage();
    next();
    const banner = screen.getByText(/^Fix 32 errors/).closest('[role="alert"]')!;
    const body = document.querySelector('.thin-scrollbar')!;
    expect(body.contains(banner)).toBe(false);
    expect(screen.getByRole('list', { name: 'Progress' }).compareDocumentPosition(banner)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('shows the error under every field that is wrong', () => {
    renderPage();
    next();
    expect(errorOf(PURPOSE)).toBe('Select Loan Purpose');
    expect(errorOf(AMOUNT)).toBe('Enter Loan Amount Requested');
    expect(errorOf(/^Full Name/)).toBe('Enter Full Name (as per PAN)');
    expect(errorOf('Surety 2 Name*')).toBe('Enter Surety 2 Name');
    expect(errorOf(/^I authorise the bank/)).toBe('Tick the consent to continue');
    expect(document.getElementById('field-doc-pan-card-message')).toHaveTextContent(
      'Upload PAN Card',
    );
  });

  it('scrolls to the first invalid field and puts the cursor in it', async () => {
    renderPage();
    next();
    // Loan Purpose is the first field that is wrong
    await waitFor(() => expect(field(PURPOSE)).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
    expect((scrollIntoView.mock.contexts.at(-1) as HTMLElement).id).toBe('wrap-field-loanPurpose');
  });

  it('goes to the first problem in the order of the form', async () => {
    renderPage();
    fill('A');
    act(() => state().updateDraft({ surety2Pan: '', fullNameAsPerPan: '' }));
    next();
    await waitFor(() => expect(field(/^Full Name/)).toHaveFocus());
  });

  it('picking a line in the banner takes you to that field', async () => {
    renderPage();
    next();
    await waitFor(() => expect(field(PURPOSE)).toHaveFocus()); // the automatic move to the first error
    fireEvent.click(screen.getByRole('button', { name: 'Enter Surety 1 PAN' }));
    await waitFor(() => expect(field('Surety 1 PAN*')).toHaveFocus());
    expect((scrollIntoView.mock.contexts.at(-1) as HTMLElement).id).toBe('wrap-field-surety1Pan');
  });

  it('a line for a document takes you to its Choose file button', async () => {
    renderPage();
    next();
    await waitFor(() => expect(field(PURPOSE)).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Upload Photograph' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Choose file for Photograph' })).toHaveFocus(),
    );
  });

  it('the banner follows the fixes: the count goes down and it disappears at zero', () => {
    renderPage();
    fill('A', false);
    next();
    expect(screen.getByText('Fix 1 error before moving to KYC Validation')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tick the consent to continue' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /I authorise the bank/ }));
    expect(screen.queryByText(/before moving to KYC Validation/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows 31 errors after one field is filled', () => {
    renderPage();
    next();
    fireEvent.change(field(AMOUNT), { target: { value: '1800000' } });
    expect(
      screen.getByText(`Fix ${BLANK_FORM_ERRORS - 1} errors before moving to KYC Validation`),
    ).toBeInTheDocument();
  });

  it('names the field in front of a message that does not say which one it is for', () => {
    renderPage();
    fill('A');
    act(() => state().updateDraft({ mobile: '123', tenureMonths: 300, surety1Mobile: '456' }));
    next();
    const lines = within(screen.getByText(/^Fix 3 errors/).closest('[role="alert"]') as HTMLElement)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(lines).toEqual([
      'Tenure (months): Maximum tenure is 240 months',
      'Enter a valid mobile number',
      'Surety 1 Mobile: Enter a valid mobile number',
    ]);
  });

  it('the consent line reads "Tick the consent to continue", without the whole consent sentence', () => {
    renderPage();
    fill('A', false);
    next();
    const banner = screen.getByText(/^Fix 1 error/).closest('[role="alert"]') as HTMLElement;
    expect(banner).toHaveTextContent('Tick the consent to continue');
    expect(banner).not.toHaveTextContent('I authorise the bank');
  });

  it('scenario A with 22,00,000 is stopped with the 75% message', async () => {
    renderPage();
    fill('A');
    act(() => state().updateDraft({ loanAmountRequested: 2_200_000 }));
    next();
    expect(state().currentStep).toBe(1);
    expect(screen.getByText('Fix 1 error before moving to KYC Validation')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Loan Amount Requested: ${OVER_75}` }),
    ).toBeInTheDocument();
    expect(errorOf(AMOUNT)).toBe(OVER_75);
    await waitFor(() => expect(field(AMOUNT)).toHaveFocus());
  });

  it('stops a scenario that has no Loan Purpose, and takes you to it', async () => {
    renderPage();
    fill('B');
    act(() => state().updateDraft({ loanPurpose: '' }));
    next();
    expect(state().currentStep).toBe(1);
    expect(screen.getByText('Fix 1 error before moving to KYC Validation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Loan Purpose' })).toBeInTheDocument();
    expect(errorOf(PURPOSE)).toBe('Select Loan Purpose');
    await waitFor(() => expect(field(PURPOSE)).toHaveFocus());
  });

  it('stops for a missing document and for an Aadhaar that failed the checksum', () => {
    renderPage();
    fill('A');
    act(() =>
      state().updateDraft({
        aadhaar: 'XXXX XXXX XXXX',
        documents: state().draft.documents.filter((d) => d.docType !== 'Photograph'),
      }),
    );
    next();
    expect(state().currentStep).toBe(1);
    expect(screen.getByText(/^Fix 2 errors/)).toBeInTheDocument();
    expect(errorOf('Aadhaar*')).toBe('Enter a valid 12-digit Aadhaar');
    expect(document.getElementById('field-doc-photograph-message')).toHaveTextContent(
      'Upload Photograph',
    );
  });

  it('starts afresh after a scenario is filled', () => {
    renderPage();
    next();
    expect(screen.getByText(/^Fix 32 errors/)).toBeInTheDocument();
    fill('A', false);
    expect(screen.queryByText(/Fix \d+ error/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Next: KYC Validation without errors', () => {
  it.each(['A', 'B', 'C'] as const)('scenario %s moves to step 2 with status Draft', (key) => {
    renderPage();
    fill(key);
    next();
    expect(state().currentStep).toBe(2);
    expect(state().draft.status).toBe('Draft');
    expect(screen.queryByText(/before moving to KYC Validation/)).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Progress' })).toHaveTextContent('KYC Validation');
  });

  it('sets the status to Draft', () => {
    renderPage();
    fill('A');
    act(() => state().updateDraft({ status: 'KYC Done' }));
    next();
    expect(state().currentStep).toBe(2);
    expect(state().draft.status).toBe('Draft');
  });

  it('the banner is gone when you come back to step 1', () => {
    renderPage();
    fill('A');
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field(/^Full Name/)).toHaveValue('Ramesh Patil');
  });

  it('works after the first attempt failed and the problem was fixed', () => {
    renderPage();
    fill('A');
    act(() => state().updateDraft({ loanAmountRequested: 2_200_000 }));
    next();
    expect(state().currentStep).toBe(1);
    fireEvent.change(field(AMOUNT), { target: { value: '1900000' } });
    expect(screen.queryByText(/before moving to KYC Validation/)).not.toBeInTheDocument();
    next();
    expect(state().currentStep).toBe(2);
  });
});

describe('Next: duplicate PAN', () => {
  it('stops when a saved application has the same PAN, and says which one', async () => {
    renderPage();
    fill('A');
    act(() => state().saveApplication({ ...state().draft, applicationId: 'HL-2026-0042' }));
    next();

    expect(state().currentStep).toBe(1);
    expect(errorOf(PAN)).toBe('An application for this PAN already exists: HL-2026-0042');
    expect(
      screen.getByRole('button', {
        name: 'An application for this PAN already exists: HL-2026-0042',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Fix 1 error before moving to KYC Validation')).toBeInTheDocument();
    await waitFor(() => expect(field(PAN)).toHaveFocus());
  });

  it('is fine again once the PAN is changed', () => {
    renderPage();
    fill('B');
    act(() => state().saveApplication({ ...state().draft, applicationId: 'HL-2026-0042' }));
    next();
    expect(errorOf(PAN)).toBe('An application for this PAN already exists: HL-2026-0042');
    fireEvent.change(field(PAN), { target: { value: 'ABCPD9999Z' } });
    expect(errorOf(PAN)).toBeNull();
    expect(screen.queryByText(/before moving to KYC Validation/)).not.toBeInTheDocument();
    next();
    expect(state().currentStep).toBe(2);
  });

  it('does not count a saved draft of the same application', () => {
    renderPage();
    fill('A');
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(state().applications.some((a) => a.applicationId === state().draft.applicationId)).toBe(
      true,
    );
    next();
    expect(state().currentStep).toBe(2);
  });

  it('is not shown before Next is pressed', () => {
    renderPage();
    fill('A');
    act(() => state().saveApplication({ ...state().draft, applicationId: 'HL-2026-0042' }));
    fireEvent.focus(field(PAN));
    fireEvent.blur(field(PAN));
    expect(errorOf(PAN)).toBeNull();
  });

  it('seeded applications never clash with the scenarios', () => {
    ['A', 'B', 'C'].forEach((key) => {
      renderPage();
      act(() => {
        state().fillScenario(key as 'A' | 'B' | 'C');
        state().updateDraft({ consentGiven: true });
      });
      next();
      expect(state().currentStep).toBe(2);
      act(() => state().setStep(1));
      document.body.innerHTML = '';
    });
    expect(SCENARIOS.A.application.pan).toBe('ABCPP1234F');
  });
});
