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

const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** The form has a Cancel of its own, so the pop-up's Cancel is found inside the pop-up */
const otpCancel = () =>
  within(screen.getByRole('dialog', { name: 'Aadhaar OTP' })).getByRole('button', {
    name: 'Cancel',
  });
/** A real double click sends a second click with detail 2 */
const secondClickOf = (name: string | RegExp) => fireEvent.click(button(name), { detail: 2 });

/** Scenario filled and consent ticked: ready for Next */
function fillScenario(key: 'A' | 'B' | 'C' = 'A') {
  const view = renderPage();
  act(() => {
    state().fillScenario(key);
    state().updateDraft({ consentGiven: true });
  });
  return view;
}

async function throughKyc(key: 'A' | 'B' = 'A') {
  const view = fillScenario(key);
  fireEvent.click(button('Next: KYC Validation'));
  await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
  fireEvent.change(screen.getByLabelText(/^OTP/), { target: { value: '123456' } });
  fireEvent.click(button('Verify OTP'));
  await screen.findByText(/^KYC result: /);
  return view;
}

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('a double click does not skip a step', () => {
  it('the second click on Next: KYC Validation is ignored', () => {
    fillScenario();
    secondClickOf('Next: KYC Validation');
    expect(state().currentStep).toBe(1);
    fireEvent.click(button('Next: KYC Validation'));
    expect(state().currentStep).toBe(2);
  });

  it('a double click on Review and submit shows Review and does not submit', async () => {
    await throughKyc();
    fireEvent.click(button('Review and submit'));
    expect(state().currentStep).toBe(3);
    // the second click of the double click lands on Submit application, in the same place
    secondClickOf('Submit application');
    expect(state().draft.status).not.toBe('In Level 1');
    expect(screen.getByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    fireEvent.click(button('Submit application'));
    expect(state().draft.status).toBe('In Level 1');
  });

  it('a double click on Back goes back one step only', async () => {
    await throughKyc();
    fireEvent.click(button('Review and submit'));
    fireEvent.click(button('Back')); // first click: Review goes back to the KYC result
    secondClickOf('Back'); // second click lands on the Back button of Step 2
    expect(state().currentStep).toBe(2);
  });
});

describe('a saved step that does not fit the saved data', () => {
  it('goes back to Step 1 when Step 1 is not complete', async () => {
    act(() => state().setStep(3));
    renderPage();
    await waitFor(() => expect(state().currentStep).toBe(1));
    expect(button('Next: KYC Validation')).toBeInTheDocument();
  });

  it('is kept when Step 1 is complete', () => {
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ consentGiven: true });
      state().setStep(2);
    });
    renderPage();
    expect(state().currentStep).toBe(2);
  });
});

