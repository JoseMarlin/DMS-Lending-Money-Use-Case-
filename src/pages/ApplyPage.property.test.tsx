import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/data/store';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();
const field = (label: string | RegExp) => screen.getByLabelText(label);
const coApplicantSwitch = () => screen.getByRole('switch', { name: 'Add a co-applicant' });

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

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('Property and security', () => {
  it('has the fields of 6.4 with the right required marks', () => {
    renderPage();
    ['Property Address', 'Property Owner Name', 'Estimated Cost'].forEach((label) => {
      expect(field(`${label}*`)).toBeRequired();
    });
    expect(field('Property Address*').tagName).toBe('TEXTAREA');
    expect(field('Eligible Amount')).not.toBeRequired();
    expect(field('Security Type')).not.toBeRequired();
  });

  it('Loan Purpose is required: the Eligible Amount and the list of documents depend on it', () => {
    renderPage();
    expect(field('Loan Purpose*')).toBeRequired();
    expect(field('Loan Purpose*').tagName).toBe('SELECT');
  });

  it('Security Type is a dropdown with its one choice already selected', () => {
    renderPage();
    const security = field('Security Type') as HTMLSelectElement;
    expect(security.tagName).toBe('SELECT');
    expect(security).toHaveValue('Mortgage of unencumbered immovable property');
    expect(Array.from(security.options).map((o) => o.textContent)).toEqual([
      'Select',
      'Mortgage of unencumbered immovable property',
    ]);
  });

  it('Eligible Amount is read only and empty with a hint until a purpose is chosen', () => {
    renderPage();
    expect(field('Eligible Amount')).toBeDisabled();
    expect(field('Eligible Amount')).toHaveValue('');
    expect(field('Eligible Amount')).toHaveAccessibleDescription(
      'Select a Loan Purpose to see the eligible amount.',
    );
  });

  it('Construction: 75% of Estimated Cost, recalculated as you type, capped at 30,00,000', () => {
    renderPage();
    fireEvent.change(field('Loan Purpose*'), { target: { value: 'Construction of house' } });
    expect(field('Eligible Amount')).toHaveValue('');
    expect(field('Eligible Amount')).toHaveAccessibleDescription(
      '75% of Estimated Cost, up to 30,00,000.',
    );

    fireEvent.change(field(/^Estimated Cost/), { target: { value: '2600000' } });
    expect(field('Eligible Amount')).toHaveValue('19,50,000');
    expect(state().draft.eligibleAmount).toBe(1_950_000);

    fireEvent.change(field(/^Estimated Cost/), { target: { value: '1650000' } });
    expect(field('Eligible Amount')).toHaveValue('12,37,500');

    fireEvent.change(field(/^Estimated Cost/), { target: { value: '5000000' } });
    expect(field('Eligible Amount')).toHaveValue('30,00,000');

    fireEvent.change(field(/^Estimated Cost/), { target: { value: '' } });
    expect(field('Eligible Amount')).toHaveValue('');
  });

  it('other purposes show only the 30,00,000 cap, whatever the cost', () => {
    renderPage();
    fireEvent.change(field('Loan Purpose*'), { target: { value: 'Purchase of flat' } });
    expect(field('Eligible Amount')).toHaveValue('30,00,000');
    expect(field('Eligible Amount')).toHaveAccessibleDescription(
      'Maximum home loan amount: 30,00,000.',
    );
    fireEvent.change(field(/^Estimated Cost/), { target: { value: '1000000' } });
    expect(field('Eligible Amount')).toHaveValue('30,00,000');
  });

  it('switching the purpose recalculates at once', () => {
    renderPage();
    fireEvent.change(field(/^Estimated Cost/), { target: { value: '2600000' } });
    fireEvent.change(field('Loan Purpose*'), { target: { value: 'Construction of house' } });
    expect(field('Eligible Amount')).toHaveValue('19,50,000');
    fireEvent.change(field('Loan Purpose*'), { target: { value: 'Purchase of plot' } });
    expect(field('Eligible Amount')).toHaveValue('30,00,000');
    fireEvent.change(field('Loan Purpose*'), { target: { value: '' } });
    expect(field('Eligible Amount')).toHaveValue('');
  });
});

