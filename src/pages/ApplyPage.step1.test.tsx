import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toISODate } from '@/data/application';
import { SCENARIOS, SEED_APPLICATIONS } from '@/data/seed';
import { STORAGE_KEY, useAppStore } from '@/data/store';
import { isoToDisplay } from '@/lib/format';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();
const FULL_AADHAAR = /\d{12}|\b\d{4}[ -]\d{4}[ -]\d{4}\b/;

const page = () => (
  <MemoryRouter>
    <ApplyPage />
  </MemoryRouter>
);
function renderPage() {
  const view = render(page());
  // the sections are accordions and the first one is open: open them all, as a presenter would
  fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
  return view;
}
const field = (label: string | RegExp) => screen.getByLabelText(label);

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('Step 1 sections', () => {
  it('shows the sections in the order of the overview', () => {
    renderPage();
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.querySelector('button > span')?.textContent);
    expect(headings).toEqual([
      'Application',
      'Applicant',
      'Identity',
      'Property and security',
      'Co-applicant',
      'Sureties',
      'Documents',
      'Consent',
    ]);
  });

  it('has the fields of 6.1 to 6.3 with the right required marks', () => {
    renderPage();
    const required = [
      'Loan Purpose',
      'Loan Amount Requested',
      'Tenure (months)',
      'Full Name (as per PAN)',
      'Date of Birth',
      'Mobile',
      'Email',
      'Occupation',
      'PAN',
      'Aadhaar',
    ];
    const optional = [
      'Application ID',
      'Branch',
      'Loan Product',
      'Application Date',
      'Monthly Income',
      'Address',
      'PIN Code',
    ];
    required.forEach((label) => expect(field(new RegExp(`^${escape(label)}\\*?$`))).toBeRequired());
    optional.forEach((label) => expect(field(label)).not.toBeRequired());
    // the red asterisk is in the label
    required.forEach((label) =>
      expect(screen.getByText(label, { selector: 'label' }).textContent).toContain('*'),
    );
  });

  it('uses the right control for each type', () => {
    renderPage();
    expect(field('Address').tagName).toBe('TEXTAREA');
    expect(field('Branch').tagName).toBe('SELECT');
    expect(field(/^Loan Purpose/).tagName).toBe('SELECT');
    expect(field(/^Mobile/)).toHaveAttribute('type', 'tel');
    expect(field(/^Email/)).toHaveAttribute('type', 'email');
  });

  it('offers the dropdown choices from the overview', () => {
    renderPage();
    const options = (label: string | RegExp) =>
      Array.from((field(label) as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options(/^Loan Purpose/)).toEqual([
      'Select',
      'Construction of house',
      'Purchase of flat',
      'Purchase of plot',
      'Takeover of housing loan',
      'Property mortgage',
    ]);
    expect(options(/^Occupation/)).toEqual([
      'Select',
      'Salaried',
      'Business',
      'Professional',
      'Agriculturist',
    ]);
    expect(options('Loan Product')).toEqual(['Select', 'Home Loan']);
  });
});

describe('auto and fixed fields', () => {
  it('Application ID, Loan Product and Application Date are read only with their values', () => {
    renderPage();
    expect(field('Application ID')).toBeDisabled();
    expect(field('Application ID')).toHaveValue(state().draft.applicationId);
    // the next number after the seeded applications
    const next = String(SEED_APPLICATIONS.length + 1).padStart(4, '0');
    expect(state().draft.applicationId).toMatch(new RegExp(String.raw`^HL-\d{4}-${next}$`));
    expect(next).toBe('0008');

    expect(field('Loan Product')).toBeDisabled();
    expect(field('Loan Product')).toHaveValue('Home Loan');

    expect(field('Application Date')).toBeDisabled();
    expect(field('Application Date')).toHaveValue(isoToDisplay(toISODate(new Date())));
  });

  it('Branch defaults from the current user', () => {
    renderPage();
    expect(field('Branch')).toHaveValue('Belagavi Main Branch (demo)');
    expect(field('Branch')).not.toBeDisabled();
  });
});

