import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { SCENARIOS, SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import { ApplicationStatus, type DemoUserId } from '@/data/types';
import { MESSAGES } from '@/features/home-loan/validation/rules';
import RecordSheet from './RecordSheet';
import { DEFAULT_SHEET_TAB, type SheetTabId } from './recordSheetModel';

/** A toast by its words: an Application ID in it is in a span of its own, so it is not one text node. */
const toastText = (text: string) =>
  screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(text));

const state = () => useAppStore.getState();
const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ] = SEED_APPLICATIONS;
const FULL_AADHAAR = /\d{4}\s?\d{4}\s?\d{4}/;

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function Harness({
  applicationId,
  onClose = () => {},
}: {
  applicationId: string;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<SheetTabId>(DEFAULT_SHEET_TAB);
  return (
    <MemoryRouter>
      <ToastProvider>
        <button type="button">Behind the sheet</button>
        <Probe />
        <RecordSheet
          applicationId={applicationId}
          tab={tab}
          onTabChange={setTab}
          onClose={onClose}
        />
      </ToastProvider>
    </MemoryRouter>
  );
}

const draw = (applicationId: string, user: DemoUserId = 'priya', onClose?: () => void) => {
  act(() => state().setCurrentUser(user));
  return render(<Harness applicationId={applicationId} onClose={onClose} />);
};

const sheet = () => screen.getByRole('dialog', { name: /, record$/ });
const header = () => within(sheet()).getByRole('banner');
const tab = (name: string) => within(sheet()).getByRole('tab', { name: new RegExp(`^${name}`) });
const goTo = (name: string) => fireEvent.click(tab(name));
const startEdit = () => fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
const save = () => fireEvent.click(within(header()).getByRole('button', { name: 'Save changes' }));
const cancel = () => fireEvent.click(within(header()).getByRole('button', { name: 'Cancel' }));
const label = (text: string) => new RegExp(`^${text.replace(/[()]/g, '\\$&')}\\*?$`);
const input = (text: string) => within(sheet()).getByLabelText(label(text)) as HTMLInputElement;
const typeInto = (text: string, value: string) => {
  const el = input(text);
  fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
};
const stored = (id: string) => state().applications.find((a) => a.applicationId === id)!;
const eventsOf = (id: string) => state().auditEvents.filter((e) => e.applicationId === id);

/** A draft of the loan officer: scenario A, saved. Its consent is not given yet. */
function makeDraft() {
  state().fillScenario('A');
  state().saveApplication({ ...state().draft, status: ApplicationStatus.Draft });
  return state().draft.applicationId;
}

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the Edit button', () => {
  it('is on for the loan officer who owns a Draft or a Returned record, and for the administrator', () => {
    const draft = makeDraft();
    const { unmount } = draw(draft);
    expect(within(header()).getByRole('button', { name: 'Edit' })).not.toHaveAttribute(
      'aria-disabled',
    );
    unmount();
    const returned = draw(SAVITA.applicationId);
    expect(within(header()).getByRole('button', { name: 'Edit' })).not.toHaveAttribute(
      'aria-disabled',
    );
    returned.unmount();
    draw(SAVITA.applicationId, 'admin');
    expect(within(header()).getByRole('button', { name: 'Edit' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('is on for the administrator on an approved record, and off for everybody else, with the reason', () => {
    const { unmount } = draw(VIJAY.applicationId, 'admin');
    expect(within(header()).getByRole('button', { name: 'Edit' })).not.toHaveAttribute(
      'aria-disabled',
    );
    unmount();
    draw(VIJAY.applicationId, 'priya');
    const button = within(header()).getByRole('button', { name: 'Edit' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(header()).getByText('Only the administrator can edit an approved record'),
    ).toBeInTheDocument();
  });

  it.each([
    ['In Level 1', MANJUNATH, 'Locked while in approval'],
    ['In Level 2', SHOBHA, 'Locked while in approval'],
    ['Rejected', BASAVARAJ, 'Rejected records cannot be edited'],
  ])(
    'is off for a record that is %s, with the tip "%s", even for the administrator',
    (_name, app, tip) => {
      draw(app.applicationId, 'admin');
      expect(within(header()).getByRole('button', { name: 'Edit' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(within(header()).getByText(tip)).toBeInTheDocument();
    },
  );

  it('is off for an approver and for another loan officer on a Draft', () => {
    draw(SAVITA.applicationId, 'mahesh');
    expect(within(header()).getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      within(header()).getByText(
        'Only the loan officer who owns this record, or the administrator, can edit it',
      ),
    ).toBeInTheDocument();
  });

  it('does nothing when it is off', () => {
    draw(MANJUNATH.applicationId, 'admin');
    fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
    expect(within(header()).queryByRole('button', { name: 'Save changes' })).toBeNull();
  });
});

describe('edit mode', () => {
  it('replaces Edit with Cancel and Save changes, and keeps View workflow and Close', () => {
    draw(SAVITA.applicationId);
    startEdit();
    expect(within(header()).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(header()).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(within(header()).getByRole('link', { name: 'View workflow' })).toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: 'Close record' })).toBeInTheDocument();
  });

  it('turns the fields into inputs of the form, with their labels above them', () => {
    draw(SAVITA.applicationId);
    startEdit();
    expect(input('Loan Amount Requested').value).toBe('8,00,000');
    expect(input('Tenure (months)').value).toBe('96');
    expect(within(sheet()).getByRole('combobox', { name: label('Branch') })).toHaveValue(
      'Belagavi Main Branch (demo)',
    );
    goTo('Applicant');
    expect(input('Full Name (as per PAN)').value).toBe('Savita Patil');
    expect(input('Mobile').value).toBe(SAVITA.mobile);
    expect((within(sheet()).getByLabelText(label('Address')) as HTMLTextAreaElement).tagName).toBe(
      'TEXTAREA',
    );
    expect(input('Date of Birth').value).toBe('12/04/1975');
    // the label comes before the control, in the page
    const mobile = input('Mobile');
    const labelOfMobile = within(sheet()).getByText(/^Mobile$/);
    expect(
      labelOfMobile.compareDocumentPosition(mobile) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows the toggle of the co-applicant as a switch', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Sureties');
    expect(within(sheet()).getByRole('switch', { name: 'Add a co-applicant' })).toBeInTheDocument();
  });

  it('shows the locked fields with a padlock hint, and as no input', () => {
    draw(SAVITA.applicationId);
    startEdit();
    for (const [name, hint] of [
      ['Application ID', 'Set by the system'],
      ['Loan Product', 'Set by the system'],
      ['Application Date', 'Set by the system'],
    ] as const) {
      expect(within(sheet()).queryByLabelText(label(name))).toBeNull();
      const row = within(sheet()).getByText(name, { selector: 'span' }).parentElement!;
      expect(within(row).getByText(hint)).toBeInTheDocument();
    }
    goTo('Property');
    const eligible = within(sheet()).getByText('Eligible Amount', {
      selector: 'span',
    }).parentElement!;
    expect(within(eligible).getByText('Worked out from the other fields')).toBeInTheDocument();
    goTo('Identity');
    const time = within(sheet()).getByText('Consent Time', { selector: 'span' }).parentElement!;
    expect(within(time).getByText('Set by the system')).toBeInTheDocument();
  });

  it('shows the KYC and Approval tabs locked as a whole', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('KYC');
    // no input in the tab itself (the search box is in the header and the comment box in the side panel)
    expect(within(within(sheet()).getByRole('tabpanel')).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(sheet()).getAllByText('Set by the KYC checks').length).toBeGreaterThan(5);
    goTo('Approval');
    expect(within(sheet()).getAllByText('Set by the approvers').length).toBeGreaterThan(5);
    expect(within(sheet()).getByText('Level 1 Remarks', { selector: 'span' })).toBeInTheDocument();
  });

  it('keeps the banner of the status, and the search box filters the inputs', () => {
    draw(SAVITA.applicationId);
    startEdit();
    expect(
      within(sheet()).getByText(/Returned for correction by Mahesh Joshi/),
    ).toBeInTheDocument();
    fireEvent.change(
      within(header()).getByRole('textbox', { name: 'Search the fields of this tab' }),
      {
        target: { value: 'tenure' },
      },
    );
    expect(within(sheet()).getByLabelText(label('Tenure (months)'))).toBeInTheDocument();
    expect(within(sheet()).queryByLabelText(label('Loan Amount Requested'))).toBeNull();
  });

  it('puts the cursor in the fields when editing starts, and on Edit when it ends', () => {
    draw(SAVITA.applicationId);
    startEdit();
    expect(within(sheet()).getByRole('tabpanel')).toHaveFocus();
    cancel();
    expect(within(header()).getByRole('button', { name: 'Edit' })).toHaveFocus();
  });
});

describe('the working copy', () => {
  it('keeps what is typed while the tabs are switched, and does not touch the record until it is saved', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    goTo('Property');
    goTo('Applicant');
    expect(input('Mobile').value).toBe('9000000001');
    expect(stored(SAVITA.applicationId).mobile).toBe(SAVITA.mobile);
    // and it is in the fields on a tab that was not open when it was typed
    goTo('Application');
    typeInto('Loan Amount Requested', '700000');
    goTo('Applicant');
    goTo('Application');
    expect(input('Loan Amount Requested').value).toBe('7,00,000');
  });

  it('works out the Eligible Amount live', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Property');
    const eligible = () =>
      within(within(sheet()).getByText('Eligible Amount', { selector: 'span' }).parentElement!);
    expect(eligible().getByText('₹ 9,00,000')).toBeInTheDocument(); // 75% of 12,00,000
    typeInto('Estimated Cost', '2000000');
    expect(eligible().getByText('₹ 15,00,000')).toBeInTheDocument();
    expect(stored(SAVITA.applicationId).eligibleAmount).toBe(900_000); // not saved yet
  });

  it('keeps Edit locked for a record in approval, even for the administrator', () => {
    draw(SHOBHA.applicationId, 'admin');
    expect(within(header()).getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('shows the GSTIN of a Business applicant and removes it when the Occupation is changed', () => {
    act(() =>
      useAppStore.setState({
        applications: state().applications.map((a) =>
          a.applicationId === SAVITA.applicationId
            ? { ...a, occupation: 'Business' as const, gstin: '29ABCPT5504R1Z6' }
            : a,
        ),
      }),
    );
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    expect(input('GSTIN').value).toBe('29ABCPT5504R1Z6');
    goTo('Applicant');
    fireEvent.change(within(sheet()).getByRole('combobox', { name: label('Occupation') }), {
      target: { value: 'Salaried' },
    });
    goTo('Identity');
    expect(within(sheet()).queryByLabelText(label('GSTIN'))).toBeNull();
  });

  it('shows the name and relation of the co-applicant when the switch is turned on', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Sureties');
    expect(within(sheet()).queryByLabelText(label('Co-applicant Name'))).toBeNull();
    fireEvent.click(within(sheet()).getByRole('switch', { name: 'Add a co-applicant' }));
    expect(input('Co-applicant Name')).toBeInTheDocument();
    expect(within(sheet()).getByRole('combobox', { name: label('Relation') })).toBeInTheDocument();
  });

  it('shows errors as a field is left, with the messages of the form, and clears them when it is fixed', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    expect(within(sheet()).queryByText('Enter Email')).toBeNull(); // not before the field is left
    typeInto('Email', '');
    expect(within(sheet()).getByText('Enter Email')).toBeInTheDocument();
    typeInto('Mobile', '123');
    expect(within(sheet()).getByText('Enter a valid mobile number')).toBeInTheDocument();
    typeInto('Email', 'savita@example.com');
    expect(within(sheet()).queryByText('Enter Email')).toBeNull();
  });

  it('gives an input an error that it is described by, as the form does', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Email', '');
    const email = input('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(within(sheet()).getByText('Enter Email')).toHaveAttribute('id', 'field-email-message');
    expect(email.getAttribute('aria-describedby')).toBe('field-email-message');
  });
});

describe('Cancel', () => {
  it('leaves edit mode at once when nothing was changed', () => {
    draw(SAVITA.applicationId);
    startEdit();
    cancel();
    expect(within(header()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Discard your changes?' })).toBeNull();
  });

  it('asks first when there are changes: Keep editing goes back, with the changes', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    cancel();
    const dialog = screen.getByRole('dialog', { name: 'Discard your changes?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog', { name: 'Discard your changes?' })).toBeNull();
    expect(input('Mobile').value).toBe('9000000001');
  });

  it('Discard changes leaves edit mode and the record is as it was', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    cancel();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(within(header()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(
      within(sheet()).getByText('Mobile', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent(SAVITA.mobile);
    expect(stored(SAVITA.applicationId).mobile).toBe(SAVITA.mobile);
    // a new edit starts from the record again
    startEdit();
    expect(input('Mobile').value).toBe(SAVITA.mobile);
  });

  it('is asked for by Escape and by the close button too, and Discard then closes the sheet', () => {
    const onClose = vi.fn();
    draw(SAVITA.applicationId, 'priya', onClose);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Escape in the question is "Keep editing"
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Discard your changes?' })).toBeNull();
    fireEvent.click(within(header()).getByRole('button', { name: 'Close record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sheet at once, when nothing was changed in edit mode', () => {
    const onClose = vi.fn();
    draw(SAVITA.applicationId, 'priya', onClose);
    startEdit();
    fireEvent.click(within(header()).getByRole('button', { name: 'Close record' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('after Keep editing, the sheet is not closed by a later Discard of Cancel', () => {
    const onClose = vi.fn();
    draw(SAVITA.applicationId, 'priya', onClose);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    fireEvent.click(within(header()).getByRole('button', { name: 'Close record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    cancel();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('the Aadhaar', () => {
  it('is shown as it is kept, masked, with a Change Aadhaar button, and no number is in the page', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    expect(within(sheet()).getByText('XXXX XXXX 7781')).toBeInTheDocument();
    expect(within(sheet()).getByRole('button', { name: 'Change Aadhaar' })).toBeInTheDocument();
    expect(within(sheet()).queryByRole('textbox', { name: label('Aadhaar') })).toBeNull(); // no input yet
    expect(document.body.innerHTML).not.toMatch(FULL_AADHAAR);
  });

  it('turns into an empty input of the form when Change Aadhaar is pressed', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Change Aadhaar' }));
    expect(within(sheet()).queryByRole('button', { name: 'Change Aadhaar' })).toBeNull();
    expect(input('Aadhaar').value).toBe('');
    expect(input('Aadhaar')).toHaveAttribute('placeholder', '0000 0000 0000');
  });

  it('shows the number as it is typed, and masked once the field is left', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Change Aadhaar' }));
    const aadhaar = input('Aadhaar');
    fireEvent.focus(aadhaar);
    fireEvent.change(aadhaar, { target: { value: '234500074821' } });
    expect(aadhaar.value).toBe('2345 0007 4821'); // grouped while it has the cursor
    fireEvent.blur(aadhaar);
    expect(aadhaar.value).toBe('XXXX XXXX 4821');
    expect(document.body.innerHTML).not.toMatch(/2345\s?0007\s?4821/);
  });

  it('does not put the number of the active scenario in the input', () => {
    // scenario A is the one that is active in the form, and its masked number is the record's own
    state().fillScenario('A');
    const mask = state().draft.aadhaar;
    state().saveApplication({ ...state().draft, status: ApplicationStatus.Draft });
    const id = state().draft.applicationId;
    draw(id);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Change Aadhaar' }));
    // type the scenario's own number, leave, and come back to the field
    const number = SCENARIOS.A.aadhaarInput;
    fireEvent.focus(input('Aadhaar'));
    fireEvent.change(input('Aadhaar'), { target: { value: number } });
    fireEvent.blur(input('Aadhaar'));
    expect(input('Aadhaar').value).toBe(mask);
    goTo('Property');
    goTo('Identity');
    fireEvent.focus(input('Aadhaar'));
    expect(input('Aadhaar').value).not.toContain(number.replace(/\s/g, '').slice(0, 4) + ' ');
    expect(input('Aadhaar').value).toBe('');
    expect(document.body.innerHTML).not.toContain(number);
  });

  it('asks for an Aadhaar when it was cleared and nothing was typed', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Change Aadhaar' }));
    save();
    expect(within(sheet()).getByText(/The changes were not saved/)).toBeInTheDocument();
    expect(within(sheet()).getAllByText(/Aadhaar/).length).toBeGreaterThan(0);
  });
});

describe('Save with errors', () => {
  const breakTwoTabs = () => {
    goTo('Applicant');
    typeInto('Email', '');
    typeInto('Mobile', '123');
    goTo('Sureties');
    typeInto('Surety 1 Name', '');
    goTo('Application');
  };

  it('writes nothing, shows an error banner under the tabs, and marks the tabs that have errors', () => {
    draw(SAVITA.applicationId);
    startEdit();
    breakTwoTabs();
    save();
    const banner = within(sheet()).getByText('The changes were not saved').closest('[role=alert]')!;
    expect(banner).toHaveTextContent('3 fields need attention: Applicant (2), Sureties (1)');
    expect(within(sheet()).getByTestId('tab-alert-applicant')).toBeInTheDocument();
    expect(within(sheet()).getByTestId('tab-alert-sureties')).toBeInTheDocument();
    expect(within(sheet()).queryByTestId('tab-alert-application')).toBeNull();
    // for a screen reader, too
    expect(within(tab('Applicant')).getByText(', has errors')).toBeInTheDocument();
    expect(eventsOf(SAVITA.applicationId).some((e) => e.event === 'Field changed')).toBe(false);
    expect(stored(SAVITA.applicationId).mobile).toBe(SAVITA.mobile);
  });

  it('goes to the first tab with an error and puts the cursor in the first invalid field', () => {
    draw(SAVITA.applicationId);
    startEdit();
    breakTwoTabs();
    expect(tab('Application')).toHaveAttribute('aria-selected', 'true');
    save();
    expect(tab('Applicant')).toHaveAttribute('aria-selected', 'true');
    expect(input('Mobile')).toHaveFocus(); // Mobile comes before Email in the form
  });

  it('shows the errors of every tab, also those of fields that were never left', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('checkbox'));
    goTo('Applicant');
    save();
    goTo('Identity');
    expect(within(sheet()).getByText('Tick the consent to continue')).toBeInTheDocument();
  });

  it('lets the record be saved once the errors are fixed, and the dots and the banner go', () => {
    draw(SAVITA.applicationId);
    startEdit();
    breakTwoTabs();
    save();
    typeInto('Mobile', '9000000001');
    typeInto('Email', 'savita@example.com');
    goTo('Sureties');
    typeInto('Surety 1 Name', 'Dattatray Patil');
    expect(within(sheet()).queryByTestId('tab-alert-applicant')).toBeNull();
    expect(within(sheet()).queryByTestId('tab-alert-sureties')).toBeNull();
    save();
    expect(within(header()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(stored(SAVITA.applicationId).mobile).toBe('9000000001');
  });

  it('asks for the Loan Purpose, which is required, and for the GSTIN of a Business applicant', () => {
    act(() =>
      useAppStore.setState({
        applications: state().applications.map((a) =>
          a.applicationId === SAVITA.applicationId
            ? { ...a, loanPurpose: '' as const, occupation: 'Business' as const, gstin: '' }
            : a,
        ),
      }),
    );
    draw(SAVITA.applicationId);
    startEdit();
    save();
    expect(within(sheet()).getByText('The changes were not saved')).toBeInTheDocument();
    expect(within(sheet()).getByText('Select Loan Purpose')).toBeInTheDocument();
    goTo('Identity');
    expect(within(sheet()).getByText('Enter GSTIN')).toBeInTheDocument();
    expect(eventsOf(SAVITA.applicationId).some((e) => e.event === 'Field changed')).toBe(false);
  });

  it("flags a PAN that another application has, and not the record's own", () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', VIJAY.pan);
    save();
    expect(within(sheet()).getByText(/already|another/i)).toBeInTheDocument();
    expect(stored(SAVITA.applicationId).pan).toBe(SAVITA.pan);
    typeInto('PAN', SAVITA.pan); // its own PAN, which the list also holds with this record's ID
    save();
    expect(within(sheet()).queryByText(/already|another/i)).toBeNull();
  });
});

describe('Save', () => {
  it('writes the record, one audit event for each changed field, and a toast', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    typeInto('Monthly Income', '65000');
    save();
    const saved = stored(SAVITA.applicationId);
    expect(saved.mobile).toBe('9000000001');
    expect(saved.monthlyIncome).toBe(65000);
    expect(saved.status).toBe(ApplicationStatus.Returned);
    const added = eventsOf(SAVITA.applicationId).filter((e) => e.event === 'Field changed');
    expect(added.map((e) => `${e.field}: ${e.oldValue} -> ${e.newValue}`)).toEqual([
      `Mobile: ${SAVITA.mobile} -> 9000000001`,
      `Monthly Income: ${SAVITA.monthlyIncome === null ? '' : '₹ ' + SAVITA.monthlyIncome.toLocaleString('en-IN')} -> ₹ 65,000`,
    ]);
    expect(added.every((e) => e.user === 'Priya Kulkarni' && Date.parse(e.at) > 0)).toBe(true);
    expect(screen.getByText('Changes saved: 2 fields updated')).toBeInTheDocument();
  });

  it('leaves edit mode and shows the saved values', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    expect(within(header()).queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(
      within(sheet()).getByText('Mobile', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('9000000001');
  });

  it('says so when nothing changed, and writes nothing', () => {
    draw(SAVITA.applicationId);
    startEdit();
    save();
    expect(screen.getByText('No changes to save')).toBeInTheDocument();
    expect(eventsOf(SAVITA.applicationId).some((e) => e.event === 'Field changed')).toBe(false);
  });

  it('works out the Eligible Amount into the record', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Property');
    typeInto('Estimated Cost', '2000000');
    save();
    expect(stored(SAVITA.applicationId).eligibleAmount).toBe(1_500_000);
    const labels = eventsOf(SAVITA.applicationId)
      .filter((e) => e.event === 'Field changed')
      .map((e) => e.field);
    expect(labels).toEqual(['Estimated Cost', 'Eligible Amount']);
  });

  it('does not change another record, the instance, or the status', () => {
    const before = JSON.stringify(state().workflowInstances);
    const others = JSON.stringify(
      state().applications.filter((a) => a.applicationId !== SAVITA.applicationId),
    );
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    expect(JSON.stringify(state().workflowInstances)).toBe(before);
    expect(
      JSON.stringify(state().applications.filter((a) => a.applicationId !== SAVITA.applicationId)),
    ).toBe(others);
  });

  it('writes no Aadhaar number to the record, the trail or the storage', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Address', 'Plot 12, 2345 6789 0123, Belagavi');
    save();
    expect(stored(SAVITA.applicationId).address).toBe('Plot 12, XXXX XXXX 0123, Belagavi');
    expect(JSON.stringify(eventsOf(SAVITA.applicationId))).not.toMatch(FULL_AADHAAR);
    expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(FULL_AADHAAR);
  });

  it('says why, in the sheet, when the store refuses (the user was changed while editing)', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    act(() => state().setCurrentUser('mahesh'));
    save();
    const banner = within(sheet())
      .getAllByText('The changes were not saved')[0]
      .closest('[role=alert]')!;
    expect(banner).toHaveTextContent('Only the loan officer who owns this record');
    expect(stored(SAVITA.applicationId).mobile).toBe(SAVITA.mobile);
  });
});

describe('an identity change', () => {
  const run = async (otp = '123456') => {
    const box = await screen.findByLabelText(/^OTP sent to the mobile number/);
    fireEvent.change(box, { target: { value: otp } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
  };
  const dialog = () => screen.getByRole('dialog', { name: 'KYC checks' });

  it('runs the checks in a dialog before saving, and does not save while it is open', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).getByText('PAN ABCPT5505R')).toBeInTheDocument();
    expect(stored(SAVITA.applicationId).pan).toBe(SAVITA.pan);
    await run();
    await waitFor(() => expect(within(dialog()).getByText('KYC result: Pass')).toBeInTheDocument());
    expect(stored(SAVITA.applicationId).pan).toBe(SAVITA.pan); // still not saved: the person goes on
  });

  it('saves after Continue, with the new result and the KYC events in the trail', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    await run();
    await waitFor(() => screen.getByText('KYC result: Pass'));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog', { name: 'KYC checks' })).toBeNull();
    const saved = stored(SAVITA.applicationId);
    expect(saved.pan).toBe('ABCPT5505R');
    expect(saved.kycOverallResult).toBe('Pass');
    expect(saved.panStatus).toBe('Verified');
    expect(saved.status).toBe(ApplicationStatus.Returned);
    const added = eventsOf(SAVITA.applicationId)
      .map((e) => `${e.event}:${e.field}`)
      .slice(-4);
    expect(added).toEqual([
      'Field changed:PAN',
      'KYC check run:PAN',
      'KYC check run:Aadhaar',
      'KYC result set:KYC Overall Result',
    ]);
    expect(screen.getByText('Changes saved: 1 field updated')).toBeInTheDocument();
  });

  it('does not run the checks for a field they do not look at', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    expect(screen.queryByRole('dialog', { name: 'KYC checks' })).toBeNull(); // saved at once
    expect(stored(SAVITA.applicationId).mobile).toBe('9000000001');
  });

  it('runs them for a changed name (the owner of the property has to follow)', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Full Name (as per PAN)', 'Savita R Patil');
    goTo('Property');
    typeInto('Property Owner Name', 'Savita R Patil');
    save();
    expect(dialog()).toBeInTheDocument();
  });

  it('the name of the applicant has to be the owner of the property, as in the form', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Full Name (as per PAN)', 'Savita R Patil');
    save();
    expect(screen.queryByRole('dialog', { name: 'KYC checks' })).toBeNull();
    expect(tab('Property')).toHaveAttribute('aria-selected', 'true');
    expect(
      within(sheet()).getByText("Property must be in the applicant's name"),
    ).toBeInTheDocument();
  });

  it('runs them for a changed date of birth', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Date of Birth', '13/04/1975');
    save();
    expect(dialog()).toBeInTheDocument();
  });

  it('checks again for an Aadhaar that was typed, even one that ends in the same digits as the one in the record', async () => {
    // a draft of scenario A: its record holds the mask of the number of the scenario
    state().fillScenario('A');
    state().saveApplication({ ...state().draft, status: ApplicationStatus.Draft });
    const id = state().draft.applicationId;
    draw(id);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Change Aadhaar' }));
    const aadhaar = input('Aadhaar');
    fireEvent.focus(aadhaar);
    fireEvent.change(aadhaar, { target: { value: SCENARIOS.A.aadhaarInput } });
    fireEvent.blur(aadhaar);
    expect(aadhaar.value).toBe(stored(id).aadhaar); // the same mask: the record does not look changed
    fireEvent.click(within(sheet()).getByRole('checkbox')); // the consent, which the draft still needs
    save();
    expect(dialog()).toBeInTheDocument();
    await run();
    await waitFor(() => screen.getByText('KYC result: Pass'));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    expect(eventsOf(id).some((e) => e.field === 'Aadhaar' && e.newValue === 'changed')).toBe(true);
    expect(JSON.stringify(state())).not.toContain(SCENARIOS.A.aadhaarInput.replace(/\s/g, ''));
  });

  it('blocks the save on a Fail, goes back to edit mode and gives the reasons', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', SCENARIOS.C.application.pan!); // inactive
    save();
    await run();
    await waitFor(() => screen.getByText('KYC result: Fail'));
    expect(within(dialog()).queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(within(dialog()).getByText('PAN is not found or is inactive')).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Back to edit' }));
    expect(screen.queryByRole('dialog', { name: 'KYC checks' })).toBeNull();
    expect(within(header()).getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    const banner = within(sheet())
      .getByText(/KYC result: Fail. The changes were not saved/)
      .closest('[role=alert]')!;
    expect(banner).toHaveTextContent('PAN is not found or is inactive');
    expect(stored(SAVITA.applicationId).pan).toBe(SAVITA.pan);
    expect(eventsOf(SAVITA.applicationId).some((e) => e.event === 'Field changed')).toBe(false);
    // typing again clears the banner
    typeInto('PAN', 'ABCPT5505R');
    expect(within(sheet()).queryByText(/KYC result: Fail. The changes were not saved/)).toBeNull();
  });

  it('needs a remark for an Exception, and saves it with the record', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    state().setKycOutage('pan-down'); // the PAN source does not answer: an Exception
    save();
    await run();
    await waitFor(() => screen.getByText('KYC result: Exception'));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    expect(within(dialog()).getByText('Enter a remark to continue')).toBeInTheDocument();
    expect(stored(SAVITA.applicationId).pan).toBe(SAVITA.pan);
    fireEvent.change(within(dialog()).getByLabelText(/KYC Exception Remark/), {
      target: { value: 'Same person: the middle initial is missing' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    const saved = stored(SAVITA.applicationId);
    expect(saved.kycOverallResult).toBe('Exception');
    expect(saved.kycExceptionRemark).toBe('Same person: the middle initial is missing');
    const result = eventsOf(SAVITA.applicationId)
      .filter((e) => e.event === 'KYC result set')
      .at(-1)!;
    expect(result.comment).toBe('Same person: the middle initial is missing');
  });

  it('turns down a wrong OTP, and takes the right one', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    await run('000000');
    expect(await screen.findByText('Wrong OTP. Check the code and try again.')).toBeInTheDocument();
    await run('123456');
    await waitFor(() => screen.getByText('KYC result: Pass'));
  });

  it('goes back to editing when the dialog is cancelled, and nothing is saved', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'KYC checks' })).toBeNull();
    expect(within(header()).getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(stored(SAVITA.applicationId).pan).toBe(SAVITA.pan);
    expect(input('PAN').value).toBe('ABCPT5505R'); // what was typed is still there
  });

  it('does not ask for the Aadhaar number: only the OTP', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    await screen.findByLabelText(/^OTP sent to the mobile number ending/);
    expect(dialog().innerHTML).not.toMatch(FULL_AADHAAR);
    expect(within(dialog()).queryByLabelText(/^Aadhaar$/)).toBeNull();
  });

  it('keeps the keys of the dialog: Escape cancels the checks, and the sheet under it stays', async () => {
    const onClose = vi.fn();
    draw(SAVITA.applicationId, 'priya', onClose);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'KYC checks' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(within(header()).getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });
});

describe('a draft', () => {
  it('can be edited and saved: the record and the list copy follow, the status is kept', () => {
    const id = makeDraft();
    draw(id);
    startEdit();
    goTo('Applicant');
    typeInto('Monthly Income', '95000');
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('checkbox')); // the consent
    save();
    const saved = stored(id);
    expect(saved.monthlyIncome).toBe(95000);
    expect(saved.consentGiven).toBe(true);
    expect(saved.consentTime).not.toBe('');
    expect(saved.status).toBe(ApplicationStatus.Draft);
    expect(within(header()).getByText('Draft')).toBeInTheDocument();
  });

  it('is invalid when it has no consent: the Identity tab is marked and opened', () => {
    const id = makeDraft();
    draw(id);
    startEdit();
    save();
    expect(tab('Identity')).toHaveAttribute('aria-selected', 'true');
    expect(within(sheet()).getByText('Tick the consent to continue')).toBeInTheDocument();
  });

  it('follows into the form, which loads its inputs again', () => {
    const id = makeDraft();
    const before = state().draftResetCount;
    draw(id);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000009');
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('checkbox'));
    save();
    expect(state().draft.mobile).toBe('9000000009');
    expect(state().draftResetCount).toBe(before + 1);
  });
});

describe('an approved record, edited by the administrator', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Reason for change' });

  const editMobile = () => {
    draw(VIJAY.applicationId, 'admin');
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
  };

  it('asks the reason for the change before saving, and does not save while it is open', () => {
    editMobile();
    expect(dialog()).toBeInTheDocument();
    expect(stored(VIJAY.applicationId).mobile).toBe(VIJAY.mobile);
  });

  it('will not save without a reason', () => {
    editMobile();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }));
    expect(within(dialog()).getByText('Enter the reason for the change')).toBeInTheDocument();
    fireEvent.change(within(dialog()).getByLabelText(/^Reason for change/), {
      target: { value: '   ' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('dialog', { name: 'Reason for change' })).toBeInTheDocument();
    expect(stored(VIJAY.applicationId).mobile).toBe(VIJAY.mobile);
  });

  it('saves with the reason, in the record, the master record and each event of the trail', () => {
    state().saveApplication(VIJAY);
    act(() => useAppStore.setState({ masterRecords: [stored(VIJAY.applicationId)] }));
    editMobile();
    fireEvent.change(within(dialog()).getByLabelText(/^Reason for change/), {
      target: { value: '  The applicant gave a new number  ' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }));
    expect(stored(VIJAY.applicationId).mobile).toBe('9000000001');
    expect(state().masterRecords[0].mobile).toBe('9000000001');
    const event = eventsOf(VIJAY.applicationId)
      .filter((e) => e.event === 'Field changed')
      .at(-1)!;
    expect(event).toMatchObject({
      user: 'Admin',
      field: 'Mobile',
      newValue: '9000000001',
      comment: 'The applicant gave a new number',
    });
    expect(stored(VIJAY.applicationId).status).toBe(ApplicationStatus.Approved);
    expect(screen.getByText('Changes saved: 1 field updated')).toBeInTheDocument();
  });

  it('keeps the approval and the sanction as they were', () => {
    editMobile();
    fireEvent.change(within(dialog()).getByLabelText(/^Reason for change/), {
      target: { value: 'Typo' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }));
    expect(stored(VIJAY.applicationId)).toMatchObject({
      level1Decision: 'Approved',
      level2Decision: 'Approved',
      sanctionedAmount: VIJAY.sanctionedAmount,
    });
  });

  it('goes back to editing when the reason is cancelled', () => {
    editMobile();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Reason for change' })).toBeNull();
    expect(within(header()).getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(input('Mobile').value).toBe('9000000001');
  });

  it('asks the reason after the checks when an identity field was changed too', async () => {
    draw(VIJAY.applicationId, 'admin');
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPK2102L');
    save();
    const box = await screen.findByLabelText(/^OTP sent to the mobile number/);
    fireEvent.change(box, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await waitFor(() => screen.getByText('KYC result: Pass'));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'KYC checks' })).getByRole('button', {
        name: 'Continue',
      }),
    );
    expect(dialog()).toBeInTheDocument();
    fireEvent.change(within(dialog()).getByLabelText(/^Reason for change/), {
      target: { value: 'New PAN card' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }));
    expect(stored(VIJAY.applicationId).pan).toBe('ABCPK2102L');
    const names = eventsOf(VIJAY.applicationId).map((e) => e.event);
    expect(names.slice(-4)).toEqual([
      'Field changed',
      'KYC check run',
      'KYC check run',
      'KYC result set',
    ]);
  });
});

describe('a returned record, and Resubmit for approval', () => {
  const resubmitButton = () =>
    within(header()).queryByRole('button', { name: 'Resubmit for approval' });

  it('has no Resubmit button before the record is corrected', () => {
    draw(SAVITA.applicationId);
    expect(resubmitButton()).toBeNull();
  });

  it('shows the button after a save, as the primary button', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    const button = resubmitButton()!;
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-primary');
  });

  it('is not shown for a record that is not returned (a rejected one, even for the administrator)', () => {
    draw(BASAVARAJ.applicationId, 'admin');
    expect(resubmitButton()).toBeNull();
  });

  it('is not shown to the Branch Manager, who cannot edit it', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    act(() => state().setCurrentUser('mahesh'));
    expect(resubmitButton()).toBeNull();
    act(() => state().setCurrentUser('admin'));
    expect(resubmitButton()).not.toBeNull();
  });

  it('sends the record back to Level 1 in the same instance, and the sheet follows', () => {
    const instanceId = state().workflowInstances.find(
      (i) => i.applicationId === SAVITA.applicationId,
    )!.id;
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    fireEvent.click(resubmitButton()!);
    expect(stored(SAVITA.applicationId).status).toBe(ApplicationStatus.InLevel1);
    const instance = state().workflowInstances.find(
      (i) => i.applicationId === SAVITA.applicationId,
    )!;
    expect(instance.id).toBe(instanceId);
    expect(instance.status).toBe('In Progress');
    expect(toastText('Application HL-2026-0004 resubmitted for approval')).toBeInTheDocument();
    // the sheet: the status chip and the banner, no more button, no more Edit
    expect(within(header()).getByText('In-Progress')).toBeInTheDocument();
    expect(within(sheet()).getByText('Pending approval at Level 1')).toBeInTheDocument();
    expect(resubmitButton()).toBeNull();
    expect(within(header()).getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(header()).getByText('Locked while in approval')).toBeInTheDocument();
  });

  it('writes the Resubmitted event after the field changes, and the Branch Manager has the task again', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    fireEvent.click(resubmitButton()!);
    const names = eventsOf(SAVITA.applicationId).map((e) => e.event);
    expect(names.slice(-2)).toEqual(['Field changed', 'Resubmitted']);
    expect(
      state().workflowInstances.find((i) => i.applicationId === SAVITA.applicationId)!.nodes[1],
    ).toMatchObject({ status: 'Pending', assignee: 'Mahesh Joshi' });
  });

  it('shows an error toast when the workflow refuses', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    // the KYC result was cleared behind the sheet's back: the engine refuses
    act(() =>
      useAppStore.setState({
        applications: state().applications.map((a) =>
          a.applicationId === SAVITA.applicationId
            ? { ...a, kycOverallResult: 'Fail' as const }
            : a,
        ),
      }),
    );
    fireEvent.click(resubmitButton()!);
    expect(screen.getByText('Resolve the KYC result before resubmitting')).toBeInTheDocument();
    expect(stored(SAVITA.applicationId).status).toBe(ApplicationStatus.Returned);
  });
});

