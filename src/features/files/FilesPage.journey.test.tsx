/**
 * Files & Folders worked out from the real journey: the files of the applications, in the folder
 * their status puts them in, with a "Moved" mark on a folder that files were moved into until it is
 * opened. (The page with a tree of its own is in FilesPage.test.tsx.)
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import { DEMO_USERS } from '@/data/users';
import { submitScenario } from '@/test/workflowHelpers';
import FilesPage from './FilesPage';

const state = () => useAppStore.getState();

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

const renderAt = (path = '/files') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FilesPage />
      <Probe />
    </MemoryRouter>,
  );

const open = (id: string) => `/files?folder=${encodeURIComponent(id)}`;
const folderLink = (name: string | RegExp) => screen.getByRole('link', { name });
const where = () => screen.getByTestId('location').textContent;
const approve = (id: string) => {
  state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
  state().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
    sanctionedAmount: 1_500_000,
    sanctionDate: '2026-10-12',
  });
};

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the loans', () => {
  it('start with Loans, and the files of the seed applications in the folders of their status', () => {
    renderAt(open('Loans/Home Loan'));
    expect(
      screen
        .getAllByRole('link')
        .map((a) => a.textContent)
        .filter((t) => /Branch|Drafts|Pending|Rejected/.test(t ?? '')),
    ).toEqual([
      expect.stringContaining('Belagavi Main Branch (demo)'),
      expect.stringContaining('Drafts'),
      expect.stringContaining('Pending Approval'),
      expect.stringContaining('Rejected'),
    ]);
    // the files (documents and attachments) of the branch with the two approved applications (the
    // Sanction Summary of each is one more), of the three applications in approval, the one rejected,
    // and the three files and the attachment of the draft in Drafts
    const [vijay, shobha, manjunath, savita, basavaraj, meera, prakash] = SEED_APPLICATIONS;
    const filed = vijay.documents.length + 1 + (meera.documents.length + 1);
    const pending = shobha.documents.length + manjunath.documents.length + savita.documents.length;
    expect(folderLink(/^Belagavi Main Branch/)).toHaveTextContent(new RegExp(`, ${filed} files`));
    expect(folderLink(/^Pending Approval/)).toHaveTextContent(`, ${pending} files`);
    expect(folderLink(/^Rejected/)).toHaveTextContent(`, ${basavaraj.documents.length} files`);
    expect(prakash.documents).toHaveLength(4); // PAN Card, Aadhaar, Photograph and 1 attachment
    // below Drafts: the application folder, and in it 01 KYC and 05 Other
    expect(folderLink(/^Drafts/)).toHaveTextContent('3 Folders, 4 files');
  });

  it('show a file that was uploaded in the form at once, in Drafts, with the status Draft', () => {
    renderAt(open('Loans/Home Loan/Drafts'));
    // the draft of the seed (Prakash Naik) is there, and it is the only one
    expect(screen.queryByText('This folder is empty')).not.toBeInTheDocument();
    expect(folderLink(/^HL-2026-0007 Prakash Naik/)).toHaveTextContent('2 Folders, 4 files'); // 01 KYC, 05 Other
    expect(screen.getAllByRole('link', { name: /^HL-2026-/ })).toHaveLength(1);
    act(() => state().fillScenario('A'));
    const id = state().draft.applicationId;
    expect(id).toBe('HL-2026-0008');
    expect(folderLink(new RegExp(`^${id} Ramesh Patil`))).toHaveTextContent('3 Folders, 13 files');
    fireEvent.click(folderLink(new RegExp(`^${id} Ramesh Patil`)));
    fireEvent.click(folderLink(/^01 KYC/));
    const cards = screen.getAllByRole('button', {
      name: /^(PAN_Card|Aadhaar_Masked|Passport_Photo|Address_Proof)/,
    });
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(4); // the badge on each thumbnail
  });

  it('take a file away when its document is removed in the form', () => {
    act(() => state().fillScenario('A'));
    const id = state().draft.applicationId;
    renderAt(open(`Loans/Home Loan/Drafts/${id} Ramesh Patil/01 KYC`));
    expect(screen.getAllByRole('button', { name: /^Favourite / })).toHaveLength(4);
    const pan = state().draft.documents.find((d) => d.docType === 'PAN Card')!;
    act(() =>
      state().updateDraft({ documents: state().draft.documents.filter((d) => d.id !== pan.id) }),
    );
    expect(screen.getAllByRole('button', { name: /^Favourite / })).toHaveLength(3);
    expect(screen.queryByText(pan.fileName)).not.toBeInTheDocument();
  });

  it('show the version of a file that was replaced, on the same single card', () => {
    act(() => state().fillScenario('A'));
    const id = state().draft.applicationId;
    renderAt(open(`Loans/Home Loan/Drafts/${id} Ramesh Patil/01 KYC`));
    expect(screen.getAllByText('v1.0')).toHaveLength(4);
    const pan = state().draft.documents.find((d) => d.docType === 'PAN Card')!;
    act(() =>
      state().updateDraft({
        documents: state().draft.documents.map((d) =>
          d.id === pan.id ? { ...d, fileName: 'PAN_Card_Ramesh_Patil_v2.pdf', version: 'v1.1' } : d,
        ),
      }),
    );
    expect(screen.getAllByText('v1.0')).toHaveLength(3);
    expect(screen.getAllByText('v1.1')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Favourite / })).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: /^PAN_Card_Ramesh_Patil_v2\.pdf/ }),
    ).toBeInTheDocument();
  });
});

describe('View record in the preview', () => {
  it('is there for a file of an application whose name has a space at the end', () => {
    const savita = state().applications.find((a) => a.applicationId === 'HL-2026-0004')!;
    act(() => state().saveApplication({ ...savita, fullNameAsPerPan: 'Savita Patil ' }));
    renderAt(open('Loans/Home Loan/Pending Approval/HL-2026-0004 Savita Patil/01 KYC'));
    fireEvent.click(screen.getAllByRole('button', { name: /^PAN_Card/ })[0]);
    expect(
      within(screen.getByRole('dialog')).getByRole('link', { name: 'View record' }),
    ).toHaveAttribute('href', '/metadata/master/home-loan?record=HL-2026-0004');
  });
});

describe('the "Moved" mark', () => {
  it('is on no folder before anything moved', () => {
    renderAt();
    expect(screen.queryByText('Moved')).not.toBeInTheDocument();
  });

  it('can be followed down from the top after a submission, and goes from each folder as it is opened', () => {
    const { applicationId } = submitScenario('A');
    renderAt();
    // Loans carries it; the other folders of the bank do not
    expect(within(folderLink(/^Loans/)).getByText('Moved')).toBeInTheDocument();
    expect(
      within(folderLink(/^Policies & Circulars/)).queryByText('Moved'),
    ).not.toBeInTheDocument();

    fireEvent.click(folderLink(/^Loans/));
    expect(where()).toBe(open('Loans'));
    expect(state().movedFolders).not.toContain('Loans');
    expect(within(folderLink(/^Home Loan/)).getByText('Moved')).toBeInTheDocument();

    fireEvent.click(folderLink(/^Home Loan/));
    expect(within(folderLink(/^Pending Approval/)).getByText('Moved')).toBeInTheDocument();
    expect(within(folderLink(/^Drafts/)).queryByText('Moved')).not.toBeInTheDocument();

    fireEvent.click(folderLink(/^Pending Approval/));
    const folder = folderLink(new RegExp(`^${applicationId} Ramesh Patil`));
    expect(within(folder).getByText('Moved')).toBeInTheDocument();
    // the seed applications did not move
    expect(within(folderLink(/^HL-2026-0002/)).queryByText('Moved')).not.toBeInTheDocument();

    fireEvent.click(folder);
    expect(state().movedFolders).toEqual([]);
    expect(screen.queryByText('Moved')).not.toBeInTheDocument();
  });

  it('is on the folder of the branch after the final approval, and on Rejected after a rejection', () => {
    const approved = submitScenario('A');
    approve(approved.id);
    const rejected = submitScenario('B');
    state().reject(rejected.id, DEMO_USERS.mahesh, 'KYC does not match.');
    renderAt(open('Loans/Home Loan'));
    expect(within(folderLink(/^Belagavi Main Branch/)).getByText('Moved')).toBeInTheDocument();
    expect(within(folderLink(/^Rejected/)).getByText('Moved')).toBeInTheDocument();
    fireEvent.click(folderLink(/^Belagavi Main Branch/));
    expect(
      within(folderLink(new RegExp(`^${approved.applicationId} Ramesh Patil`))).getByText('Moved'),
    ).toBeInTheDocument();
  });

  it('is shown in the list view too, next to the name of the folder', () => {
    submitScenario('A');
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    const row = screen.getByRole('link', { name: 'Loans' }).closest('tr')!;
    expect(within(row).getByText('Moved')).toBeInTheDocument();
  });

  it('comes back after a reload, since it is kept, and is cleared by Reset demo', () => {
    submitScenario('A');
    const saved = localStorage.getItem('dms-home-loan-demo')!;
    expect(saved).toContain('"movedFolders":["Loans"');
    act(() => state().resetDemo());
    renderAt();
    expect(screen.queryByText('Moved')).not.toBeInTheDocument();
  });
});

describe('after a final approval', () => {
  it('has the files in the folder of the branch, with 04 Sanction and the Sanction Summary, as Filed', () => {
    const { id, applicationId } = submitScenario('A');
    approve(id);
    const folder = `Loans/Home Loan/Belagavi Main Branch (demo)/${applicationId} Ramesh Patil`;
    renderAt(open(folder));
    expect(folderLink(/^04 Sanction/)).toHaveTextContent('0 Folders, 1 file');
    fireEvent.click(folderLink(/^04 Sanction/));
    expect(
      screen.getByRole('button', { name: /^Sanction_Summary_Ramesh_Patil\.pdf/ }),
    ).toBeInTheDocument();
    // a filed file carries no badge: it is in its final place
    expect(screen.queryByText('Filed')).not.toBeInTheDocument();
    // and the folder of the application is no longer in Pending Approval
    expect(state().applications.find((a) => a.applicationId === applicationId)?.status).toBe(
      'Approved',
    );
  });
});