describe('typing into the fields', () => {
  it('shows amounts with Indian grouping and stores a plain number', () => {
    renderPage();
    fireEvent.change(field(/^Loan Amount Requested/), { target: { value: '1800000' } });
    expect(field(/^Loan Amount Requested/)).toHaveValue('18,00,000');
    expect(state().draft.loanAmountRequested).toBe(1800000);

    fireEvent.change(field('Monthly Income'), { target: { value: '150000' } });
    expect(field('Monthly Income')).toHaveValue('1,50,000');
    expect(state().draft.monthlyIncome).toBe(150000);

    fireEvent.change(field(/^Loan Amount Requested/), { target: { value: '' } });
    expect(state().draft.loanAmountRequested).toBeNull();
  });

  it('keeps tenure as a plain number', () => {
    renderPage();
    fireEvent.change(field(/^Tenure/), { target: { value: '180' } });
    expect(field(/^Tenure/)).toHaveValue('180');
    expect(state().draft.tenureMonths).toBe(180);
  });

  it('shows the date as DD/MM/YYYY and stores an ISO date once complete', () => {
    renderPage();
    const dob = field(/^Date of Birth/);
    fireEvent.change(dob, { target: { value: '1403' } });
    expect(dob).toHaveValue('14/03');
    expect(state().draft.dateOfBirth).toBe('');
    fireEvent.change(dob, { target: { value: '14/03/1984' } });
    expect(dob).toHaveValue('14/03/1984');
    expect(state().draft.dateOfBirth).toBe('1984-03-14');
  });

  it('turns PAN and GSTIN into capitals as they are typed', () => {
    renderPage();
    fireEvent.change(field('PAN*'), { target: { value: 'abcpp1234f' } });
    expect(field('PAN*')).toHaveValue('ABCPP1234F');
    expect(state().draft.pan).toBe('ABCPP1234F');

    fireEvent.change(field(/^Occupation/), { target: { value: 'Business' } });
    fireEvent.change(field('GSTIN*'), { target: { value: '29abcpp1234f1z5' } });
    expect(field('GSTIN*')).toHaveValue('29ABCPP1234F1Z5');
    expect(state().draft.gstin).toBe('29ABCPP1234F1Z5');
  });

  it('shows GSTIN only for Business and Professional', () => {
    renderPage();
    expect(screen.queryByLabelText(/^GSTIN/)).not.toBeInTheDocument();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Professional' } });
    expect(field('GSTIN*')).toBeInTheDocument();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Agriculturist' } });
    expect(screen.queryByLabelText(/^GSTIN/)).not.toBeInTheDocument();
  });

  it('marks GSTIN as required while it shows: for Business and Professional', () => {
    renderPage();
    ['Business', 'Professional'].forEach((occupation) => {
      fireEvent.change(field(/^Occupation/), { target: { value: occupation } });
      expect(field('GSTIN*')).toBeRequired();
      expect(screen.getByText('GSTIN', { selector: 'label' }).textContent).toContain('*');
    });
  });
});

