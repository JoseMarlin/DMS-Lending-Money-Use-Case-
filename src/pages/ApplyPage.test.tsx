import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SEED_APPLICATIONS } from '@/data/seed';
import { STORAGE_KEY, useAppStore } from '@/data/store';
import { DEMO_USERS } from '@/data/users';
import { submitScenario } from '@/test/workflowHelpers';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();

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

describe('ApplyPage shell', () => {
  it('shows the header, the card title, the step indicator and the Step 1 footer', () => {
    renderPage();
    expect(screen.getByRole('banner')).toHaveTextContent('DMS+');
    expect(screen.getByRole('banner')).toHaveTextContent('Priya Kulkarni');
    expect(screen.getByRole('heading', { level: 1, name: 'Home Loan Application' })).toBeVisible();

    const steps = screen.getByRole('list', { name: 'Progress' });
    expect(steps).toHaveTextContent('Application');
    expect(steps).toHaveTextContent('KYC Validation');
    expect(screen.getByText('Application', { selector: 'li *' }).closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: KYC Validation' })).toBeInTheDocument();
  });

  it('draws the sample section from the schema', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 2, name: /^Applicant/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Occupation/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/GSTIN/)).not.toBeInTheDocument();
  });
});

describe('ApplyPage store wiring', () => {
  it('writes each change to the store and to localStorage', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Anita Desai' } });
    expect(state().draft.fullNameAsPerPan).toBe('Anita Desai');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Anita Desai');
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('Anita Desai');
  });

  it('reveals GSTIN for Business and clears it when Occupation changes to Salaried', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/Occupation/), { target: { value: 'Business' } });
    fireEvent.change(screen.getByLabelText(/GSTIN/), { target: { value: '29ABCPP1234F1Z5' } });
    expect(state().draft.gstin).toBe('29ABCPP1234F1Z5');

    fireEvent.change(screen.getByLabelText(/Occupation/), { target: { value: 'Salaried' } });
    expect(screen.queryByLabelText(/GSTIN/)).not.toBeInTheDocument();
    expect(state().draft.gstin).toBe('');
  });

  it('shows the values of a scenario filled from outside the form', () => {
    renderPage();
    state().fillScenario('A');
    // the store update re-renders the form
    return waitFor(() =>
      expect(screen.getByLabelText(/Full Name/)).toHaveValue('Ramesh Patil'),
    ).then(() => {
      expect(screen.getByLabelText(/Occupation/)).toHaveValue('Business');
      expect(screen.getByLabelText(/GSTIN/)).toHaveValue('29ABCPP1234F1Z5');
    });
  });

  it('follows the user chosen in the Act as switcher', async () => {
    renderPage();
    state().setCurrentUser('mahesh');
    expect(await screen.findByText(/Mahesh Joshi/)).toBeInTheDocument();
  });
});

describe('ApplyPage footer', () => {
  it('Save as draft keeps a returned application returned: it is not turned back into a draft', () => {
    const { id, applicationId } = submitScenario('A');
    state().returnForCorrection(id, DEMO_USERS.mahesh, 'Income Proof is not readable.');
    act(() => state().setCurrentUser('priya'));
    renderPage();
    expect(state().draft.applicationId).toBe(applicationId);
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(state().applications.find((a) => a.applicationId === applicationId)?.status).toBe(
      'Returned',
    );
  });

  it('Save as draft saves the application and says so', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Anita Desai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    const saved = state().applications.find((a) => a.applicationId === state().draft.applicationId);
    expect(saved).toMatchObject({ fullNameAsPerPan: 'Anita Desai', status: 'Draft' });
    expect(state().applications).toHaveLength(SEED_APPLICATIONS.length + 1); // 7 seeded, plus this draft
    expect(screen.getByRole('status')).toHaveTextContent(
      `Draft ${state().draft.applicationId} saved`,
    );

    // saving again replaces it, no duplicate
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(state().applications).toHaveLength(SEED_APPLICATIONS.length + 1);
  });

  it('Next moves to step 2 and Back returns to step 1 with the values kept', async () => {
    renderPage();
    act(() => {
      state().fillScenario('B');
      state().updateDraft({ consentGiven: true });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));

    expect(state().currentStep).toBe(2);
    expect(screen.getByRole('heading', { name: 'Verification checks' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Full Name/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(state().currentStep).toBe(1);
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('Anita Desai');
  });

  it('Next does not move on while the form has errors', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    expect(state().currentStep).toBe(1);
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
  });
});