// ---------------------------------------------------------------------------
// What the review of the edit mode found: each problem has its test
// ---------------------------------------------------------------------------

describe('after Change Aadhaar', () => {
  it('has the cursor in the input that took the place of the button', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Change Aadhaar' }));
    expect(input('Aadhaar')).toHaveFocus();
  });
});

describe('an Aadhaar that is not there, or was kept as not valid', () => {
  const draftWith = (aadhaar: string) => {
    state().fillScenario('A');
    state().saveApplication({ ...state().draft, status: ApplicationStatus.Draft, aadhaar });
    return state().draft.applicationId;
  };

  it('opens as an input, since there is no number to show masked, and Save says what is wrong', () => {
    draw(draftWith(''));
    startEdit();
    goTo('Identity');
    expect(within(sheet()).queryByRole('button', { name: 'Change Aadhaar' })).toBeNull();
    expect(input('Aadhaar').value).toBe('');
    save();
    expect(within(sheet()).getByText('Enter Aadhaar')).toBeInTheDocument();
    expect(input('Aadhaar')).toHaveAttribute('aria-invalid', 'true');
    expect(input('Aadhaar')).toHaveFocus();
  });

  it('says the number is not valid for a record that kept it as not valid', () => {
    draw(draftWith('XXXX XXXX XXXX'));
    startEdit();
    goTo('Identity');
    expect(within(sheet()).queryByRole('button', { name: 'Change Aadhaar' })).toBeNull();
    save();
    expect(within(sheet()).getByText(MESSAGES.aadhaar)).toBeInTheDocument();
  });

  it('still shows a valid masked number masked, with the button', () => {
    draw(draftWith('XXXX XXXX 4821'));
    startEdit();
    goTo('Identity');
    expect(within(sheet()).getByRole('button', { name: 'Change Aadhaar' })).toBeInTheDocument();
  });
});