describe('Aadhaar field', () => {
  const aadhaar = () => field('Aadhaar*') as HTMLInputElement;

  it('shows digits in groups of four while typing, then masks on blur', () => {
    renderPage();
    fireEvent.focus(aadhaar());
    fireEvent.change(aadhaar(), { target: { value: '2345' } });
    expect(aadhaar()).toHaveValue('2345');
    fireEvent.change(aadhaar(), { target: { value: '23450007' } });
    expect(aadhaar()).toHaveValue('2345 0007');
    fireEvent.change(aadhaar(), { target: { value: '2345 0007 4821' } });
    expect(aadhaar()).toHaveValue('2345 0007 4821');

    fireEvent.blur(aadhaar());
    expect(aadhaar()).toHaveValue('XXXX XXXX 4821');
    expect(state().draft.aadhaar).toBe('XXXX XXXX 4821');
  });

  it('keeps the real number only in memory: never in the store or localStorage', () => {
    renderPage();
    fireEvent.focus(aadhaar());
    fireEvent.change(aadhaar(), { target: { value: '234500074821' } });

    // while typing, the record has nothing
    expect(JSON.stringify(state())).not.toMatch(FULL_AADHAAR);
    fireEvent.blur(aadhaar());

    expect(JSON.stringify(state())).not.toMatch(FULL_AADHAAR);
    expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(FULL_AADHAAR);
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('234500074821');
    expect(document.body.innerHTML).not.toContain('4500 0748'); // not echoed anywhere unmasked
  });

  it('shows the real number again when the user comes back to the field', () => {
    renderPage();
    fireEvent.focus(aadhaar());
    fireEvent.change(aadhaar(), { target: { value: '234500074821' } });
    fireEvent.blur(aadhaar());
    fireEvent.focus(aadhaar());
    expect(aadhaar()).toHaveValue('2345 0007 4821');
    fireEvent.blur(aadhaar());
    expect(aadhaar()).toHaveValue('XXXX XXXX 4821');
    expect(state().draft.aadhaar).toBe('XXXX XXXX 4821');
  });

  it('does not store a wrong last four for a half-typed number', () => {
    renderPage();
    fireEvent.focus(aadhaar());
    fireEvent.change(aadhaar(), { target: { value: '23450007' } });
    fireEvent.blur(aadhaar());
    expect(state().draft.aadhaar).toBe('XXXX XXXX XXXX');
    expect(aadhaar()).toHaveValue('XXXX XXXX XXXX');
  });

  it('clears the record when the user empties the field', () => {
    renderPage();
    fireEvent.focus(aadhaar());
    fireEvent.change(aadhaar(), { target: { value: '234500074821' } });
    fireEvent.blur(aadhaar());
    fireEvent.focus(aadhaar());
    fireEvent.change(aadhaar(), { target: { value: '' } });
    fireEvent.blur(aadhaar());
    expect(state().draft.aadhaar).toBe('');
    expect(aadhaar()).toHaveValue('');
  });

  it('leaves the record alone when the user only tabs through the field', () => {
    renderPage();
    act(() => state().updateDraft({ aadhaar: 'XXXX XXXX 4821' }));
    fireEvent.focus(aadhaar());
    fireEvent.blur(aadhaar());
    expect(state().draft.aadhaar).toBe('XXXX XXXX 4821');
    expect(aadhaar()).toHaveValue('XXXX XXXX 4821');
  });

  it('after a reload the number is gone from memory: masked value shown, empty on focus', () => {
    const first = renderPage();
    fireEvent.focus(aadhaar());
    fireEvent.change(aadhaar(), { target: { value: '234500074821' } });
    fireEvent.blur(aadhaar());
    first.unmount();

    renderPage();
    expect(aadhaar()).toHaveValue('XXXX XXXX 4821');
    fireEvent.focus(aadhaar());
    expect(aadhaar()).toHaveValue('');
    expect(aadhaar()).toHaveAttribute('placeholder', 'XXXX XXXX 4821');
    fireEvent.blur(aadhaar());
    expect(aadhaar()).toHaveValue('XXXX XXXX 4821');
  });
});

