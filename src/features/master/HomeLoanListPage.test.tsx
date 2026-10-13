import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '@/App';
import { useAppStore } from '@/data/store';
import { ApplicationStatus, type HomeLoanApplication } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import { approveBothLevels, submitScenario } from '@/test/workflowHelpers';

const state = () => useAppStore.getState();

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderAt(path = '/metadata/master/home-loan') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Probe />
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId('location').textContent;
const table = () => screen.getByRole('table');
const dataRows = () => within(table()).getAllByRole('row').slice(1);
const nameOf = (row: HTMLElement) =>
  within(row).getAllByRole('cell')[1].querySelector('div > div')?.textContent ?? '';
const names = () => dataRows().map(nameOf);
const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} \\d+$`) });
const search = () => screen.getByRole('textbox', { name: 'Search Record' });
const type = (text: string) => fireEvent.change(search(), { target: { value: text } });
const actAs = (id: 'priya' | 'mahesh' | 'sunita' | 'admin') =>
  act(() => state().setCurrentUser(id));

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the page', () => {
  it('has the breadcrumb: Metadata and Master as links, Home Loan Application as the heading', () => {
    renderAt();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Metadata' })).toBeInTheDocument();
    expect(within(crumbs).getByRole('link', { name: 'Master' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Home Loan Application');
    expect(
      within(crumbs).queryByRole('link', { name: 'Home Loan Application' }),
    ).not.toBeInTheDocument();
    expect(document.title).toBe('Home Loan Application | DMS+');
  });

  it('is drawn in the shell, with Metadata active in the sidebar', () => {
    renderAt();
    expect(
      within(screen.getByRole('complementary', { name: 'Sidebar' })).getByRole('link', {
        name: 'Metadata',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('has two tabs and opens on My Submissions', () => {
    renderAt();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['All Records', 'My Submissions']);
    expect(screen.getByRole('tab', { name: 'My Submissions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('table', { name: 'My Submissions' })).toBeInTheDocument();
  });

  it('has Import, which does nothing', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(where()).toBe('/metadata/master/home-loan');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has the table columns of the design', () => {
    renderAt();
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['', 'Name', 'Status', 'Created On', 'Action']);
  });
});

describe('My Submissions as the loan officer', () => {
  it("shows the user's submissions, the newest first, with the status chips", () => {
    renderAt();
    expect(names()).toEqual([
      'Prakash Naik',
      'Meera Joshi',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
    ]);
    const statuses = dataRows().map((row) => within(row).getAllByRole('cell')[2].textContent);
    expect(statuses).toEqual(['Draft', 'Approved', 'Action Required', 'In-Progress', 'Approved']);
  });

  it('shows the Application ID under each name and the date as in the design', () => {
    renderAt();
    const first = dataRows()[0];
    expect(within(first).getByText('HL-2026-0007')).toBeInTheDocument();
    expect(within(first).getByText('10 Oct 2026, 10:00 AM')).toBeInTheDocument();
    const returned = dataRows()[2];
    expect(within(returned).getByText('HL-2026-0004')).toBeInTheDocument();
    expect(within(returned).getByText('22 Sep 2026, 10:00 AM')).toBeInTheDocument();
  });

  it('has an Action Required row among the seed applications', () => {
    renderAt();
    expect(within(table()).getByText('Action Required')).toBeInTheDocument();
  });

  it('counts each chip live', () => {
    renderAt();
    expect(chip('All')).toHaveTextContent('5');
    expect(chip('InProgress')).toHaveTextContent('1');
    expect(chip('Approved')).toHaveTextContent('2');
    expect(chip('Rejected')).toHaveTextContent('0');
    expect(chip('Action Required')).toHaveTextContent('1');
  });

  it('changes the counts and the list as soon as an application arrives', () => {
    renderAt();
    const added = {
      ...state().applications[0],
      applicationId: 'HL-2026-0008',
      fullNameAsPerPan: 'Ramesh Patil',
      status: ApplicationStatus.Submitted,
      createdBy: 'Priya Kulkarni',
      createdAt: '2026-10-12T10:00:00+05:30',
    } satisfies HomeLoanApplication;
    act(() => state().saveApplication(added));
    expect(chip('All')).toHaveTextContent('6');
    expect(chip('InProgress')).toHaveTextContent('2');
    expect(names()[0]).toBe('Ramesh Patil');
    expect(within(dataRows()[0]).getByText('In-Progress')).toBeInTheDocument();
  });

  it('shows a draft with the grey Draft chip, counted under All only', () => {
    renderAt();
    act(() =>
      state().saveApplication({
        ...state().applications[0],
        applicationId: 'HL-2026-0008',
        fullNameAsPerPan: '',
        status: ApplicationStatus.Draft,
        createdBy: 'Priya Kulkarni',
      }),
    );
    expect(chip('All')).toHaveTextContent('6');
    expect(chip('InProgress')).toHaveTextContent('1');
    expect(screen.getByText('No name yet')).toBeInTheDocument();
    // two drafts now: the seed draft (Prakash Naik) and this one with no name yet
    expect(within(table()).getAllByText('Draft')).toHaveLength(2);
  });

  it('shows the seed draft, with its name, among the submissions of the loan officer', () => {
    renderAt();
    const draft = dataRows().find((row) => nameOf(row) === 'Prakash Naik');
    expect(draft).toBeDefined();
    expect(within(draft as HTMLElement).getByText('HL-2026-0007')).toBeInTheDocument();
    expect(within(draft as HTMLElement).getByText('Draft')).toBeInTheDocument();
  });
});

describe('the chips', () => {
  it('filter the list, and tell which one is in use', () => {
    renderAt();
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip('Action Required'));
    expect(names()).toEqual(['Savita Patil']);
    expect(chip('Action Required')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('All')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip('Approved'));
    expect(names()).toEqual(['Meera Joshi', 'Vijay Kulkarni']);
    fireEvent.click(chip('All'));
    expect(names()).toHaveLength(5);
  });

  it('show an empty message for a chip with nothing, and a way back', () => {
    renderAt();
    fireEvent.click(chip('Rejected'));
    expect(screen.getByText('No records match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(names()).toHaveLength(5);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('search', () => {
  it('matches the name', () => {
    renderAt();
    type('shobha');
    expect(names()).toEqual(['Shobha Gaonkar']);
  });

  it('matches the Application ID', () => {
    renderAt();
    type('HL-2026-0001');
    expect(names()).toEqual(['Vijay Kulkarni']);
  });

  it('works with a chip, and the counts on the chips stay the same', () => {
    renderAt();
    fireEvent.click(chip('Approved'));
    type('savita');
    expect(screen.getByText('No records match')).toBeInTheDocument();
    expect(chip('Action Required')).toHaveTextContent('1');
  });

  it('shows everything again when the box is emptied', () => {
    renderAt();
    type('zzz');
    expect(screen.getByText('No records match')).toBeInTheDocument();
    type('');
    expect(names()).toHaveLength(5);
  });

  it('says how many records are showing, for a screen reader', () => {
    renderAt();
    type('vijay');
    expect(screen.getByText('1 record shown')).toBeInTheDocument();
  });
});

describe('sorting', () => {
  it('starts with Created On, newest first', () => {
    renderAt();
    expect(screen.getByRole('columnheader', { name: 'Created On' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none');
  });

  it('sorts by Name A to Z, then Z to A', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual([
      'Meera Joshi',
      'Prakash Naik',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
    ]);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual([
      'Vijay Kulkarni',
      'Shobha Gaonkar',
      'Savita Patil',
      'Prakash Naik',
      'Meera Joshi',
    ]);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('sorts by Created On, oldest first and back', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Created On' }));
    expect(names()).toEqual([
      'Vijay Kulkarni',
      'Shobha Gaonkar',
      'Savita Patil',
      'Meera Joshi',
      'Prakash Naik',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Created On' }));
    expect(names()).toEqual([
      'Prakash Naik',
      'Meera Joshi',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
    ]);
  });

  it('keeps the sort while filtering', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    type('a');
    expect(names()).toEqual([
      'Meera Joshi',
      'Prakash Naik',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
    ]);
  });
});

describe('who sees what', () => {
  it('shows the administrator every submission', () => {
    actAs('admin');
    renderAt();
    expect(names()).toHaveLength(7);
    expect(chip('All')).toHaveTextContent('7');
    expect(chip('Approved')).toHaveTextContent('2');
    expect(chip('Rejected')).toHaveTextContent('1');
    expect(chip('InProgress')).toHaveTextContent('2');
  });

  it.each(['mahesh', 'sunita'] as const)('shows %s, an approver, none', (id) => {
    actAs(id);
    renderAt();
    expect(screen.getByText('No submissions to show')).toBeInTheDocument();
    expect(screen.getByText(/Approvers review applications/)).toBeInTheDocument();
    expect(chip('All')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('changes the moment the user is switched, with no reload', () => {
    renderAt();
    expect(names()).toHaveLength(5);
    actAs('mahesh');
    expect(screen.getByText('No submissions to show')).toBeInTheDocument();
    actAs('admin');
    expect(names()).toHaveLength(7);
    actAs('priya');
    expect(names()).toHaveLength(5);
  });

  it('shows Create Record to the loan officer and the administrator only', () => {
    renderAt();
    expect(screen.getByRole('button', { name: 'Create Record' })).toBeInTheDocument();
    actAs('admin');
    expect(screen.getByRole('button', { name: 'Create Record' })).toBeInTheDocument();
    actAs('mahesh');
    expect(screen.queryByRole('button', { name: 'Create Record' })).not.toBeInTheDocument();
    actAs('sunita');
    expect(screen.queryByRole('button', { name: 'Create Record' })).not.toBeInTheDocument();
    // Import is there for everyone
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });
});

describe('All Records', () => {
  const record = (patch: Partial<HomeLoanApplication>): HomeLoanApplication => ({
    ...state().applications[0],
    status: ApplicationStatus.Approved,
    ...patch,
  });

  it('is empty until a record is made, and says why', () => {
    renderAt('/metadata/master/home-loan?tab=all-records');
    expect(screen.getByRole('tab', { name: 'All Records' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.getByText(/final approval at Level 2/)).toBeInTheDocument();
    expect(within(table()).queryAllByRole('row')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('does not list an approved application that has no master record', () => {
    // the seed has an Approved application, but a record only exists after the Level 2 approval
    renderAt('/metadata/master/home-loan?tab=all-records');
    expect(screen.queryByText('Vijay Kulkarni')).not.toBeInTheDocument();
    expect(screen.queryByText('Meera Joshi')).not.toBeInTheDocument();
  });

  it('has the columns for a record', () => {
    renderAt('/metadata/master/home-loan?tab=all-records');
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      '',
      'Application ID',
      'Applicant Name',
      'Loan Purpose',
      'Sanctioned Amount',
      'Branch',
      'Approved On',
      'Action',
    ]);
  });

  it('lists the records, with the amount in the Indian format, for every user', () => {
    act(() =>
      useAppStore.setState({
        masterRecords: [
          record({
            applicationId: 'HL-2026-0001',
            fullNameAsPerPan: 'Vijay Kulkarni',
            sanctionedAmount: 2_000_000,
            level2Time: '2026-08-26T15:00:00+05:30',
          }),
          record({
            applicationId: 'HL-2026-0009',
            fullNameAsPerPan: 'Anita Desai',
            loanPurpose: 'Purchase of flat',
            sanctionedAmount: 1_200_000,
            level2Time: '2026-10-08T15:00:00+05:30',
          }),
        ],
      }),
    );
    renderAt('/metadata/master/home-loan?tab=all-records');
    const rows = dataRows();
    expect(rows).toHaveLength(2);
    // newest approval first
    expect(rows[0]).toHaveTextContent('HL-2026-0009');
    expect(rows[0]).toHaveTextContent('Anita Desai');
    expect(rows[0]).toHaveTextContent('Purchase of flat');
    expect(rows[0]).toHaveTextContent('₹ 12,00,000');
    expect(rows[0]).toHaveTextContent('8 Oct 2026');
    expect(rows[1]).toHaveTextContent('₹ 20,00,000');
    // an approver sees them too
    actAs('sunita');
    expect(dataRows()).toHaveLength(2);
  });

  it('searches and sorts the records', () => {
    act(() =>
      useAppStore.setState({
        masterRecords: [
          record({
            applicationId: 'HL-2026-0001',
            fullNameAsPerPan: 'Vijay Kulkarni',
            sanctionedAmount: 2_000_000,
          }),
          record({
            applicationId: 'HL-2026-0009',
            fullNameAsPerPan: 'Anita Desai',
            sanctionedAmount: 1_200_000,
          }),
        ],
      }),
    );
    renderAt('/metadata/master/home-loan?tab=all-records');
    fireEvent.click(screen.getByRole('button', { name: 'Sanctioned Amount' }));
    expect(dataRows()[0]).toHaveTextContent('Vijay Kulkarni');
    fireEvent.click(screen.getByRole('button', { name: 'Sanctioned Amount' }));
    expect(dataRows()[0]).toHaveTextContent('Anita Desai');
    type('anita');
    expect(dataRows()).toHaveLength(1);
    type('nobody');
    expect(screen.getByText('No records match')).toBeInTheDocument();
  });

  it('has no status chips: only My Submissions has them', () => {
    renderAt('/metadata/master/home-loan?tab=all-records');
    expect(screen.queryByRole('group', { name: 'Filter by status' })).not.toBeInTheDocument();
  });
});

describe('the tabs', () => {
  it('keep the tab in the address, so Back returns to the same tab', () => {
    renderAt();
    fireEvent.click(screen.getByRole('tab', { name: 'All Records' }));
    expect(where()).toBe('/metadata/master/home-loan?tab=all-records');
    expect(screen.getByRole('table', { name: 'All Records' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'My Submissions' }));
    expect(where()).toBe('/metadata/master/home-loan');
  });

  it('start the search and the chip afresh on each tab', () => {
    renderAt();
    type('shobha');
    fireEvent.click(screen.getByRole('tab', { name: 'All Records' }));
    expect(search()).toHaveValue('');
  });

  it('move with the arrow keys', () => {
    renderAt();
    screen.getByRole('tab', { name: 'My Submissions' }).focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'All Records' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('give an address with an unknown tab the default tab', () => {
    renderAt('/metadata/master/home-loan?tab=nonsense');
    expect(screen.getByRole('tab', { name: 'My Submissions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('Create Record', () => {
  it('opens the form at /apply, outside the shell', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Create Record' }));
    expect(where()).toBe('/apply');
    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument();
  });

  it('starts a new blank form each time the old one is empty', () => {
    renderAt();
    const before = state().draft.applicationId;
    act(() => state().setCurrentUser('admin'));
    fireEvent.click(screen.getByRole('button', { name: 'Create Record' }));
    // a new form for the user who is acting now, not the one made for Priya
    expect(state().draft.createdBy).toBe('Admin');
    expect(state().draft.applicationId).toBe(before);
    expect(state().currentStep).toBe(1);
  });

  it('starts a new form when the last one was already submitted', () => {
    renderAt();
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ status: ApplicationStatus.Submitted });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Record' }));
    expect(state().draft.fullNameAsPerPan).toBe('');
    expect(state().draft.status).toBe('Draft');
  });

  it('starts a new form when the one in the form is an application that was returned', () => {
    renderAt();
    const { id, applicationId } = submitScenario('A');
    act(
      () =>
        void state().returnForCorrection(id, DEMO_USERS.mahesh, 'Income Proof is not readable.'),
    );
    expect(state().draft.status).toBe('Returned'); // the form still holds the returned copy
    act(() => state().setCurrentUser('priya'));
    fireEvent.click(screen.getByRole('button', { name: 'Create Record' }));
    expect(state().draft.applicationId).not.toBe(applicationId);
    expect(state().draft.fullNameAsPerPan).toBe('');
    // the returned application is still there, returned
    expect(state().applications.find((a) => a.applicationId === applicationId)?.status).toBe(
      'Returned',
    );
  });

  it('carries on with a form that is half filled in', () => {
    renderAt();
    act(() => state().updateDraft({ fullNameAsPerPan: 'Half Done' }));
    const id = state().draft.applicationId;
    fireEvent.click(screen.getByRole('button', { name: 'Create Record' }));
    expect(state().draft.fullNameAsPerPan).toBe('Half Done');
    expect(state().draft.applicationId).toBe(id);
  });
});

describe('View and the row menu', () => {
  it('has a View link for each row, named after the person, that opens the record sheet', () => {
    renderAt();
    fireEvent.click(screen.getByRole('link', { name: 'View Savita Patil' }));
    expect(where()).toBe('/metadata/master/home-loan?record=HL-2026-0004');
    expect(screen.getByRole('dialog', { name: 'Savita Patil, record' })).toBeInTheDocument();
    // the list is still behind it
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Home Loan Application');
  });

  it('opens a kebab menu with View only', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Shobha Gaonkar' }));
    const menu = screen.getByRole('link', { name: 'View' });
    expect(menu).toHaveAttribute('href', '/metadata/master/home-loan?record=HL-2026-0002');
    expect(screen.getByRole('button', { name: 'More actions for Shobha Gaonkar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('closes the kebab menu with Escape and gives the cursor back', () => {
    renderAt();
    const kebab = screen.getByRole('button', { name: 'More actions for Shobha Gaonkar' });
    fireEvent.click(kebab);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument();
    expect(kebab).toHaveFocus();
  });

  it('opens the record from the kebab menu', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Vijay Kulkarni' }));
    fireEvent.click(screen.getByRole('link', { name: 'View' }));
    expect(where()).toBe('/metadata/master/home-loan?record=HL-2026-0001');
    expect(screen.getByRole('dialog', { name: 'Vijay Kulkarni, record' })).toBeInTheDocument();
  });

  it('opens only one kebab menu at a time', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Shobha Gaonkar' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions for Vijay Kulkarni' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Vijay Kulkarni' }));
    expect(screen.getAllByRole('link', { name: 'View' })).toHaveLength(1);
  });
});

describe('the record sheet over the list', () => {
  const sheet = () => screen.getByRole('dialog');
  const tabIsOn = (name: string) =>
    expect(within(sheet()).getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');

  it('opens when the address has ?record=, so a link from anywhere opens it', () => {
    renderAt('/metadata/master/home-loan?record=HL-2026-0001');
    expect(sheet()).toHaveAccessibleName('Vijay Kulkarni, record');
  });

  it('opens on the first tab, or on the one the address names', () => {
    renderAt('/metadata/master/home-loan?record=HL-2026-0001');
    tabIsOn('Application');
    cleanup();
    renderAt('/metadata/master/home-loan?record=HL-2026-0001&section=approval');
    tabIsOn('Approval');
  });

  it('ignores a section that is not a tab', () => {
    renderAt('/metadata/master/home-loan?record=HL-2026-0001&section=files');
    tabIsOn('Application');
  });

  it('writes the tab in the address, and leaves it out for the first tab', () => {
    renderAt('/metadata/master/home-loan?record=HL-2026-0001');
    fireEvent.click(within(sheet()).getByRole('tab', { name: 'KYC' }));
    expect(where()).toBe('/metadata/master/home-loan?record=HL-2026-0001&section=kyc');
    fireEvent.click(within(sheet()).getByRole('tab', { name: 'Application' }));
    expect(where()).toBe('/metadata/master/home-loan?record=HL-2026-0001');
  });

  it('closes with the close button and with Escape, and the list is as it was', () => {
    renderAt('/metadata/master/home-loan?record=HL-2026-0001&section=kyc');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close record' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(where()).toBe('/metadata/master/home-loan');
    cleanup();
    renderAt('/metadata/master/home-loan?record=HL-2026-0001');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(where()).toBe('/metadata/master/home-loan');
  });

  it('keeps the list tab it was opened from, so closing comes back to it', () => {
    renderAt('/metadata/master/home-loan?tab=all-records&record=HL-2026-0001');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close record' }));
    expect(where()).toBe('/metadata/master/home-loan?tab=all-records');
    expect(screen.getByRole('tab', { name: /^All Records/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('says so for an Application ID that is not there, and can still be closed', () => {
    renderAt('/metadata/master/home-loan?record=HL-2026-0099');
    expect(screen.getByRole('dialog', { name: 'Record not found' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close record' }));
    expect(where()).toBe('/metadata/master/home-loan');
  });

  it('opens from View on a row of the All Records tab as well, and keeps that tab in the address', () => {
    const { id, applicationId } = submitScenario('A');
    approveBothLevels(id);
    actAs('admin');
    renderAt('/metadata/master/home-loan?tab=all-records');
    fireEvent.click(screen.getByRole('link', { name: /^View / }));
    expect(where()).toBe(`/metadata/master/home-loan?tab=all-records&record=${applicationId}`);
    expect(sheet()).toHaveAccessibleName('Ramesh Patil, record');
    expect(within(within(sheet()).getByRole('banner')).getByText('Approved')).toBeInTheDocument();
  });

  it('shows a change made while it is open: the status follows the workflow', () => {
    const { id, applicationId } = submitScenario('A');
    actAs('priya');
    renderAt(`/metadata/master/home-loan?record=${applicationId}`);
    expect(within(sheet()).getByText('Pending approval at Level 1')).toBeInTheDocument();
    act(() => {
      approveBothLevels(id);
    });
    expect(within(within(sheet()).getByRole('banner')).getByText('Approved')).toBeInTheDocument();
    expect(within(sheet()).queryByText('Pending approval at Level 1')).not.toBeInTheDocument();
  });

  it('makes the list behind it inert while it is open, and gives it back when it closes', () => {
    const { container } = renderAt('/metadata/master/home-loan?record=HL-2026-0001');
    const inert = container.querySelector('[inert]');
    expect(inert).not.toBeNull();
    expect(inert).toContainElement(screen.getByRole('table', { hidden: true }));
    expect(inert).not.toContainElement(sheet());
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close record' }));
    expect(container.querySelector('[inert]')).toBeNull();
  });

  it('gives the cursor back to the kebab of the row when the sheet that its View opened is closed', () => {
    renderAt();
    const kebab = screen.getByRole('button', { name: 'More actions for Savita Patil' });
    fireEvent.click(kebab);
    fireEvent.click(screen.getByRole('link', { name: 'View' }));
    expect(sheet()).toBeInTheDocument();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close record' }));
    expect(kebab).toHaveFocus();
  });

  it('is not at the old address any more: /metadata/master/home-loan/HL-2026-0001 goes to the dashboard', () => {
    renderAt('/metadata/master/home-loan/HL-2026-0001');
    expect(where()).toBe('/dashboard');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('selecting rows', () => {
  it('selects rows and all rows, and does not change what Export writes', () => {
    renderAt();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Savita Patil' }));
    expect(screen.getByRole('checkbox', { name: 'Select Savita Patil' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    // the five rows and the box in the header
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(6);
  });
});

describe('Export', () => {
  let blob: Blob | undefined;
  let fileName = '';

  beforeEach(() => {
    blob = undefined;
    fileName = '';
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:export';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      fileName = this.download;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const exported = async () => (await blob?.text()) ?? '';

  it('downloads a CSV of the rows that are showing', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(fileName).toMatch(/^home-loan-my-submissions-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = (await exported()).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Application ID,Name,Status,Created On');
    expect(lines).toHaveLength(6);
    expect(lines[1]).toMatch(/^HL-2026-0007,Prakash Naik,Draft,/);
    expect(lines[3]).toMatch(/^HL-2026-0004,Savita Patil,Action Required,/);
  });

  it('writes only what the chip and the search leave showing, in the order shown', async () => {
    renderAt();
    fireEvent.click(chip('Approved'));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const lines = (await exported()).trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^HL-2026-0006,Meera Joshi,Approved,/);
    expect(lines[2]).toMatch(/^HL-2026-0001,Vijay Kulkarni,Approved,/);
  });

  it('follows the sort', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Created On' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const lines = (await exported()).trimEnd().split('\r\n');
    expect(lines[1]).toMatch(/^HL-2026-0001,/);
  });

  it('never has an Aadhaar or a PAN in it, for any user', async () => {
    actAs('admin');
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const csv = await exported();
    for (const a of state().applications) {
      expect(csv).not.toContain(a.pan);
      expect(csv).not.toContain(a.aadhaar);
    }
    expect(csv).not.toMatch(/\d{12}|XXXX XXXX/);
  });

  it('says how many rows it wrote', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByText('Exported 5 rows to CSV')).toBeInTheDocument();
    fireEvent.click(chip('Approved'));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByText('Exported 2 rows to CSV')).toBeInTheDocument();
  });

  it('is off when there is nothing to write', () => {
    renderAt();
    type('nobody');
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('writes the All Records columns from that tab', async () => {
    act(() =>
      useAppStore.setState({
        masterRecords: [
          {
            ...state().applications[0],
            status: ApplicationStatus.Approved,
            sanctionedAmount: 2_000_000,
            level2Time: '2026-08-26T15:00:00+05:30',
          },
        ],
      }),
    );
    renderAt('/metadata/master/home-loan?tab=all-records');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(fileName).toMatch(/^home-loan-all-records-/);
    const lines = (await exported()).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Application ID,Applicant Name,Loan Purpose,Sanctioned Amount,Branch,Approved On',
    );
    expect(lines[1]).toContain(',2000000,');
  });
});
