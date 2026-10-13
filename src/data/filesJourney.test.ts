/**
 * The files along the journey of scenario A (13 documents): where each one is after the upload, the
 * submission, the Level 1 approval and the Level 2 approval; and after a rejection and a return. The
 * places are worked out from the status, so they have to follow every step of the store.
 */
import { buildFileSystem, fileRecordsOf, liveApplications } from './fileRecords';
import { STORAGE_KEY, useAppStore } from './store';
import { DEMO_USERS } from './users';
import { submitScenario } from '@/test/workflowHelpers';

const state = () => useAppStore.getState();

/** The files of the application with this ID as Files & Folders has them now. */
function filesOf(applicationId: string) {
  const live = liveApplications(state().applications, state().draft);
  return fileRecordsOf(live, state().favouriteFileIds).filter(
    (r) => r.applicationId === applicationId,
  );
}

/** "Loans / Home Loan / Pending Approval / HL-2026-0008 Ramesh Patil / 01 KYC" for each file. */
const placeOf = (r: { path: string[] }) => r.path.join('/');
const documents = (applicationId: string) =>
  filesOf(applicationId).filter((r) => r.docType !== 'Sanction Summary');

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('scenario A, step by step', () => {
  it('has 13 files in Drafts as soon as the scenario is filled, before anything is saved', () => {
    state().fillScenario('A');
    const id = state().draft.applicationId;
    expect(state().applications.some((a) => a.applicationId === id)).toBe(false); // not saved
    const files = filesOf(id);
    expect(files).toHaveLength(13);
    expect(files.every((r) => r.status === 'Draft')).toBe(true);
    expect(
      files.every((r) => placeOf(r).startsWith(`Loans/Home Loan/Drafts/${id} Ramesh Patil/`)),
    ).toBe(true);
    // the folder is in the tree, with its subfolders
    const fs = buildFileSystem(
      fileRecordsOf(liveApplications(state().applications, state().draft)),
    );
    expect(fs.folders.map((f) => f.id)).toContain(
      `Loans/Home Loan/Drafts/${id} Ramesh Patil/02 Income`,
    );
  });

  it('calls the folder "Draft {Application ID}" until a name is entered, then "{ID} {Name}"', () => {
    state().fillScenario('A');
    const id = state().draft.applicationId;
    state().updateDraft({ fullNameAsPerPan: '' });
    expect(placeOf(filesOf(id)[0])).toBe(`Loans/Home Loan/Drafts/Draft ${id}/01 KYC`);
    state().updateDraft({ fullNameAsPerPan: 'Ramesh Patil' });
    expect(placeOf(filesOf(id)[0])).toBe(`Loans/Home Loan/Drafts/${id} Ramesh Patil/01 KYC`);
  });

  it('takes a file away when its document is removed in the form', () => {
    state().fillScenario('A');
    const id = state().draft.applicationId;
    const gone = state().draft.documents.find((d) => d.docType === 'Income Proof')!;
    state().updateDraft({ documents: state().draft.documents.filter((d) => d.id !== gone.id) });
    const files = filesOf(id);
    expect(files).toHaveLength(12);
    expect(files.some((r) => r.id === gone.id)).toBe(false);
  });

  it('puts the 13 documents where the status puts them at every step', () => {
    const { id, applicationId } = submitScenario('A');
    const table: Record<string, string[]> = {};
    const folderOf = (r: { path: string[] }) => `${r.path[2]} / ${r.path.at(-1)}`;
    const snapshot = (step: string) => {
      const docs = documents(applicationId);
      expect(docs).toHaveLength(13);
      table[step] = docs.map((r) => `${r.fileName} -> ${folderOf(r)} [${r.status}]`);
      return docs;
    };

    // after the submission
    let docs = snapshot('submit');
    expect(
      docs.every((r) => r.path[2] === 'Pending Approval' && r.status === 'Pending approval'),
    ).toBe(true);
    expect(docs.every((r) => r.path[3] === `${applicationId} Ramesh Patil`)).toBe(true);

    // after Level 1: nothing moves
    const one = state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
    expect(one.ok).toBe(true);
    docs = snapshot('level 1');
    expect(
      docs.every((r) => r.path[2] === 'Pending Approval' && r.status === 'Pending approval'),
    ).toBe(true);

    // after Level 2: the folder of the branch, Filed, and the Sanction Summary
    const two = state().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
      sanctionedAmount: 1_500_000,
      sanctionDate: '2026-10-12',
    });
    expect(two.ok).toBe(true);
    docs = snapshot('level 2');
    expect(
      docs.every((r) => r.path[2] === 'Belagavi Main Branch (demo)' && r.status === 'Filed'),
    ).toBe(true);
    const all = filesOf(applicationId);
    expect(all).toHaveLength(14);
    expect(all.at(-1)).toMatchObject({ docType: 'Sanction Summary', status: 'Filed' });
    expect(all.at(-1)?.path.at(-1)).toBe('04 Sanction');

    // every document is in the subfolder of its group
    const sub = Object.fromEntries(docs.map((r) => [r.docType, r.path.at(-1)]));
    expect(sub).toMatchObject({
      'PAN Card': '01 KYC',
      'Aadhaar (Masked Copy)': '01 KYC',
      Photograph: '01 KYC',
      'Address Proof': '01 KYC',
      'Income Proof': '02 Income',
      'GST Certificate or Business Licence': '02 Income',
      'Surety Documents': '02 Income',
      'Sale or Gift Deed': '03 Property',
      'Records of Rights': '03 Property',
      'Encumbrance Certificate': '03 Property',
      'Building Permission': '03 Property',
      'Valuation Certificate': '03 Property',
      'Tax Paid Receipt': '03 Property',
    });
    expect(Object.keys(table)).toEqual(['submit', 'level 1', 'level 2']);
  });

  it('holds the files in Rejected after a rejection at Level 2', () => {
    const { id, applicationId } = submitScenario('A');
    state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
    const out = state().reject(id, DEMO_USERS.sunita, 'Repayment capacity is not enough.');
    expect(out.ok).toBe(true);
    const docs = documents(applicationId);
    expect(docs).toHaveLength(13);
    expect(docs.every((r) => r.path[2] === 'Rejected' && r.status === 'Rejected')).toBe(true);
    expect(filesOf(applicationId).some((r) => r.docType === 'Sanction Summary')).toBe(false);
  });

  it('keeps the files in Pending Approval, as Returned, after a return', () => {
    const { id, applicationId } = submitScenario('A');
    const out = state().returnForCorrection(
      id,
      DEMO_USERS.mahesh,
      'The Income Proof is not readable.',
    );
    expect(out.ok).toBe(true);
    const docs = documents(applicationId);
    expect(docs.every((r) => r.path[2] === 'Pending Approval' && r.status === 'Returned')).toBe(
      true,
    );
    // and after a resubmission, Pending approval again, in the same folder
    state().resubmit(id, DEMO_USERS.priya);
    const again = documents(applicationId);
    expect(
      again.every((r) => r.path[2] === 'Pending Approval' && r.status === 'Pending approval'),
    ).toBe(true);
  });
});