describe('the cursor and the card on a step change', () => {
  it('puts the cursor on the heading of Step 2 after Next', async () => {
    fillScenario();
    fireEvent.click(button('Next: KYC Validation'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Verification checks' })).toHaveFocus(),
    );
  });

  it('puts the cursor on the heading of Review, and of the submitted card', async () => {
    await throughKyc();
    fireEvent.click(button('Review and submit'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Review your application' })).toHaveFocus(),
    );
    fireEvent.click(button('Submit application'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Application submitted' })).toHaveFocus(),
    );
  });

  it('puts the cursor on the Step 1 heading when Back returns to it', async () => {
    await throughKyc();
    fireEvent.click(button('Back'));
    await waitFor(() => expect(screen.getByText('Step 1 of 3: Application')).toHaveFocus());
  });

  it('does not move the cursor on the first load', () => {
    renderPage();
    expect(document.body).toHaveFocus();
  });
});

describe('a kept KYC result keeps the status', () => {
  it('Back and Next without a change leave the application "KYC Done"', async () => {
    await throughKyc();
    expect(state().draft.status).toBe('KYC Done');
    fireEvent.click(button('Back'));
    fireEvent.click(button('Next: KYC Validation'));
    expect(state().draft.status).toBe('KYC Done');
    expect(state().draft.kycOverallResult).toBe('Pass');
  });
});

describe('Reset demo, a scenario fill and Start new application start the page afresh', () => {
  it('the "Draft saved" message goes away', () => {
    renderPage();
    fireEvent.click(button('Save as draft'));
    expect(screen.getByText(/^Draft HL-.* saved$/)).toBeInTheDocument();
    act(() => state().resetDemo());
    expect(screen.queryByText(/saved$/)).not.toBeInTheDocument();

    fireEvent.click(button('Save as draft'));
    act(() => state().fillScenario('B'));
    expect(screen.queryByText(/saved$/)).not.toBeInTheDocument();
  });

  it('Reset demo closes the sections the presenter opened', () => {
    renderPage();
    fireEvent.click(button('Expand all sections'));
    expect(button('Collapse all sections')).toBeInTheDocument();
    act(() => state().resetDemo());
    expect(button('Expand all sections')).toBeInTheDocument();
  });

  it('a scenario fill leaves the sections as they are, so the filled values can be seen', () => {
    renderPage();
    fireEvent.click(button('Expand all sections'));
    act(() => state().fillScenario('A'));
    expect(button('Collapse all sections')).toBeInTheDocument();
  });
});

describe('what a section header says', () => {
  it('says "Check details" when a filled field breaks a rule that is not showing yet', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    const header = () => screen.getByRole('button', { name: /^Application/ });
    expect(within(header()).getByText('Complete')).toBeInTheDocument();
    act(() => state().updateDraft({ loanAmountRequested: 9_900_000 }));
    expect(within(header()).getByText('Check details')).toBeInTheDocument();
    expect(within(header()).queryByText('Complete')).not.toBeInTheDocument();
  });
});

describe('the OTP pop-up and the cursor', () => {
  it('Cancel puts the cursor on the Enter OTP button', async () => {
    fillScenario();
    fireEvent.click(button('Next: KYC Validation'));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.click(otpCancel());
    await waitFor(() => expect(button('Enter OTP')).toHaveFocus());
  });

  it('Cancel cannot be pressed while the OTP is being checked', async () => {
    fillScenario();
    fireEvent.click(button('Next: KYC Validation'));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.change(screen.getByLabelText(/^OTP/), { target: { value: '123456' } });
    fireEvent.click(button('Verify OTP'));
    expect(otpCancel()).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('the OTP box is marked as required', async () => {
    fillScenario();
    fireEvent.click(button('Next: KYC Validation'));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(screen.getByLabelText(/^OTP/)).toBeRequired();
  });
});

describe('a new Exception starts without the old remark error', () => {
  it('the error of an earlier result is not shown again after Re-run checks', async () => {
    await throughKyc('B');
    const remark = screen.getByLabelText(/^KYC Exception Remark/);
    fireEvent.blur(remark);
    expect(screen.getByText('Enter a remark to continue')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Re-run checks' }));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.change(screen.getByLabelText(/^OTP/), { target: { value: '123456' } });
    fireEvent.click(button('Verify OTP'));
    await screen.findByText(/^KYC result: /);
    expect(screen.queryByText('Enter a remark to continue')).not.toBeInTheDocument();
  });
});

describe('a Business applicant without a GSTIN', () => {
  it('is stopped at Step 1, which asks for the GSTIN, so the GST check never starts without one', async () => {
    fillScenario('A');
    act(() => state().updateDraft({ gstin: '' }));
    fireEvent.click(button('Next: KYC Validation'));
    expect(state().currentStep).toBe(1);
    expect(screen.queryByRole('dialog', { name: 'Aadhaar OTP' })).not.toBeInTheDocument();
    expect(button('Enter GSTIN')).toBeInTheDocument();
    expect(screen.getByText('Fix 1 error before moving to KYC Validation')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('GSTIN*')).toHaveFocus());
  });

  it('goes on to the GST check once the GSTIN is entered', async () => {
    fillScenario('A');
    act(() => state().updateDraft({ gstin: '' }));
    fireEvent.click(button('Next: KYC Validation'));
    expect(state().currentStep).toBe(1);
    fireEvent.change(screen.getByLabelText('GSTIN*'), { target: { value: '29ABCPP1234F1Z5' } });
    fireEvent.click(button('Next: KYC Validation'));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(
      screen.queryByText('No GSTIN was entered, so the GST check was skipped'),
    ).not.toBeInTheDocument();
  });
});