describe('Save with errors on several tabs', () => {
  it('goes to the first tab with an error in the order of the tabs, not of the form', () => {
    draw(SAVITA.applicationId);
    startEdit();
    // the consent is on the Identity tab, but comes last in the form, after the sureties
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('checkbox'));
    goTo('Sureties');
    typeInto('Surety 1 Name', '');
    goTo('Application');
    save();
    expect(tab('Identity')).toHaveAttribute('aria-selected', 'true');
    expect(within(sheet()).getByRole('checkbox')).toHaveFocus();
  });

  it('clears a search that hides the invalid field, so that the cursor can reach it', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '123');
    const search = within(header()).getByRole('textbox', { name: 'Search the fields of this tab' });
    fireEvent.change(search, { target: { value: 'email' } });
    expect(within(sheet()).queryByLabelText(label('Mobile'))).toBeNull();
    save();
    expect(search).toHaveValue('');
    expect(input('Mobile')).toHaveFocus();
  });
});

describe('Save when nothing was changed', () => {
  it('does not ask an approved record for a reason: it says so and leaves edit mode', () => {
    const before = state().auditEvents.length;
    const updated = stored(VIJAY.applicationId).updatedAt;
    draw(VIJAY.applicationId, 'admin');
    startEdit();
    save();
    expect(screen.queryByRole('dialog', { name: 'Reason for change' })).toBeNull();
    expect(screen.getByText('No changes to save')).toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(state().auditEvents).toHaveLength(before);
    expect(stored(VIJAY.applicationId).updatedAt).toBe(updated);
  });

  it('says it also when a field was changed and put back', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    typeInto('Mobile', SAVITA.mobile);
    save();
    expect(screen.getByText('No changes to save')).toBeInTheDocument();
  });
});