describe('Co-applicant', () => {
  it('starts with the toggle off and no name or relation', () => {
    renderPage();
    expect(coApplicantSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(coApplicantSwitch()).not.toBeDisabled();
    expect(screen.queryByLabelText('Co-applicant Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Relation')).not.toBeInTheDocument();
    expect(screen.getByText('Optional.')).toBeInTheDocument();
  });

  it('shows the calculated flag as read only, No for a young applicant', () => {
    renderPage();
    expect(field('Co-applicant Required')).toBeDisabled();
    expect(field('Co-applicant Required')).toHaveValue('No');
  });

  it('turning it on shows Co-applicant Name and Relation and saves the choice', () => {
    renderPage();
    fireEvent.click(coApplicantSwitch());
    expect(coApplicantSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(state().draft.addCoApplicant).toBe(true);

    const relation = field('Relation') as HTMLSelectElement;
    expect(Array.from(relation.options).map((o) => o.textContent)).toEqual([
      'Select',
      'Spouse',
      'Son',
      'Father',
      'Mother',
    ]);
    fireEvent.change(field('Co-applicant Name'), { target: { value: 'Sunanda Patil' } });
    fireEvent.change(relation, { target: { value: 'Spouse' } });
    expect(state().draft).toMatchObject({
      coApplicantName: 'Sunanda Patil',
      coApplicantRelation: 'Spouse',
    });
  });

  it('turning it off hides and clears the co-applicant details', () => {
    renderPage();
    fireEvent.click(coApplicantSwitch());
    fireEvent.change(field('Co-applicant Name'), { target: { value: 'Sunanda Patil' } });
    fireEvent.change(field('Relation'), { target: { value: 'Spouse' } });
    fireEvent.click(coApplicantSwitch());
    expect(screen.queryByLabelText('Co-applicant Name')).not.toBeInTheDocument();
    expect(state().draft).toMatchObject({
      addCoApplicant: false,
      coApplicantName: '',
      coApplicantRelation: '',
    });
  });

  it('is forced on and locked when the applicant is above 60', () => {
    renderPage();
    fireEvent.change(field(/^Date of Birth/), { target: { value: '01/01/1950' } });
    expect(field('Co-applicant Required')).toHaveValue('Yes');
    expect(coApplicantSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(coApplicantSwitch()).toBeDisabled();
    expect(coApplicantSwitch()).toHaveAccessibleDescription(
      'A co-applicant is required because the applicant is above 60.',
    );
    expect(field('Co-applicant Name')).toBeInTheDocument();

    fireEvent.click(coApplicantSwitch());
    expect(state().draft.addCoApplicant).toBe(true);
  });

  it('can be switched off again once the applicant is not above 60', () => {
    renderPage();
    fireEvent.change(field(/^Date of Birth/), { target: { value: '01/01/1950' } });
    fireEvent.change(field(/^Date of Birth/), { target: { value: '14/03/1984' } });
    expect(field('Co-applicant Required')).toHaveValue('No');
    expect(coApplicantSwitch()).not.toBeDisabled();
    expect(coApplicantSwitch()).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(coApplicantSwitch());
    expect(state().draft.addCoApplicant).toBe(false);
  });
});

describe('Sureties', () => {
  it('has a note under the heading and six required fields', () => {
    renderPage();
    expect(screen.getByText('Two sureties are required.')).toBeInTheDocument();
    [1, 2].forEach((n) => {
      expect(field(`Surety ${n} Name*`)).toBeRequired();
      expect(field(`Surety ${n} Mobile*`)).toBeRequired();
      expect(field(`Surety ${n} PAN*`)).toBeRequired();
      expect(field(`Surety ${n} Mobile*`)).toHaveAttribute('type', 'tel');
    });
  });

  it('writes to the store and turns PAN into capitals', () => {
    renderPage();
    fireEvent.change(field('Surety 1 Name*'), { target: { value: 'Mohan Joshi' } });
    fireEvent.change(field('Surety 1 Mobile*'), { target: { value: '9876500111' } });
    fireEvent.change(field('Surety 1 PAN*'), { target: { value: 'abcps1101a' } });
    fireEvent.change(field('Surety 2 PAN*'), { target: { value: 'abcps1102b' } });
    expect(state().draft).toMatchObject({
      surety1Name: 'Mohan Joshi',
      surety1Mobile: '9876500111',
      surety1Pan: 'ABCPS1101A',
      surety2Pan: 'ABCPS1102B',
    });
    expect(field('Surety 1 PAN*')).toHaveValue('ABCPS1101A');
  });
});

describe('Fill with scenario: new sections', () => {
  it('scenario A fills property, co-applicant and sureties', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    expect(field('Property Address*')).toHaveValue('Plot 21, Shivaji Nagar, Belagavi, Karnataka');
    expect(field('Property Owner Name*')).toHaveValue('Ramesh Patil');
    expect(field(/^Estimated Cost/)).toHaveValue('26,00,000');
    expect(field('Eligible Amount')).toHaveValue('19,50,000');
    expect(field('Security Type')).toHaveValue('Mortgage of unencumbered immovable property');
    expect(coApplicantSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(field('Co-applicant Required')).toHaveValue('No');
    expect(field('Surety 1 Name*')).toHaveValue('Mohan Joshi');
    expect(field('Surety 1 Mobile*')).toHaveValue('9876500111');
    expect(field('Surety 1 PAN*')).toHaveValue('ABCPS1101A');
    expect(field('Surety 2 Name*')).toHaveValue('Sanjay Shinde');
    expect(field('Surety 2 Mobile*')).toHaveValue('9876500112');
    expect(field('Surety 2 PAN*')).toHaveValue('ABCPS1102B');
  });

  it('scenarios B and C show their eligible amounts', () => {
    renderPage();
    act(() => state().fillScenario('B'));
    expect(field(/^Estimated Cost/)).toHaveValue('16,50,000');
    expect(field('Eligible Amount')).toHaveValue('12,37,500');
    act(() => state().fillScenario('C'));
    expect(field(/^Estimated Cost/)).toHaveValue('14,00,000');
    expect(field('Eligible Amount')).toHaveValue('10,50,000');
  });
});
