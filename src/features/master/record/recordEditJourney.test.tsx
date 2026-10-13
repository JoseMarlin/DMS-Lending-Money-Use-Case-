import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '@/App';
import { useAppStore } from '@/data/store';
import { ApplicationStatus, type DemoUserId } from '@/data/types';
import { approveBothLevels, submitScenario } from '@/test/workflowHelpers';

const state = () => useAppStore.getState();

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

let current: ReturnType<typeof render> | null = null;

function renderAt(path: string) {
  current?.unmount();
  current = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Probe />
    </MemoryRouter>,
  );
  return current;
}

const where = () => screen.getByTestId('location').textContent;
const actAs = (id: DemoUserId) => act(() => state().setCurrentUser(id));
const sheet = () => screen.getByRole('dialog', { name: /, record$/ });
const header = () => within(sheet()).getByRole('banner');
const goTo = (name: string) =>
  fireEvent.click(within(sheet()).getByRole('tab', { name: new RegExp(`^${name}`) }));
const label = (text: string) => new RegExp(`^${text.replace(/[()]/g, '\\$&')}\\*?$`);
const typeInto = (text: string, value: string) => {
  const el = within(sheet()).getByLabelText(label(text));
  fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
};

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

afterEach(() => {
  current = null; // the test library has torn it down already
});

describe('a saved edit shows at once in the master list', () => {
  it('a draft: the name in My Submissions follows the edit, with the sheet open or closed', () => {
    state().fillScenario('A');
    state().saveApplication({ ...state().draft, status: ApplicationStatus.Draft });
    const id = state().draft.applicationId;
    renderAt('/metadata/master/home-loan');
    expect(screen.getByRole('link', { name: 'View Ramesh Patil' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'View Ramesh Patil' }));
    fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
    goTo('Applicant');
    typeInto('Full Name (as per PAN)', 'Ramesh K Patil');
    goTo('Property');
    typeInto('Property Owner Name', 'Ramesh K Patil');
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('checkbox')); // the consent
    // a name change runs the checks again: the draft has no KYC result yet, and gets one
    fireEvent.click(within(header()).getByRole('button', { name: 'Save changes' }));
    return (async () => {
      const otp = await screen.findByLabelText(/^OTP sent to the mobile number/);
      fireEvent.change(otp, { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
      await waitFor(() => screen.getByText('KYC result: Pass'));
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      // the sheet is still open over the list, and the list under it has the new name already
      expect(within(sheet()).getByRole('heading', { name: 'Ramesh K Patil' })).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'View Ramesh K Patil', hidden: true }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'View Ramesh Patil', hidden: true })).toBeNull();
      fireEvent.click(within(header()).getByRole('button', { name: 'Close record' }));
      expect(where()).toBe('/metadata/master/home-loan');
      expect(screen.getByRole('link', { name: 'View Ramesh K Patil' })).toBeInTheDocument();
      expect(state().applications.find((a) => a.applicationId === id)?.status).toBe('KYC Done');
    })();
  });
});

describe('a returned record, corrected and resubmitted', () => {
  it('goes back to the Level 1 inbox of the Branch Manager, and its review screen is waiting for him', () => {
    renderAt('/metadata/master/home-loan?record=HL-2026-0004');
    // Mahesh has no task for it now
    actAs('mahesh');
    expect(within(header()).getByText('Action Required')).toBeInTheDocument();
    actAs('priya');
    fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
    goTo('Applicant');
    typeInto('Monthly Income', '65000');
    fireEvent.click(within(header()).getByRole('button', { name: 'Save changes' }));
    fireEvent.click(within(header()).getByRole('button', { name: 'Resubmit for approval' }));
    expect(within(header()).getByText('In-Progress')).toBeInTheDocument();
    fireEvent.click(within(header()).getByRole('button', { name: 'Close record' }));

    actAs('mahesh');
    const instanceId = state().workflowInstances.find(
      (i) => i.applicationId === 'HL-2026-0004',
    )!.id;
    expect(state().workflowInstances.find((i) => i.id === instanceId)?.status).toBe('In Progress');
    // his tasks, in the bell and in the Workflow list
    cleanupAndGo('/workflow');
    expect(screen.getByRole('link', { name: /Review Request: Savita Patil/ })).toBeInTheDocument();
  });
});

// a second render of the app at another address (the first one is torn down)
function cleanupAndGo(path: string) {
  renderAt(path); // unmounts the one before it
}

describe('an approved record, edited by the administrator, in All Records', () => {
  it('shows the edit in the All Records tab, and the sheet is opened from there', () => {
    const { id, applicationId } = submitScenario('A');
    approveBothLevels(id);
    actAs('admin');
    renderAt(`/metadata/master/home-loan?tab=all-records&record=${applicationId}`);
    fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
    goTo('Property');
    typeInto('Estimated Cost', '2800000'); // a higher cost: the sanction stays within the Eligible Amount
    fireEvent.click(within(header()).getByRole('button', { name: 'Save changes' }));
    const reason = screen.getByRole('dialog', { name: 'Reason for change' });
    fireEvent.change(within(reason).getByRole('textbox', { name: /^Reason for change/ }), {
      target: { value: 'Valuation was revised' },
    });
    fireEvent.click(within(reason).getByRole('button', { name: 'Save changes' }));
    expect(
      state().masterRecords.find((r) => r.applicationId === applicationId)?.estimatedCost,
    ).toBe(2_800_000);
    fireEvent.click(within(header()).getByRole('button', { name: 'Close record' }));
    expect(where()).toBe('/metadata/master/home-loan?tab=all-records');
    expect(screen.getByRole('tab', { name: /^All Records/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('link', { name: 'View Ramesh Patil' })).toBeInTheDocument();
  });
});