describe('the consent', () => {
  it('is written to the trail as Yes or No, like the sheet shows it', () => {
    const id = makeDraft();
    draw(id);
    startEdit();
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('checkbox'));
    save();
    const event = eventsOf(id).find((e) => e.event === 'Field changed' && e.field === 'Consent');
    expect(event).toMatchObject({ oldValue: 'No', newValue: 'Yes' });
  });

  it('shows the Consent Time once on the Identity tab: the locked field, not the helper text too', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    expect(within(sheet()).getAllByText('Consent Time')).toHaveLength(1); // the locked field
    expect(within(sheet()).queryByText(/^Consent Time:/)).toBeNull(); // not the helper text of the box
  });
});

describe('an identity change that was given up', () => {
  it('does not leave its result behind: after the reason was cancelled and the PAN put back, nothing of it is saved', async () => {
    const checked = stored(VIJAY.applicationId).kycCheckedOn;
    const kycEvents = () =>
      eventsOf(VIJAY.applicationId).filter((e) => e.event === 'KYC result set').length;
    const before = kycEvents();
    draw(VIJAY.applicationId, 'admin');
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPK2102L');
    save();
    const box = await screen.findByLabelText(/^OTP sent to the mobile number/);
    fireEvent.change(box, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await waitFor(() => screen.getByText('KYC result: Pass'));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'KYC checks' })).getByRole('button', {
        name: 'Continue',
      }),
    );
    // the reason is asked; the administrator thinks again, and puts the PAN back
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Reason for change' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    typeInto('PAN', VIJAY.pan);
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    // no checks this time, only the reason
    expect(screen.queryByRole('dialog', { name: 'KYC checks' })).toBeNull();
    const reason = screen.getByRole('dialog', { name: 'Reason for change' });
    fireEvent.change(within(reason).getByLabelText(/^Reason for change/), {
      target: { value: 'New number' },
    });
    fireEvent.click(within(reason).getByRole('button', { name: 'Save changes' }));
    const saved = stored(VIJAY.applicationId);
    expect(saved.mobile).toBe('9000000001');
    expect(saved.pan).toBe(VIJAY.pan);
    expect(saved.kycCheckedOn).toBe(checked);
    expect(kycEvents()).toBe(before);
  });
});