describe('Fill with scenario A', () => {
  it('populates every field of the three sections', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    // Re-render happens because the store changed
    expect(field('Application ID')).toHaveValue(state().draft.applicationId);
    expect(field('Branch')).toHaveValue('Belagavi Main Branch (demo)');
    expect(field('Loan Product')).toHaveValue('Home Loan');
    expect(field('Loan Purpose*')).toHaveValue('Construction of house');
    expect(field(/^Loan Amount Requested/)).toHaveValue('18,00,000');
    expect(field(/^Tenure/)).toHaveValue('180');
    expect(field('Application Date')).toHaveValue(isoToDisplay(toISODate(new Date())));

    expect(field(/^Full Name/)).toHaveValue('Ramesh Patil');
    expect(field(/^Date of Birth/)).toHaveValue('14/03/1984');
    expect(field(/^Mobile/)).toHaveValue('9876500011');
    expect(field(/^Email/)).toHaveValue('ramesh.patil@example.com');
    expect(field(/^Occupation/)).toHaveValue('Business');
    expect(field('Monthly Income')).toHaveValue('1,50,000');
    expect(field('Address')).not.toHaveValue('');
    expect(field('PIN Code')).toHaveValue('590006');

    expect(field('PAN*')).toHaveValue('ABCPP1234F');
    expect(field('Aadhaar*')).toHaveValue('XXXX XXXX 4821');
    expect(field('GSTIN*')).toHaveValue('29ABCPP1234F1Z5');
  });

  it('puts the real dummy Aadhaar in the input, shown while it has focus', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    const input = field('Aadhaar*');
    fireEvent.focus(input);
    expect(input).toHaveValue('2345 0007 4821');
    expect(SCENARIOS.A.aadhaarInput).toBe('234500074821');
    fireEvent.blur(input);
    expect(input).toHaveValue('XXXX XXXX 4821');
    expect(JSON.stringify(state())).not.toMatch(FULL_AADHAAR);
  });

  it('works the same when scenario A is filled again over typed values', () => {
    renderPage();
    fireEvent.change(field(/^Full Name/), { target: { value: 'Someone Else' } });
    fireEvent.focus(field('Aadhaar*'));
    fireEvent.change(field('Aadhaar*'), { target: { value: '111122223333' } });
    fireEvent.blur(field('Aadhaar*'));
    act(() => state().fillScenario('A'));
    expect(field(/^Full Name/)).toHaveValue('Ramesh Patil');
    fireEvent.focus(field('Aadhaar*'));
    expect(field('Aadhaar*')).toHaveValue('2345 0007 4821');
  });

  it('scenarios B and C fill the same way without GSTIN', () => {
    renderPage();
    act(() => state().fillScenario('B'));
    expect(field(/^Full Name/)).toHaveValue('Anita Desai');
    expect(field(/^Date of Birth/)).toHaveValue('02/09/1990');
    expect(field(/^Loan Amount Requested/)).toHaveValue('12,00,000');
    expect(field(/^Tenure/)).toHaveValue('120');
    expect(field('PAN*')).toHaveValue('ABCPD5678K');
    expect(field('Aadhaar*')).toHaveValue('XXXX XXXX 7733');
    expect(screen.queryByLabelText(/^GSTIN/)).not.toBeInTheDocument();

    act(() => state().fillScenario('C'));
    expect(field(/^Full Name/)).toHaveValue('Kiran Naik');
    expect(field(/^Date of Birth/)).toHaveValue('21/06/1988');
    expect(field(/^Loan Amount Requested/)).toHaveValue('10,00,000');
    expect(field('Aadhaar*')).toHaveValue('XXXX XXXX 2290');
    expect(screen.queryByLabelText(/^GSTIN/)).not.toBeInTheDocument();
  });

  it('keeps the filled values after a reload', () => {
    const first = renderPage();
    act(() => state().fillScenario('A'));
    first.unmount();
    renderPage();
    expect(field(/^Full Name/)).toHaveValue('Ramesh Patil');
    expect(field(/^Loan Amount Requested/)).toHaveValue('18,00,000');
    expect(field('Aadhaar*')).toHaveValue('XXXX XXXX 4821');
  });

  it('Reset demo empties the form including the Aadhaar input', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    fireEvent.focus(field('Aadhaar*'));
    fireEvent.blur(field('Aadhaar*'));
    act(() => state().resetDemo());
    expect(field(/^Full Name/)).toHaveValue('');
    expect(field('Aadhaar*')).toHaveValue('');
    fireEvent.focus(field('Aadhaar*'));
    expect(field('Aadhaar*')).toHaveValue('');
  });
});

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