describe('the "Moved" marks', () => {
  it('start empty, and a submission marks the new folder and the folders above it', () => {
    expect(state().movedFolders).toEqual([]);
    const { applicationId } = submitScenario('A');
    expect(state().movedFolders).toEqual([
      'Loans',
      'Loans/Home Loan',
      'Loans/Home Loan/Pending Approval',
      `Loans/Home Loan/Pending Approval/${applicationId} Ramesh Patil`,
    ]);
  });

  it('a Level 1 approval, a return and a resubmission add no mark: nothing moves', () => {
    const { id } = submitScenario('A');
    const marks = state().movedFolders;
    state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
    expect(state().movedFolders).toEqual(marks);
    state().returnForCorrection(id, DEMO_USERS.sunita, 'Please correct the valuation.');
    expect(state().movedFolders).toEqual(marks);
    state().resubmit(id, DEMO_USERS.priya);
    expect(state().movedFolders).toEqual(marks);
  });

  it('the final approval marks the folder of the branch, a rejection marks Rejected', () => {
    const approved = submitScenario('A');
    state().approve(approved.id, DEMO_USERS.mahesh, 'Documents are in order.');
    state().approve(approved.id, DEMO_USERS.sunita, 'Sanctioned.', {
      sanctionedAmount: 1_500_000,
      sanctionDate: '2026-10-12',
    });
    expect(state().movedFolders).toContain(
      `Loans/Home Loan/Belagavi Main Branch (demo)/${approved.applicationId} Ramesh Patil`,
    );

    const rejected = submitScenario('B');
    state().reject(rejected.id, DEMO_USERS.mahesh, 'KYC does not match.');
    expect(state().movedFolders).toContain(
      `Loans/Home Loan/Rejected/${rejected.applicationId} Anita Desai`,
    );
  });

  it('drops the mark of the folder that the files left, when they move on', () => {
    const { id, applicationId } = submitScenario('A');
    const old = `Loans/Home Loan/Pending Approval/${applicationId} Ramesh Patil`;
    expect(state().movedFolders).toContain(old);
    state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
    state().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
      sanctionedAmount: 1_500_000,
      sanctionDate: '2026-10-12',
    });
    expect(state().movedFolders).not.toContain(old);
    expect(state().movedFolders).toContain(
      `Loans/Home Loan/Belagavi Main Branch (demo)/${applicationId} Ramesh Patil`,
    );
  });

  it('goes when the folder is opened, and only that folder', () => {
    submitScenario('A');
    const before = state().movedFolders;
    state().clearMovedFolder('Loans');
    expect(state().movedFolders).toEqual(before.filter((id) => id !== 'Loans'));
    state().clearMovedFolder('Loans'); // again: nothing to do
    state().clearMovedFolder('Loans/Not a folder');
    expect(state().movedFolders).toEqual(before.filter((id) => id !== 'Loans'));
  });

  it('is saved, read back, and cleared by Reset demo', async () => {
    submitScenario('A');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state;
    expect(saved.movedFolders).toHaveLength(4);
    useAppStore.setState({ movedFolders: [] });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
    await useAppStore.persist.rehydrate();
    expect(state().movedFolders).toHaveLength(4);
    state().resetDemo();
    expect(state().movedFolders).toEqual([]);
  });

  it('is read back as a list of text only: anything else in it is dropped, a repeat is kept once', async () => {
    const saved = { movedFolders: ['Loans', 7, null, 'Loans', { a: 1 }, 'Loans/Home Loan'] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
    await useAppStore.persist.rehydrate();
    expect(state().movedFolders).toEqual(['Loans', 'Loans/Home Loan']);
    state().resetDemo(); // a value that is not a list leaves what there is
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { movedFolders: 'Loans' }, version: 1 }),
    );
    await useAppStore.persist.rehydrate();
    expect(state().movedFolders).toEqual([]);
  });

  it('marks the branch folder when an administrator changes the branch of an approved record', () => {
    const approved = submitScenario('A');
    state().approve(approved.id, DEMO_USERS.mahesh, 'Documents are in order.');
    state().approve(approved.id, DEMO_USERS.sunita, 'Sanctioned.', {
      sanctionedAmount: 1_500_000,
      sanctionDate: '2026-10-12',
    });
    state().clearMovedFolder('Loans');
    const record = state().applications.find((a) => a.applicationId === approved.applicationId)!;
    const out = state().saveRecordEdit({
      applicationId: approved.applicationId,
      edited: { ...record, branch: 'Gokak Branch (demo)' },
      changes: [{ label: 'Branch', oldValue: record.branch, newValue: 'Gokak Branch (demo)' }],
      reason: 'The branch was wrong',
      user: DEMO_USERS.admin,
    });
    expect(out.ok).toBe(true);
    expect(state().movedFolders).toContain(
      `Loans/Home Loan/Gokak Branch (demo)/${approved.applicationId} Ramesh Patil`,
    );
    expect(documents(approved.applicationId)[0].path[2]).toBe('Gokak Branch (demo)');
  });
});