describe('a sanction that the new cost would leave above the Eligible Amount', () => {
  it('is not saved: the sheet says why, and the record is as it was', () => {
    draw(VIJAY.applicationId, 'admin');
    startEdit();
    goTo('Property');
    typeInto('Estimated Cost', '2000000'); // Eligible Amount 15,00,000; the sanction is 20,00,000
    goTo('Application');
    typeInto('Loan Amount Requested', '1500000');
    save();
    const reason = screen.getByRole('dialog', { name: 'Reason for change' });
    fireEvent.change(within(reason).getByLabelText(/^Reason for change/), {
      target: { value: 'Valuation was revised' },
    });
    fireEvent.click(within(reason).getByRole('button', { name: 'Save changes' }));
    expect(
      within(sheet()).getByText(/The sanctioned amount, 20,00,000, is above/),
    ).toBeInTheDocument();
    expect(stored(VIJAY.applicationId).estimatedCost).toBe(VIJAY.estimatedCost);
    expect(within(header()).getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });
});

describe('View workflow in edit mode', () => {
  const link = () => within(header()).getByRole('link', { name: 'View workflow' });
  const where = () => screen.getByTestId('location').textContent;

  it('goes at once when nothing was changed', () => {
    draw(SAVITA.applicationId);
    startEdit();
    fireEvent.click(link());
    expect(where()).toMatch(/^\/workflow\/review\//);
  });

  it('asks first when there are unsaved changes: Keep editing stays, Discard changes goes on', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    fireEvent.click(link());
    expect(where()).toBe('/');
    const question = screen.getByRole('dialog', { name: 'Discard your changes?' });
    fireEvent.click(within(question).getByRole('button', { name: 'Keep editing' }));
    expect(where()).toBe('/');
    expect(input('Mobile').value).toBe('9000000001');
    fireEvent.click(link());
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', {
        name: 'Discard changes',
      }),
    );
    expect(where()).toMatch(/^\/workflow\/review\//);
    expect(stored(SAVITA.applicationId).mobile).toBe(SAVITA.mobile);
  });
});

