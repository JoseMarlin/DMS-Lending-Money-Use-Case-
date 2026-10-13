import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toISODate } from '@/data/application';
import { useAppStore } from '@/data/store';
import type { KycOutage } from '@/data/types';
import { KYC_CONFIG } from '@/services/mockKyc';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();
const FULL_AADHAAR = /\d{12}|\b\d{4}[ -]\d{4}[ -]\d{4}\b/;

function renderPage() {
  return render(
    <MemoryRouter>
      <ApplyPage />
    </MemoryRouter>,
  );
}

/** Scenario filled, consent ticked, Next pressed: now on Step 2 */
function toStep2(key: 'A' | 'B' | 'C', outage: KycOutage = 'none') {
  const view = renderPage();
  act(() => {
    state().fillScenario(key);
    state().updateDraft({ consentGiven: true });
    state().setKycOutage(outage);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
  return view;
}

/** The form has a Cancel of its own, so the pop-up's Cancel is found inside the pop-up */
const otpCancel = () =>
  within(screen.getByRole('dialog', { name: 'Aadhaar OTP' })).getByRole('button', {
    name: 'Cancel',
  });
const dialog = () => screen.queryByRole('dialog', { name: 'Aadhaar OTP' });
const row = (title: string) =>
  within(screen.getByRole('list', { name: 'KYC checks' }))
    .getByRole('heading', { level: 3, name: title })
    .closest('li') as HTMLElement;
const otpBox = () => screen.getByLabelText(/^OTP/);
const verify = () => fireEvent.click(screen.getByRole('button', { name: /^Verify OTP$/ }));

async function enterOtp(code = '123456') {
  await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
  fireEvent.change(otpBox(), { target: { value: code } });
  verify();
}

async function runToResult(key: 'A' | 'B' | 'C', outage: KycOutage = 'none') {
  const view = toStep2(key, outage);
  await enterOtp();
  await screen.findByText(/^KYC result: /);
  return view;
}

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('Step 2 starts by itself', () => {
  it('has no Verify button: arriving starts the checks, and shows the three of them', async () => {
    KYC_CONFIG.panDelayMs = 300; // hold on the PAN check for a moment
    toStep2('A');
    expect(screen.getByRole('heading', { name: 'Verification checks' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify/i })).not.toBeInTheDocument();
    expect(within(row('PAN')).getByText('Checking')).toBeInTheDocument();
    expect(within(row('Aadhaar')).getByText('Pending')).toBeInTheDocument();
    expect(within(row('GST')).getByText('Pending')).toBeInTheDocument();
    // and then it goes on to the OTP without anyone pressing anything
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(within(row('PAN')).getByText('Verified')).toBeInTheDocument();
  });

  it('each check has a status badge and a progress bar', async () => {
    toStep2('A');
    for (const title of ['PAN', 'Aadhaar', 'GST']) {
      expect(
        within(row(title)).getByRole('progressbar', { name: `${title} check` }),
      ).toBeInTheDocument();
    }
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    const pan = within(row('PAN')).getByRole('progressbar');
    expect(pan).toHaveAttribute('aria-valuenow', '100');
    expect(within(row('Aadhaar')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows the stepper on step 2 with Application done', () => {
    toStep2('A');
    const steps = screen.getByRole('list', { name: 'Progress' });
    expect(steps).toHaveTextContent('Application');
    expect(steps).toHaveTextContent('KYC Validation');
    expect(steps).toHaveTextContent('Review');
    expect(within(steps).getByText('KYC Validation').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('the footer has Back and Review and submit', () => {
    toStep2('A');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeDisabled();
  });

  it('does not run again when the result is already there', async () => {
    await runToResult('A');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    expect(screen.getByText(/^KYC result: Pass/)).toBeInTheDocument();
    expect(dialog()).not.toBeInTheDocument();
  });

  it('starts again after a reload that left Step 2 without a result', async () => {
    const first = toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    first.unmount(); // the page is closed: whatever was running stops
    renderPage();
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(state().currentStep).toBe(2);
  });
});

describe('the Aadhaar OTP pop-up', () => {
  it("opens when it is Aadhaar's turn, with 6 digits, a resend link and the number it was sent to", async () => {
    toStep2('A');
    const pop = await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(pop).toHaveAttribute('aria-modal', 'true');
    expect(within(pop).getByText(/ending 0011/)).toBeInTheDocument();
    expect(within(pop).getByRole('button', { name: 'Resend OTP' })).toBeInTheDocument();
    expect(within(row('Aadhaar')).getByText('OTP required')).toBeInTheDocument();
    expect(otpBox()).toHaveFocus();
  });

  it('only takes digits, at most 6, and Verify waits for all 6', async () => {
    toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.change(otpBox(), { target: { value: 'ab12 34' } });
    expect(otpBox()).toHaveValue('1234');
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeDisabled();
    fireEvent.change(otpBox(), { target: { value: '12345678' } });
    expect(otpBox()).toHaveValue('123456');
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeEnabled();
  });

  it('a wrong OTP shows an error and keeps the pop-up open', async () => {
    toStep2('A');
    await enterOtp('000000');
    expect(await screen.findByText('Wrong OTP. Check the code and try again.')).toBeInTheDocument();
    expect(otpBox()).toBeInvalid();
    expect(dialog()).toBeInTheDocument();
    expect(within(row('Aadhaar')).getByText('OTP required')).toBeInTheDocument();
  });

  it('after a wrong OTP the right one goes through', async () => {
    toStep2('A');
    await enterOtp('000000');
    await screen.findByText(/Wrong OTP/);
    fireEvent.change(otpBox(), { target: { value: '123456' } });
    verify();
    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    await screen.findByText(/^KYC result: /);
    expect(within(row('Aadhaar')).getByText('Verified')).toBeInTheDocument();
  });

  it('Resend OTP says a new OTP was sent, and clears an error', async () => {
    toStep2('A');
    await enterOtp('111111');
    await screen.findByText(/Wrong OTP/);
    fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));
    expect(screen.getByText('A new OTP has been sent.')).toBeInTheDocument();
    expect(screen.queryByText(/Wrong OTP/)).not.toBeInTheDocument();
  });

  it('shows the demo OTP for the presenter', async () => {
    toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(screen.getByText('Demo OTP: 123456')).toBeInTheDocument();
  });

  it('closing it leaves "OTP required" with a button to enter the OTP later', async () => {
    toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.click(otpCancel());
    expect(dialog()).not.toBeInTheDocument();
    expect(within(row('Aadhaar')).getByText('OTP required')).toBeInTheDocument();
    fireEvent.click(within(row('Aadhaar')).getByRole('button', { name: 'Enter OTP' }));
    await enterOtp();
    await screen.findByText(/^KYC result: Pass/);
  });

  it('Escape closes it', async () => {
    toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog()).not.toBeInTheDocument();
  });

  it('the code box starts empty each time it opens', async () => {
    toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.change(otpBox(), { target: { value: '1234' } });
    fireEvent.click(otpCancel());
    fireEvent.click(screen.getByRole('button', { name: 'Enter OTP' }));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(otpBox()).toHaveValue('');
  });

  it('keeps Tab inside the pop-up', async () => {
    toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    const buttons = within(screen.getByRole('dialog')).getAllByRole('button');
    buttons[buttons.length - 1].focus(); // last control is Verify OTP, which is disabled: use Cancel
    const cancel = otpCancel();
    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // from the last enabled control, Tab goes back to the first one inside the dialog
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});

describe('scenario A: clean pass', () => {
  it('everything verified, 100% name match: Pass, and Review and submit is enabled', async () => {
    await runToResult('A');
    for (const title of ['PAN', 'Aadhaar', 'GST']) {
      expect(within(row(title)).getByText('Verified')).toBeInTheDocument();
    }
    expect(screen.getByText('KYC result: Pass')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeEnabled();
    expect(screen.queryByLabelText(/KYC Exception Remark/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to edit' })).not.toBeInTheDocument();
  });

  it('stores the result fields of section 6.7 on the application', async () => {
    await runToResult('A');
    expect(state().draft).toMatchObject({
      panStatus: 'Verified',
      panNameAsPerSource: 'RAMESH PATIL',
      aadhaarStatus: 'Verified',
      gstStatus: 'Verified',
      gstLegalName: 'RAMESH PATIL',
      gstinStatus: 'Active',
      nameMatchPercent: 100,
      dateOfBirthMatch: 'Exact',
      kycOverallResult: 'Pass',
      kycCheckedOn: toISODate(new Date()),
      retryCount: 0,
      status: 'KYC Done',
    });
    expect(state().draft.aadhaarReference).toMatch(/^MOCK-AAD-\d{5}$/);
  });

  it('shows entered against as per source with a match mark for each', async () => {
    await runToResult('A');
    const table = screen.getByRole('table');
    const cells = (name: string) =>
      within(within(table).getByRole('rowheader', { name }).closest('tr') as HTMLElement)
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Detail', 'Entered', 'As per source', 'Match']);
    expect(cells('Name')).toEqual(['Ramesh Patil', 'RAMESH PATIL', '100% match']);
    expect(cells('Date of birth')).toEqual(['14/03/1984', '14/03/1984', 'Exact']);
    expect(cells('PAN status')).toEqual(['ABCPP1234F', 'Active', 'Verified']);
    expect(cells('GST legal name')).toEqual(['Ramesh Patil', 'RAMESH PATIL', 'Match']);
  });

  it('keeps the result when you leave and come back to the page', async () => {
    const first = await runToResult('A');
    first.unmount();
    renderPage();
    expect(screen.getByText('KYC result: Pass')).toBeInTheDocument();
    expect(dialog()).not.toBeInTheDocument();
  });
});

describe('scenario B: Exception', () => {
  it('86% is an Exception, GST is Not applicable, and the table shows the amber match', async () => {
    await runToResult('B');
    expect(screen.getByText('KYC result: Exception')).toBeInTheDocument();
    expect(screen.getByText('Name match is 86%, below 95%')).toBeInTheDocument();
    expect(within(row('GST')).getByText('Not applicable')).toBeInTheDocument();
    const nameRow = within(screen.getByRole('table'))
      .getByRole('rowheader', { name: 'Name' })
      .closest('tr')!;
    expect(within(nameRow as HTMLElement).getByText('86% match')).toHaveClass('text-warning');
    expect(within(nameRow as HTMLElement).getByText('ANITA R DESAI')).toBeInTheDocument();
    expect(state().draft).toMatchObject({
      kycOverallResult: 'Exception',
      nameMatchPercent: 86,
      panNameAsPerSource: 'ANITA R DESAI',
      gstStatus: 'Not applicable',
    });
  });

  it('asks for a remark, and Review and submit waits for it', async () => {
    await runToResult('B');
    const remark = screen.getByLabelText(/^KYC Exception Remark/);
    expect(remark).toBeRequired();
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeDisabled();

    fireEvent.change(remark, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeDisabled();

    fireEvent.change(remark, {
      target: { value: 'Middle initial is missing in the application.' },
    });
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeEnabled();
    expect(state().draft.kycExceptionRemark).toBe('Middle initial is missing in the application.');
  });

  it('shows an error when the remark box is left empty, and clears it when it is filled', async () => {
    await runToResult('B');
    const remark = screen.getByLabelText(/^KYC Exception Remark/);
    fireEvent.focus(remark);
    fireEvent.blur(remark);
    expect(screen.getByText('Enter a remark to continue')).toBeInTheDocument();
    expect(remark).toBeInvalid();
    fireEvent.change(remark, { target: { value: 'ok' } });
    expect(screen.queryByText('Enter a remark to continue')).not.toBeInTheDocument();
  });

  it('removing the remark disables the button again', async () => {
    await runToResult('B');
    const remark = screen.getByLabelText(/^KYC Exception Remark/);
    fireEvent.change(remark, { target: { value: 'ok' } });
    fireEvent.change(remark, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeDisabled();
  });
});

describe('scenario C: Fail', () => {
  it('PAN inactive: Fail, with the message and a Back to edit button', async () => {
    await runToResult('C');
    expect(screen.getByText('KYC result: Fail')).toBeInTheDocument();
    expect(screen.getByText('PAN is not found or is inactive')).toBeInTheDocument();
    expect(screen.getByText('Resolve the KYC result before submitting')).toBeInTheDocument();
    expect(within(row('PAN')).getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeDisabled();
    const panRow = within(screen.getByRole('table'))
      .getByRole('rowheader', { name: 'PAN status' })
      .closest('tr')!;
    expect(within(panRow as HTMLElement).getByText('Inactive')).toBeInTheDocument();
    expect(within(panRow as HTMLElement).getByText('Failed')).toHaveClass('text-error-text');
  });

  it('is not KYC Done: the application stays a Draft', async () => {
    await runToResult('C');
    expect(state().draft.kycOverallResult).toBe('Fail');
    expect(state().draft.status).toBe('Draft');
  });

  it('there is no remark box for a Fail', async () => {
    await runToResult('C');
    expect(screen.queryByLabelText(/KYC Exception Remark/)).not.toBeInTheDocument();
  });

  it('Back to edit goes to Step 1', async () => {
    await runToResult('C');
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(state().currentStep).toBe(1);
    expect(screen.getByLabelText(/^Full Name/)).toHaveValue('Kiran Naik');
  });

  it('correcting the PAN and coming back runs KYC again, and it can then pass', async () => {
    await runToResult('C');
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    fireEvent.change(screen.getByLabelText('PAN*'), { target: { value: 'ABCPK7777Q' } });
    expect(state().draft.kycOverallResult).toBe(''); // the old result was cleared
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    await enterOtp();
    await screen.findByText('KYC result: Pass');
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeEnabled();
  });
});

describe('an unavailable source is retried up to three times', () => {
  it('PAN times out once, is tried again, and then passes (retry count 1)', async () => {
    await runToResult('A', 'pan-once');
    expect(within(row('PAN')).getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('KYC result: Pass')).toBeInTheDocument();
    expect(state().draft.retryCount).toBe(1);
  });

  it('shows the retries while they happen', async () => {
    KYC_CONFIG.retryDelayMs = 300;
    toStep2('A', 'pan-once');
    expect(await screen.findByText(/Trying again \(1 of 3\)/)).toBeInTheDocument();
    expect(within(row('PAN')).getByText('Unavailable')).toBeInTheDocument();
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
  });

  it('PAN that stays down: Unavailable after 3 retries is an Exception, never a Fail', async () => {
    await runToResult('A', 'pan-down');
    expect(within(row('PAN')).getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/still not available after 3 retries/)).toBeInTheDocument();
    expect(screen.getByText('KYC result: Exception')).toBeInTheDocument();
    expect(screen.getByText('PAN source was unavailable after 3 retries')).toBeInTheDocument();
    expect(state().draft).toMatchObject({
      panStatus: 'Unavailable',
      kycOverallResult: 'Exception',
      retryCount: 3,
      nameMatchPercent: null,
    });
    expect(screen.queryByText(/KYC result: Fail/)).not.toBeInTheDocument();
  });

  it('an Exception from an outage still needs the remark, then can go on', async () => {
    await runToResult('A', 'pan-down');
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^KYC Exception Remark/), {
      target: { value: 'Income Tax portal was down.' },
    });
    expect(screen.getByRole('button', { name: 'Review and submit' })).toBeEnabled();
  });

  it('GST that stays down is an Exception too', async () => {
    await runToResult('A', 'gst-down');
    expect(within(row('GST')).getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('GST source was unavailable after 3 retries')).toBeInTheDocument();
    expect(state().draft.kycOverallResult).toBe('Exception');
    expect(state().draft.retryCount).toBe(3);
  });

  it('the comparison table says Unavailable when the source did not answer', async () => {
    await runToResult('A', 'pan-down');
    const panRow = within(screen.getByRole('table'))
      .getByRole('rowheader', { name: 'PAN status' })
      .closest('tr')!;
    expect(within(panRow as HTMLElement).getByText('Unavailable')).toBeInTheDocument();
  });
});

describe('changing identity fields after a result', () => {
  it('Date of birth, PAN, Aadhaar, GSTIN or name changes clear the result', async () => {
    await runToResult('A');
    expect(state().draft.kycOverallResult).toBe('Pass');
    act(() => state().updateDraft({ dateOfBirth: '1984-03-15' }));
    expect(state().draft).toMatchObject({
      kycOverallResult: '',
      panStatus: 'Pending',
      aadhaarStatus: 'Pending',
      gstStatus: 'Pending',
      nameMatchPercent: null,
      kycCheckedOn: '',
      retryCount: 0,
      status: 'Draft',
    });
  });

  it.each([
    ['pan', 'ABCPK7777Q'],
    ['aadhaar', 'XXXX XXXX 9999'],
    ['gstin', '29ABCPP1234F1Z6'],
    ['fullNameAsPerPan', 'Ramesh K Patil'],
  ] as const)('a change of %s clears it', async (key, value) => {
    await runToResult('A');
    act(() => state().updateDraft({ [key]: value }));
    expect(state().draft.kycOverallResult).toBe('');
  });

  it('other fields do not', async () => {
    await runToResult('A');
    act(() =>
      state().updateDraft({
        address: 'New address',
        mobile: '9999999999',
        loanAmountRequested: 1_700_000,
      }),
    );
    expect(state().draft.kycOverallResult).toBe('Pass');
  });

  it('a different Aadhaar number with the same last four digits clears it too', async () => {
    await runToResult('A');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
    const box = screen.getByLabelText('Aadhaar*');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: '200000084821' } });
    fireEvent.blur(box);
    // the record looks the same (only the last four digits are kept), but the check was for
    // another number, so it must be done again
    expect(state().draft.aadhaar).toBe('XXXX XXXX 4821');
    expect(state().draft.kycOverallResult).toBe('');
  });

  it('the same value written again does not', async () => {
    await runToResult('A');
    act(() => state().updateDraft({ pan: 'ABCPP1234F', dateOfBirth: '1984-03-14' }));
    expect(state().draft.kycOverallResult).toBe('Pass');
  });

  it('changing the date of birth on Step 1 and coming back runs KYC again, and finds the mismatch', async () => {
    await runToResult('A');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.change(screen.getByLabelText(/^Date of Birth/), { target: { value: '15/03/1984' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    await enterOtp();
    await screen.findByText('KYC result: Fail');
    expect(screen.getByText('Date of birth does not match the source')).toBeInTheDocument();
    const dob = within(screen.getByRole('table'))
      .getByRole('rowheader', { name: 'Date of birth' })
      .closest('tr')!;
    expect(within(dob as HTMLElement).getByText('Mismatch')).toBeInTheDocument();
    expect(within(dob as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('14/03/1984');
  });

  it('editing something else on Step 1 keeps the result: no second run', async () => {
    await runToResult('A');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Another address' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    expect(screen.getByText('KYC result: Pass')).toBeInTheDocument();
    expect(dialog()).not.toBeInTheDocument();
  });

  it('Re-run checks clears the result and runs everything again', async () => {
    await runToResult('A');
    fireEvent.click(screen.getByRole('button', { name: 'Re-run checks' }));
    expect(state().draft.kycOverallResult).toBe('');
    await enterOtp();
    await screen.findByText('KYC result: Pass');
  });

  it('a new result replaces a remark written for the old one', async () => {
    await runToResult('B');
    fireEvent.change(screen.getByLabelText(/^KYC Exception Remark/), {
      target: { value: 'old remark' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-run checks' }));
    expect(state().draft.kycExceptionRemark).toBe('');
  });
});

describe('leaving the step', () => {
  it('Back while the OTP pop-up is open stops the run, and coming back starts it again', async () => {
    toStep2('A');
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    fireEvent.click(otpCancel());
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(state().currentStep).toBe(1);
    expect(dialog()).not.toBeInTheDocument();
    expect(state().draft.kycOverallResult).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
  });

  it('Back while the PAN check runs leaves nothing half done', async () => {
    KYC_CONFIG.panDelayMs = 100;
    toStep2('A');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await new Promise((r) => setTimeout(r, 250));
    expect(state().draft.kycOverallResult).toBe('');
    expect(state().draft.panStatus).toBe('Pending');
    expect(dialog()).not.toBeInTheDocument();
  });
});

describe('Aadhaar stays masked on this screen', () => {
  it('never shows the number in the page, in any state of Step 2', async () => {
    toStep2('A');
    expect(document.body.textContent).not.toMatch(FULL_AADHAAR);
    await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
    expect(document.body.textContent).not.toMatch(FULL_AADHAAR);
    expect(within(row('Aadhaar')).getByText(/XXXX XXXX 4821/)).toBeInTheDocument();
    fireEvent.change(otpBox(), { target: { value: '123456' } });
    verify();
    await screen.findByText(/^KYC result: /);
    expect(document.body.textContent).not.toMatch(FULL_AADHAAR);
    expect(document.body.innerHTML).not.toContain('234500074821');
  });

  it('is masked for B and C as well', async () => {
    await runToResult('B');
    expect(within(row('Aadhaar')).getByText(/XXXX XXXX 7733/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(FULL_AADHAAR);
  });

  it('the store and localStorage hold no full number after KYC', async () => {
    await runToResult('A');
    expect(JSON.stringify(state())).not.toMatch(FULL_AADHAAR);
    expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(FULL_AADHAAR);
  });
});
