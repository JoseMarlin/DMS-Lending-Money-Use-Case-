import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import ApplyPage from './ApplyPage';

/** A toast by its words: an Application ID in it is in a span of its own, so it is not one text node. */
const toastText = (text: string) =>
  screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(text));

const state = () => useAppStore.getState();
/** The applications that are there from the start; a saved or submitted draft is one more */
const SEEDED = SEED_APPLICATIONS.length;

function renderForm() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/apply']}>
        <Routes>
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/metadata/master/home-loan" element={<p>THE LIST</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const dialog = () => screen.queryByRole('dialog', { name: 'Discard this application?' });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('Cancel', () => {
  it('is in the footer of the form', () => {
    renderForm();
    expect(button('Cancel')).toBeInTheDocument();
  });

  it('leaves at once for the list when nothing has been entered', () => {
    renderForm();
    fireEvent.click(button('Cancel'));
    expect(screen.getByText('THE LIST')).toBeInTheDocument();
    expect(dialog()).not.toBeInTheDocument();
  });

  it('asks before throwing away what was entered', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Test Person' } });
    fireEvent.click(button('Cancel'));
    expect(dialog()).toBeInTheDocument();
    expect(screen.queryByText('THE LIST')).not.toBeInTheDocument();
  });

  it('Keep editing closes the question and keeps everything', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Test Person' } });
    fireEvent.click(button('Cancel'));
    fireEvent.click(within(dialog()!).getByRole('button', { name: 'Keep editing' }));
    expect(dialog()).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('Test Person');
    expect(state().draft.fullNameAsPerPan).toBe('Test Person');
  });

  it('Escape closes the question too', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Test Person' } });
    fireEvent.click(button('Cancel'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog()).not.toBeInTheDocument();
    expect(state().draft.fullNameAsPerPan).toBe('Test Person');
  });

  it('Discard returns to the list and the form is new the next time', () => {
    renderForm();
    act(() => state().fillScenario('A'));
    const id = state().draft.applicationId;
    fireEvent.click(button('Cancel'));
    fireEvent.click(within(dialog()!).getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('THE LIST')).toBeInTheDocument();
    expect(state().draft.fullNameAsPerPan).toBe('');
    expect(state().draft.documents).toEqual([]);
    expect(state().draft.applicationId).toBe(id);
    expect(state().currentStep).toBe(1);
  });

  it('does not touch an application that was saved as a draft before', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Test Person' } });
    fireEvent.click(button('Save as draft'));
    expect(state().applications).toHaveLength(SEEDED + 1);
    fireEvent.click(button('Cancel'));
    fireEvent.click(within(dialog()!).getByRole('button', { name: 'Discard' }));
    expect(state().applications).toHaveLength(SEEDED + 1);
    expect(state().applications.some((a) => a.fullNameAsPerPan === 'Test Person')).toBe(true);
  });

  it('is on the KYC step too, and Discard there stops the run and starts over', async () => {
    renderForm();
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ consentGiven: true });
    });
    fireEvent.click(button('Next: KYC Validation'));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    // the pop-up is open; close it, then cancel the whole application
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Aadhaar OTP' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(dialog()!).getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('THE LIST')).toBeInTheDocument();
    expect(state().currentStep).toBe(1);
    expect(state().draft.fullNameAsPerPan).toBe('');
  });
});

describe('Submit', () => {
  async function submitScenarioA() {
    renderForm();
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ consentGiven: true });
    });
    fireEvent.click(button('Next: KYC Validation'));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.change(screen.getByLabelText(/^OTP/), { target: { value: '123456' } });
    fireEvent.click(button('Verify OTP'));
    await screen.findByText(/^KYC result: /);
    fireEvent.click(button('Review and submit'));
    fireEvent.click(button('Submit application'));
  }

  it('goes back to the list, with a success message that has the Application ID', async () => {
    await submitScenarioA();
    expect(screen.getByText('THE LIST')).toBeInTheDocument();
    expect(
      toastText(`Application ${state().draft.applicationId} submitted for approval`),
    ).toBeInTheDocument();
  });

  it('has already put the submission in the saved applications, In Level 1 (In-Progress in the list)', async () => {
    await submitScenarioA();
    const saved = state().applications.find((a) => a.applicationId === state().draft.applicationId);
    expect(saved).toMatchObject({
      status: 'In Level 1',
      fullNameAsPerPan: 'Ramesh Patil',
      createdBy: 'Priya Kulkarni',
    });
    expect(state().applications).toHaveLength(SEEDED + 1);
  });

  it('keeps Aadhaar masked in what it saves', async () => {
    await submitScenarioA();
    expect(JSON.stringify(state().applications)).not.toMatch(/\d{12}/);
    expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(/\d{12}/);
  });
});