describe('after Resubmit for approval', () => {
  it('has the cursor on View workflow, where the record went on, not on nothing', () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    save();
    const button = within(header()).getByRole('button', { name: 'Resubmit for approval' });
    button.focus();
    fireEvent.click(button);
    expect(within(header()).queryByRole('button', { name: 'Resubmit for approval' })).toBeNull();
    expect(within(header()).getByRole('link', { name: 'View workflow' })).toHaveFocus();
  });
});

describe('the layout of the sheet', () => {
  it('wraps the header below 1024px: the name, then the search and the buttons, so none is covered', () => {
    draw(SAVITA.applicationId);
    const classes = header().className;
    expect(classes).toContain('max-lg:flex');
    expect(classes).toContain('max-lg:flex-wrap');
    expect(classes).toContain('max-lg:h-auto');
    expect(classes).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)]');
    const search = within(header()).getByRole('textbox', { name: 'Search the fields of this tab' });
    expect(search.closest('label')).toHaveClass('min-w-0!'); // it does not push its 180px into the buttons
  });

  it('gives the inputs the width of the form column, not of the window: 3 columns, 4 when it is wide', () => {
    draw(SAVITA.applicationId);
    startEdit();
    const grid = input('Loan Amount Requested').closest('.grid')!;
    expect(grid).toHaveClass('@3xl:grid-cols-3', '@6xl:grid-cols-4');
    expect(grid.className).not.toContain('min-[1200px]');
    expect(within(sheet()).getByRole('tabpanel')).toHaveClass('@container');
  });

  it('moves the messages under the header of the sheet while it is open, and back when it is closed', () => {
    const view = draw(SAVITA.applicationId);
    expect(document.documentElement.style.getPropertyValue('--toast-top')).toBe('120px');
    view.unmount();
    expect(document.documentElement.style.getPropertyValue('--toast-top')).toBe('');
  });

  it('is a new sheet for another record: an edit in progress is not carried over', () => {
    const view = draw(SAVITA.applicationId);
    startEdit();
    goTo('Applicant');
    typeInto('Mobile', '9000000001');
    view.rerender(<Harness applicationId={VIJAY.applicationId} />);
    expect(within(header()).queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(within(header()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('the KYC dialog, for the keyboard and a screen reader', () => {
  const said = (dialog: HTMLElement, pattern: RegExp) =>
    within(dialog)
      .getAllByRole('status')
      .some((e) => pattern.test(e.textContent ?? ''));

  it('puts the cursor in the OTP box when it is asked for, says so, and keeps the cursor in the dialog after it', async () => {
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    const dialog = screen.getByRole('dialog', { name: 'KYC checks' });
    // a live region says what is going on; its words change as the checks go on
    expect(said(dialog, /Checking/)).toBe(true);
    const box = await screen.findByLabelText(/^OTP sent to the mobile number/);
    expect(box).toHaveFocus();
    expect(said(dialog, /enter the OTP sent to the mobile number ending/)).toBe(true);
    fireEvent.change(box, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await waitFor(() => screen.getByText('KYC result: Pass'));
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(said(dialog, /^KYC result: Pass\. Continue to save the changes\.$/)).toBe(true);
  });

  it('masks an Aadhaar number typed into the remark of an exception, before it leaves the dialog', async () => {
    act(() => state().setKycOutage('pan-down'));
    draw(SAVITA.applicationId);
    startEdit();
    goTo('Identity');
    typeInto('PAN', 'ABCPT5505R');
    save();
    const box = await screen.findByLabelText(/^OTP sent to the mobile number/);
    fireEvent.change(box, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    const remark = await screen.findByLabelText(/^KYC Exception Remark/);
    fireEvent.change(remark, { target: { value: 'Seen: Aadhaar 2345 6789 0123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(stored(SAVITA.applicationId).kycExceptionRemark).toBe('Seen: Aadhaar XXXX XXXX 0123');
    expect(JSON.stringify(eventsOf(SAVITA.applicationId))).not.toMatch(FULL_AADHAAR);
    expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(FULL_AADHAAR);
  });
});
