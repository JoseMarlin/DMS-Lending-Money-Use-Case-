import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '@/App';
import { useAppStore } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import { approveBothLevels, submitScenario } from '@/test/workflowHelpers';

const state = () => useAppStore.getState();

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Probe />
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId('location').textContent;
const actAs = (id: DemoUserId) => act(() => state().setCurrentUser(id));
const FILES_L1 = '/workflow/review/WI-23445215?tab=files'; // Manjunath: 12 documents + 1 attachment, waits for Mahesh
const FILES_DONE = '/workflow/review/WI-23445213?tab=files'; // Vijay: approved, files filed (12 documents, 2 attachments and the Sanction Summary)
const table = () => screen.getByRole('table', { name: 'Files of the application' });
const bodyRows = () => within(table()).getAllByRole('row').slice(1);
const fileNames = () =>
  bodyRows().map((row) => within(row).getAllByRole('cell')[0].querySelector('p')?.textContent);
const header = (name: string) => within(table()).getByRole('columnheader', { name });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The approvers act minutes after the submission: only the clock is moved, timers stay real. */
function minutesLater(minutes: number) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + minutes * 60_000);
}

describe('the Files tab', () => {
  it('has the columns File, Folder, DocType and Comments, and a column of menus', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    const headers = within(table())
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual(['File', 'Folder', 'DocType', 'Comments', 'Actions']);
    for (const name of ['File', 'Folder', 'DocType', 'Comments']) {
      expect(within(header(name)).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(header('Actions')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(header('Actions')).getByText('Actions')).toHaveClass('sr-only');
  });

  it('has one row for each uploaded document, with the DocType name', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    const app = state().applications.find((a) => a.applicationId === 'HL-2026-0003')!;
    expect(bodyRows()).toHaveLength(app.documents.length);
    const first = within(bodyRows()[0]).getAllByRole('cell');
    expect(first[0]).toHaveTextContent('PAN_Card_Manjunath_Hiremath.pdf');
    expect(first[0]).toHaveTextContent('Gokak loan officer (demo) · 5 Oct 2026, 10:30 AM');
    expect(first[2]).toHaveTextContent('PAN Card');
  });

  it('lists the attachments after the documents, as Supporting Documents in 05 Other', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    const app = state().applications.find((a) => a.applicationId === 'HL-2026-0003')!;
    expect(app.documents.filter((d) => d.docType === 'Supporting Document')).toHaveLength(1);
    const last = within(bodyRows().at(-1)!).getAllByRole('cell');
    expect(last[0]).toHaveTextContent('Salary_Slip_Sept.pdf');
    expect(last[0]).toHaveTextContent('Gokak loan officer (demo) · 6 Oct 2026, 10:00 AM');
    expect(last[1]).toHaveTextContent('... / 05 Other');
    expect(last[1]).toHaveTextContent('Pending approval');
    expect(within(last[1]).getByRole('link')).toHaveAttribute(
      'href',
      '/files?folder=' +
        encodeURIComponent(
          'Loans/Home Loan/Pending Approval/HL-2026-0003 Manjunath Hiremath/05 Other',
        ),
    );
    expect(last[2]).toHaveTextContent('Supporting Document');
  });

  it('adds the Sanction Summary after the documents of an approved application', () => {
    actAs('priya');
    renderAt(FILES_DONE);
    const app = state().applications.find((a) => a.applicationId === 'HL-2026-0001')!;
    expect(app.documents).toHaveLength(14);
    // 14 documents (12 + 2 attachments), then the Sanction Summary that the approval made
    expect(bodyRows()).toHaveLength(app.documents.length + 1);
    const summary = within(bodyRows().at(-1)!).getAllByRole('cell');
    expect(summary[0]).toHaveTextContent('Sanction_Summary_Vijay_Kulkarni.pdf');
    expect(summary[0]).toHaveTextContent('System');
    expect(summary[1]).toHaveTextContent('... / 04 Sanction');
    expect(summary[1]).toHaveTextContent('Filed');
    expect(summary[2]).toHaveTextContent('Sanction Summary');
  });

  it('shows where the file is now, as a link into Files & Folders, with its status under it', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    const cells = within(bodyRows()[0]).getAllByRole('cell');
    const link = within(cells[1]).getByRole('link');
    expect(link).toHaveTextContent('... / 01 KYC');
    expect(link).toHaveAttribute(
      'href',
      '/files?folder=' +
        encodeURIComponent(
          'Loans/Home Loan/Pending Approval/HL-2026-0003 Manjunath Hiremath/01 KYC',
        ),
    );
    expect(link).toHaveAttribute(
      'title',
      'Loans / Home Loan / Pending Approval / HL-2026-0003 Manjunath Hiremath / 01 KYC',
    );
    expect(cells[1]).toHaveTextContent('Pending approval');
    expect(screen.queryByText('Pending filing')).not.toBeInTheDocument();
    // a Property file goes to its own folder
    const property = bodyRows().find((row) => /Sale or Gift Deed/.test(row.textContent ?? ''))!;
    expect(property).toHaveTextContent('... / 03 Property');
  });

  it('shows the folder of the branch and the word Filed after approval, and opens that folder', () => {
    actAs('priya');
    renderAt(FILES_DONE);
    const cells = within(bodyRows()[0]).getAllByRole('cell');
    const link = within(cells[1]).getByRole('link');
    expect(link).toHaveTextContent('... / 01 KYC');
    expect(link).toHaveAttribute(
      'title',
      'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 01 KYC',
    );
    expect(link).toHaveAccessibleName(expect.stringContaining('Loans / Home Loan / '));
    expect(cells[1]).toHaveTextContent('Filed');
    fireEvent.click(link);
    expect(where()).toMatch(/^\/files\?folder=/);
  });

  it('moves with the status while the page is open: Pending approval, then Filed in the branch folder', () => {
    const { id } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}?tab=files`);
    expect(bodyRows()[0]).toHaveTextContent('Pending approval');
    expect(within(bodyRows()[0]).getByRole('link')).toHaveAttribute(
      'title',
      expect.stringContaining('/ Pending Approval /'),
    );
    act(() => approveBothLevels(id));
    expect(bodyRows()[0]).toHaveTextContent('Filed');
    expect(bodyRows()[0]).not.toHaveTextContent('Pending approval');
    expect(within(bodyRows()[0]).getByRole('link')).toHaveAttribute(
      'title',
      expect.stringContaining('/ Belagavi Main Branch (demo) /'),
    );
  });

  it('is a scrolling area of its own that contains the hidden text, so the page does not grow', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    // sr-only text is absolutely positioned: without `relative` here it would escape the clipping
    // of the scroll area and make the whole page scroll
    expect(screen.getByRole('tabpanel')).toHaveClass('relative', 'overflow-y-auto');
  });

  it('reads "No comment" to a screen reader where it draws the dash', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    const cell = within(bodyRows()[0]).getAllByRole('cell')[3];
    expect(cell.querySelector('[aria-hidden]')?.textContent).toBe('-');
    expect(within(cell).getByText('No comment')).toHaveClass('sr-only');
  });

  it('has a dash in Comments, since no reviewer has commented on a file', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    for (const row of bodyRows()) {
      // the dash, and for a screen reader the words "No comment" next to it
      expect(within(row).getAllByRole('cell')[3]).toHaveTextContent(/^-No comment$/);
    }
  });

  it('shows the files of a rejected request in Rejected, with the status Rejected', () => {
    actAs('admin');
    renderAt('/workflow/review/WI-23445217?tab=files'); // Basavaraj: rejected
    const cells = within(bodyRows()[0]).getAllByRole('cell');
    expect(within(cells[1]).getByRole('link')).toHaveAttribute(
      'title',
      expect.stringContaining('/ Rejected / HL-2026-0005 Basavaraj Kadam /'),
    );
    expect(cells[1]).toHaveTextContent('Rejected');
    expect(screen.queryByText('Not filed')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending filing')).not.toBeInTheDocument();
  });

  it('gives a PDF and a picture their own icon', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    const pdf = bodyRows()[0].querySelector('svg')!;
    const photoRow = bodyRows().find((row) => /\.jpg/.test(row.textContent ?? ''))!;
    expect(pdf.querySelector('text')?.textContent).toBe('PDF');
    expect(photoRow.querySelector('svg')?.querySelector('text')).toBeNull();
  });
});

describe('sorting the Files tab', () => {
  it('starts in the order of the upload, with nothing marked', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    for (const name of ['File', 'Folder', 'DocType', 'Comments']) {
      expect(header(name)).toHaveAttribute('aria-sort', 'none');
    }
    expect(fileNames()[0]).toBe('PAN_Card_Manjunath_Hiremath.pdf');
  });

  it('sorts by File up, then down, and marks the header', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    const before = fileNames();
    fireEvent.click(within(header('File')).getByRole('button'));
    expect(header('File')).toHaveAttribute('aria-sort', 'ascending');
    const asc = fileNames();
    expect(asc).toEqual([...before].sort((a, b) => a!.localeCompare(b!)));
    fireEvent.click(within(header('File')).getByRole('button'));
    expect(header('File')).toHaveAttribute('aria-sort', 'descending');
    expect(fileNames()).toEqual([...asc].reverse());
  });

  it('sorts by DocType, and moving to another column starts it upward', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    fireEvent.click(within(header('DocType')).getByRole('button'));
    fireEvent.click(within(header('DocType')).getByRole('button'));
    expect(header('DocType')).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(header('Folder')).getByRole('button'));
    expect(header('Folder')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('DocType')).toHaveAttribute('aria-sort', 'none');
    const labels = bodyRows().map((row) => within(row).getAllByRole('cell')[1].textContent);
    expect(labels[0]).toMatch(/01 KYC/);
    expect(labels.at(-1)).toMatch(/05 Other/); // the attachments are the last folder
    // and the DocType column sorts in the same hands: A to Z
    fireEvent.click(within(header('DocType')).getByRole('button'));
    const types = bodyRows().map((row) => within(row).getAllByRole('cell')[2].textContent!);
    expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b)));
  });
});

describe('the menu of a row and the preview', () => {
  const menuButton = (row: number) =>
    within(bodyRows()[row]).getByRole('button', { name: /^More actions for/ });

  it('opens a menu with Preview, and closes it with Escape', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(menuButton(0));
    expect(menuButton(0)).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Preview' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(menuButton(0)).toHaveFocus();
  });

  it('names each kebab after its file', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    expect(menuButton(0)).toHaveAccessibleName('More actions for PAN_Card_Manjunath_Hiremath.pdf');
  });

  it('opens the preview of that file: its name, its type, and a mock page', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    fireEvent.click(menuButton(0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preview' }));
    const dialog = screen.getByRole('dialog', { name: 'PAN_Card_Manjunath_Hiremath.pdf' });
    expect(within(dialog).getByText('PDF document')).toBeInTheDocument();
    expect(within(dialog).getByText('PAN Card')).toBeInTheDocument();
    expect(within(dialog).getByText(/preview is mocked/)).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the preview with Close, and with Escape', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    fireEvent.click(menuButton(1));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preview' }));
    // the dialog has a cross in its corner and a Close in its footer
    const closers = within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' });
    fireEvent.click(closers.at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(menuButton(1));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preview' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives the cursor back to the kebab of the row when the preview closes', () => {
    actAs('mahesh');
    renderAt(FILES_L1);
    fireEvent.click(menuButton(1));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preview' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton(1)).toHaveFocus();
  });

  it('says in the preview where the file is, and its status', () => {
    actAs('mahesh');
    const { unmount } = renderAt(FILES_L1);
    fireEvent.click(menuButton(0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preview' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Loans / Home Loan / Pending Approval / HL-2026-0003 Manjunath Hiremath / 01 KYC',
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Pending approval');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Planned');
    unmount();

    actAs('priya');
    renderAt(FILES_DONE);
    fireEvent.click(menuButton(0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preview' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 01 KYC',
    );
  });
});

describe('the Files tab with nothing to list', () => {
  it('says that no document was uploaded', () => {
    actAs('mahesh');
    act(() => {
      useAppStore.setState((s) => ({
        applications: s.applications.map((a) =>
          a.applicationId === 'HL-2026-0003' ? { ...a, documents: [] } : a,
        ),
      }));
    });
    renderAt(FILES_L1);
    expect(screen.getByText('No files')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says the application is gone when it is', () => {
    actAs('mahesh');
    act(() => {
      useAppStore.setState({ applications: [] });
    });
    renderAt(FILES_L1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('is not in this demo any more');
  });
});

describe('the Activity log tab', () => {
  const ACTIVITY = '/workflow/review/WI-23445213?tab=activity'; // Vijay: approved, a full trail
  const entries = () =>
    within(screen.getByRole('list', { name: 'Activity, newest first' })).getAllByRole('listitem');

  it('lists the events of the application, newest first, and says how many', () => {
    actAs('priya');
    renderAt(ACTIVITY);
    expect(screen.getByText(/^\d+ events, newest first$/)).toBeInTheDocument();
    // the newest event is the last comment (27 Aug), after the approval and the filing of 26 Aug
    expect(entries()[0]).toHaveTextContent('Comment added');
    expect(entries()[0]).toHaveTextContent('Sanction letter handed over to the applicant.');
    expect(entries()[1]).toHaveTextContent('Files stored');
    expect(entries()[2]).toHaveTextContent('Record created');
    expect(entries().at(-1)).toHaveTextContent('Application created');
  });

  it('has a line for each seeded comment and each attachment of the application', () => {
    actAs('priya');
    renderAt(ACTIVITY);
    const titled = (title: string) => entries().filter((e) => e.textContent?.startsWith(title));
    expect(titled('Comment added')).toHaveLength(4);
    expect(titled('Attachment added')).toHaveLength(2);
    expect(screen.getByText('Supporting Document: Salary_Slip_Aug.pdf')).toBeInTheDocument();
    expect(
      screen.getByText('Latest salary slip, added after the first upload'),
    ).toBeInTheDocument();
  });

  it('shows who did it and when, a chip for a decision, and the comment', () => {
    actAs('priya');
    renderAt(ACTIVITY);
    const level1 = entries().find((e) => /Level 1 decision/.test(e.textContent ?? ''))!;
    expect(level1).toHaveTextContent('Mahesh Joshi · 21 Aug 2026, 11:00 AM');
    expect(level1).toHaveTextContent('Approved');
    expect(level1).toHaveTextContent('Documents are in order.');
    // the chip says it, so the line is not repeated
    expect(level1).not.toHaveTextContent('Level 1 Decision: Approved');
  });

  it('shows the field of a document and the mock reference of a KYC check', () => {
    actAs('priya');
    renderAt(ACTIVITY);
    expect(screen.getByText('PAN Card: PAN_Card_Vijay_Kulkarni.pdf')).toBeInTheDocument();
    expect(screen.getByText('Reference MOCK-PAN-260001')).toBeInTheDocument();
  });

  it('is the log of the open request only, not of another application', () => {
    actAs('mahesh');
    renderAt('/workflow/review/WI-23445215?tab=activity');
    expect(screen.queryByText(/Vijay/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/PAN_Card_Manjunath_Hiremath\.pdf/).length).toBeGreaterThan(0);
  });

  it('grows while the page is open, as the approvers decide', () => {
    const { id, applicationId } = submitScenario('A');
    actAs('mahesh');
    renderAt(`/workflow/review/${id}?tab=activity`);
    const before = entries().length;
    expect(entries()[0]).toHaveTextContent('Workflow started');
    minutesLater(10);
    act(() => {
      expect(state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.').ok).toBe(true);
    });
    expect(entries()).toHaveLength(before + 1);
    expect(entries()[0]).toHaveTextContent('Level 1 decision');
    minutesLater(10);
    act(() => {
      const app = state().applications.find((a) => a.applicationId === applicationId)!;
      expect(
        state().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
          sanctionedAmount: app.eligibleAmount ?? 1,
          sanctionDate: '2026-10-10',
        }).ok,
      ).toBe(true);
    });
    expect(entries()[0]).toHaveTextContent('Files stored');
    expect(entries()[1]).toHaveTextContent('Record created');
  });

  it('never shows an Aadhaar number, also when one was typed into a comment', () => {
    const { id } = submitScenario('A');
    act(() => {
      expect(state().approve(id, DEMO_USERS.mahesh, 'Aadhaar 234500074821 is the same.').ok).toBe(
        true,
      );
    });
    actAs('sunita');
    renderAt(`/workflow/review/${id}?tab=activity`);
    expect(document.body.textContent).toContain('Aadhaar XXXX XXXX 4821 is the same.');
    expect(document.body.textContent).not.toContain('234500074821');
    expect(document.body.textContent).not.toMatch(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
  });

  it('says so when nothing was recorded', () => {
    actAs('priya');
    act(() => {
      useAppStore.setState({ auditEvents: [] });
    });
    renderAt(ACTIVITY);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Nothing has been recorded');
  });
});