describe('the "Moved" marks that mean nothing any more', () => {
  const approveBoth = (id: string) => {
    state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
    state().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
      sanctionedAmount: 1_500_000,
      sanctionDate: '2026-10-12',
    });
  };

  it('drop the mark of Pending Approval when the last marked application has moved on, and keep the trail to the new folder', () => {
    const { id, applicationId } = submitScenario('A');
    expect(state().movedFolders).toContain('Loans/Home Loan/Pending Approval');
    approveBoth(id);
    expect(state().movedFolders).toEqual([
      'Loans',
      'Loans/Home Loan',
      'Loans/Home Loan/Belagavi Main Branch (demo)',
      `Loans/Home Loan/Belagavi Main Branch (demo)/${applicationId} Ramesh Patil`,
    ]);
  });

  it('keep the mark of Pending Approval while another marked application is still in it', () => {
    const first = submitScenario('A');
    const second = submitScenario('B');
    approveBoth(first.id);
    expect(state().movedFolders).toContain('Loans/Home Loan/Pending Approval');
    expect(state().movedFolders).toContain(
      `Loans/Home Loan/Pending Approval/${second.applicationId} Anita Desai`,
    );
  });

  it('go with the trail when an application folder is opened through a link: nothing is left above it', () => {
    const { id, applicationId } = submitScenario('A');
    approveBoth(id);
    state().clearMovedFolder(
      `Loans/Home Loan/Belagavi Main Branch (demo)/${applicationId} Ramesh Patil`,
    );
    expect(state().movedFolders).toEqual([]);
  });

  it('are followed down by opening the folders one by one: each is cleared, the ones below stay', () => {
    submitScenario('A');
    state().clearMovedFolder('Loans');
    expect(state().movedFolders).toHaveLength(3);
    state().clearMovedFolder('Loans/Home Loan');
    state().clearMovedFolder('Loans/Home Loan/Pending Approval');
    expect(state().movedFolders).toHaveLength(1);
    state().clearMovedFolder(state().movedFolders[0]);
    expect(state().movedFolders).toEqual([]);
  });

  it('go when the applicant is renamed: the old folder is gone, and a rename is not a move', () => {
    const { id, applicationId } = submitScenario('A');
    approveBoth(id);
    const record = state().applications.find((a) => a.applicationId === applicationId)!;
    const out = state().saveRecordEdit({
      applicationId,
      edited: {
        ...record,
        fullNameAsPerPan: 'Ramesh K Patil',
        propertyOwnerName: 'Ramesh K Patil',
      },
      changes: [
        { label: 'Full Name (as per PAN)', oldValue: 'Ramesh Patil', newValue: 'Ramesh K Patil' },
      ],
      reason: 'Name was incomplete',
      user: DEMO_USERS.admin,
    });
    expect(out.ok).toBe(true);
    expect(state().movedFolders).not.toContain(
      `Loans/Home Loan/Belagavi Main Branch (demo)/${applicationId} Ramesh Patil`,
    );
    expect(state().movedFolders).not.toContain(
      `Loans/Home Loan/Belagavi Main Branch (demo)/${applicationId} Ramesh K Patil`,
    );
    expect(state().movedFolders).toEqual([]);
  });
});

describe('the stars of the files', () => {
  it('stay on a file when it is moved by a status change, since its id does not change', () => {
    const { id, applicationId } = submitScenario('A');
    const first = documents(applicationId)[0];
    state().toggleFavouriteFile(first.id);
    expect(filesOf(applicationId).find((r) => r.id === first.id)?.favourite).toBe(true);
    state().approve(id, DEMO_USERS.mahesh, 'Documents are in order.');
    state().approve(id, DEMO_USERS.sunita, 'Sanctioned.', {
      sanctionedAmount: 1_500_000,
      sanctionDate: '2026-10-12',
    });
    const after = filesOf(applicationId).find((r) => r.id === first.id)!;
    expect(after.favourite).toBe(true);
    expect(after.path[2]).toBe('Belagavi Main Branch (demo)');
  });
});

describe('a star goes with its file', () => {
  const starPan = () => {
    const id = state().draft.applicationId;
    const pan = state().draft.documents.find((d) => d.docType === 'PAN Card')!;
    state().toggleFavouriteFile(pan.id);
    return { id, pan };
  };

  it('is gone when the draft that was never saved is replaced by a scenario, and the new file is not starred', () => {
    state().fillScenario('A');
    const { pan } = starPan();
    expect(state().favouriteFileIds).toEqual([pan.id]);
    state().fillScenario('B'); // the same Application ID again: the same document ids
    expect(state().favouriteFileIds).toEqual([]);
    const live = liveApplications(state().applications, state().draft);
    expect(fileRecordsOf(live, state().favouriteFileIds).some((r) => r.favourite)).toBe(false);
  });

  it('is gone when a new draft is started', () => {
    state().fillScenario('A');
    starPan();
    state().startNewDraft();
    expect(state().favouriteFileIds).toEqual([]);
  });

  it('is gone when the document is removed in the form, and stays when it is replaced', () => {
    state().fillScenario('A');
    const { pan } = starPan();
    state().updateDraft({
      documents: state().draft.documents.map((d) =>
        d.id === pan.id ? { ...d, fileName: 'PAN_new.pdf', version: 'v1.1' } : d,
      ),
    });
    expect(state().favouriteFileIds).toEqual([pan.id]); // the same file, the next version
    state().updateDraft({ documents: state().draft.documents.filter((d) => d.id !== pan.id) });
    expect(state().favouriteFileIds).toEqual([]);
  });

  it('stays when a saved application is left behind: its files are still there', () => {
    state().fillScenario('A');
    const { pan } = starPan();
    state().saveApplication(state().draft);
    state().fillScenario('B');
    expect(state().favouriteFileIds).toEqual([pan.id]);
  });
});
