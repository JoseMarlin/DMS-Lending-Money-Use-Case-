/**
 * The Files and Attachments panel of the record sheet, as a person uses it: the documents of the form
 * (status, folder link, preview, download), the attachments (attach, preview, remove), and in edit
 * mode Replace, Remove and Upload for the documents (saved with Save changes).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { attachmentsOf } from '@/data/attachments';
import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import { ApplicationStatus, type DemoUserId } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import RecordSheet from '../RecordSheet';
import { DEFAULT_SHEET_TAB, type SheetTabId } from '../recordSheetModel';

const state = () => useAppStore.getState();
const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ, , PRAKASH] = SEED_APPLICATIONS;

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function Harness({ applicationId }: { applicationId: string }) {
  const [tab, setTab] = useState<SheetTabId>(DEFAULT_SHEET_TAB);
  return (
    <MemoryRouter>
      <ToastProvider>
        <Probe />
        <RecordSheet
          applicationId={applicationId}
          tab={tab}
          onTabChange={setTab}
          onClose={() => {}}
        />
      </ToastProvider>
    </MemoryRouter>
  );
}

const draw = (applicationId: string, user: DemoUserId = 'priya') => {
  act(() => state().setCurrentUser(user));
  const view = render(<Harness applicationId={applicationId} />);
  // the Files panel is the one under test
  fireEvent.click(screen.getByRole('button', { name: /^Files and Attachments/ }));
  return view;
};

const sheet = () => screen.getByRole('dialog', { name: /, record$/ });
const header = () => within(sheet()).getByRole('banner');
const panel = () => screen.getByTestId('record-side-panel');
const documents = () => within(panel()).getByRole('list', { name: 'Documents of the application' });
const attachments = () => within(panel()).queryByRole('list', { name: 'Attachments' });
const rowOf = (text: string) =>
  within(panel())
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(text))!;
const menu = (row: HTMLElement) => within(row).getByRole('button', { name: /^More actions for / });
const choose = (row: HTMLElement, item: string) => {
  fireEvent.click(menu(row));
  fireEvent.click(within(row).getByRole('menuitem', { name: item }));
};
const file = (name: string, size = 1000, type = 'application/pdf') =>
  new File([new Uint8Array(size)], name, { type });
const startEdit = () => fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
const save = () => fireEvent.click(within(header()).getByRole('button', { name: 'Save changes' }));
const goTo = (name: string) =>
  fireEvent.click(within(sheet()).getByRole('tab', { name: new RegExp(`^${name}`) }));
const stored = (id: string) => state().applications.find((a) => a.applicationId === id)!;
const eventsOf = (id: string) => state().auditEvents.filter((e) => e.applicationId === id);
const attach = (f: File) =>
  fireEvent.change(screen.getByTestId('record-attach-input'), { target: { files: [f] } });
const replaceWith = (f: File) =>
  fireEvent.change(screen.getByTestId('record-replace-input'), { target: { files: [f] } });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-1');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('the panel', () => {
  it('has the title Files and Attachments and the two groups with their counts', () => {
    draw(VIJAY.applicationId);
    expect(
      within(panel()).getByRole('heading', { level: 3, name: 'Files and Attachments' }),
    ).toBeInTheDocument();
    expect(
      within(panel()).getByRole('heading', { level: 4, name: /^Application documents/ }),
    ).toBeInTheDocument();
    expect(within(panel()).getByLabelText('12 of 12 documents uploaded')).toHaveTextContent('12');
    expect(
      within(panel()).getByRole('heading', { level: 4, name: /^Other attachments/ }),
    ).toBeInTheDocument();
    expect(within(panel()).getByLabelText('2 attachments')).toHaveTextContent('2');
  });

  it('has a row for each document, with the file, the DocType, the status and the folder as a link', () => {
    draw(VIJAY.applicationId);
    expect(within(documents()).getAllByRole('listitem')).toHaveLength(12);
    const row = rowOf('PAN_Card_Vijay_Kulkarni.pdf');
    expect(within(row).getByText('PAN Card')).toBeInTheDocument();
    expect(within(row).getByText('v1.0')).toBeInTheDocument();
    expect(within(row).getByText('Filed')).toBeInTheDocument();
    const link = within(row).getByRole('link');
    expect(link).toHaveTextContent('... / 01 KYC');
    expect(link).toHaveAttribute(
      'href',
      '/files?folder=' +
        encodeURIComponent(
          'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0001 Vijay Kulkarni/01 KYC',
        ),
    );
    expect(link).toHaveAttribute(
      'title',
      expect.stringContaining('HL-2026-0001 Vijay Kulkarni / 01 KYC'),
    );
  });

  it.each([
    ['approved: Filed', VIJAY, 'Filed', 'Belagavi Main Branch'],
    ['in Level 2: Pending approval', SHOBHA, 'Pending approval', 'Pending Approval'],
    ['returned: Returned', SAVITA, 'Returned', 'Pending Approval'],
    ['rejected: Rejected', BASAVARAJ, 'Rejected', 'Rejected'],
    ['a draft: Draft', PRAKASH, 'Draft', 'Drafts'],
  ])('shows the status and the folder of a record that is %s', (_name, app, chip, folder) => {
    draw(app.applicationId);
    const row = within(documents()).getAllByRole('listitem')[0];
    expect(within(row).getByText(chip)).toBeInTheDocument();
    expect(within(row).getByRole('link')).toHaveAttribute('title', expect.stringContaining(folder));
  });

  it('shows a document that is missing as Not uploaded, required, with a Missing chip', () => {
    draw(PRAKASH.applicationId);
    expect(within(panel()).getByLabelText('3 of 12 documents uploaded')).toHaveTextContent(
      '3 of 12',
    );
    const row = rowOf('Address Proof');
    expect(within(row).getByText('Not uploaded, required')).toBeInTheDocument();
    expect(within(row).getByText('Missing')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Upload/ })).toBeNull(); // only while editing
  });

  it('opens a preview with the file, its folder and its status, and closes it', () => {
    draw(VIJAY.applicationId);
    choose(rowOf('PAN_Card_Vijay_Kulkarni.pdf'), 'Preview');
    const dialog = screen.getByRole('dialog', { name: 'PAN_Card_Vijay_Kulkarni.pdf' });
    expect(dialog).toHaveTextContent(
      'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 01 KYC',
    );
    expect(dialog).toHaveTextContent('Filed');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.queryByRole('dialog', { name: 'PAN_Card_Vijay_Kulkarni.pdf' })).toBeNull();
  });

  it('offers Download, which gives a placeholder file and says so', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    draw(VIJAY.applicationId);
    choose(rowOf('PAN_Card_Vijay_Kulkarni.pdf'), 'Download');
    expect(click).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('Downloaded a placeholder for PAN_Card_Vijay_Kulkarni.pdf'),
    ).toBeInTheDocument();
  });

  it('has no Replace or Remove in view mode', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(menu(rowOf('PAN_Card_Vijay_Kulkarni.pdf')));
    const items = within(rowOf('PAN_Card_Vijay_Kulkarni.pdf'))
      .getAllByRole('menuitem')
      .map((i) => i.textContent);
    expect(items).toEqual(['Preview', 'Download']);
  });
});

describe('the attachments', () => {
  it('are listed with their note, the person and the time, the status and the folder (05 Other)', () => {
    draw(VIJAY.applicationId);
    const row = rowOf('Salary_Slip_Aug.pdf');
    expect(
      within(row).getByText('Latest salary slip, added after the first upload'),
    ).toBeInTheDocument();
    expect(within(row).getByText('Priya Kulkarni · 19 Aug 2026, 11:00 AM')).toBeInTheDocument();
    expect(within(row).getByText('Filed')).toBeInTheDocument();
    expect(within(row).getByRole('link')).toHaveTextContent('... / 05 Other');
    expect(within(attachments()!).getAllByRole('listitem')).toHaveLength(2);
  });

  it('say "No attachments yet" for an application with none', () => {
    act(() => {
      const app = {
        ...state().applications.find((a) => a.applicationId === PRAKASH.applicationId)!,
      };
      state().saveApplication({
        ...app,
        documents: app.documents.filter((d) => d.docType !== 'Supporting Document'),
      });
    });
    draw(PRAKASH.applicationId);
    expect(within(panel()).getByText('No attachments yet')).toBeInTheDocument();
    expect(attachments()).toBeNull();
  });

  it('are previewed with their note', () => {
    draw(VIJAY.applicationId);
    choose(rowOf('Salary_Slip_Aug.pdf'), 'Preview');
    const dialog = screen.getByRole('dialog', { name: 'Salary_Slip_Aug.pdf' });
    expect(dialog).toHaveTextContent('Note');
    expect(dialog).toHaveTextContent('Latest salary slip, added after the first upload');
    expect(dialog).toHaveTextContent('Supporting Document');
  });

  describe('Attach file', () => {
    it('opens a dialog after a file is chosen, with its name, type and size and a note that is optional', () => {
      draw(VIJAY.applicationId);
      expect(screen.queryByRole('dialog', { name: 'Attach file' })).toBeNull();
      attach(file('Bank_Statement.pdf', 2048));
      const dialog = screen.getByRole('dialog', { name: 'Attach file' });
      expect(dialog).toHaveTextContent('Bank_Statement.pdf');
      expect(dialog).toHaveTextContent('PDF document');
      expect(dialog).toHaveTextContent('2 KB');
      expect(within(dialog).getByRole('textbox', { name: 'Note (optional)' })).toBeInTheDocument();
    });

    it('adds the attachment as the user who is acting, with the note, shows it, writes the event, and says so', () => {
      draw(VIJAY.applicationId);
      attach(file('Bank_Statement.pdf', 2048));
      const dialog = screen.getByRole('dialog', { name: 'Attach file' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Note (optional)' }), {
        target: { value: 'Last six months' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Attach' }));
      expect(screen.queryByRole('dialog', { name: 'Attach file' })).toBeNull();
      const row = rowOf('Bank_Statement.pdf');
      expect(within(row).getByText('Last six months')).toBeInTheDocument();
      expect(within(row).getByText(/^Priya Kulkarni · /)).toBeInTheDocument();
      expect(within(panel()).getByLabelText('3 attachments')).toBeInTheDocument();
      expect(screen.getByText('Attached Bank_Statement.pdf')).toBeInTheDocument();
      const added = attachmentsOf(stored('HL-2026-0001').documents).at(-1)!;
      expect(added).toMatchObject({
        fileName: 'Bank_Statement.pdf',
        note: 'Last six months',
        docType: 'Supporting Document',
      });
      expect(eventsOf('HL-2026-0001').at(-1)).toMatchObject({
        event: 'Attachment added',
        newValue: 'Bank_Statement.pdf',
        comment: 'Last six months',
      });
    });

    it('takes no note: the field is optional', () => {
      draw(VIJAY.applicationId);
      attach(file('Bill.png', 500, 'image/png'));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
          name: 'Attach',
        }),
      );
      const row = rowOf('Bill.png');
      expect(row).toBeInTheDocument();
      expect(attachmentsOf(stored('HL-2026-0001').documents).at(-1)).not.toHaveProperty('note');
    });

    it('takes a Word document, with its own icon', () => {
      draw(VIJAY.applicationId);
      attach(
        file(
          'Notes.docx',
          500,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      );
      expect(screen.getByRole('dialog', { name: 'Attach file' })).toHaveTextContent(
        'Word document',
      );
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
          name: 'Attach',
        }),
      );
      expect(rowOf('Notes.docx')).toBeInTheDocument();
    });

    it('refuses a type that is not allowed, and a file over 5 MB, with the reason and no dialog', () => {
      draw(VIJAY.applicationId);
      attach(file('Setup.exe', 100, 'application/x-msdownload'));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Attach a PDF, JPG, PNG or DOCX up to 5 MB',
      );
      expect(screen.queryByRole('dialog', { name: 'Attach file' })).toBeNull();
      attach(file('Huge.pdf', 5 * 1024 * 1024 + 1));
      expect(screen.getByRole('alert')).toHaveTextContent('up to 5 MB');
      expect(screen.queryByRole('dialog', { name: 'Attach file' })).toBeNull();
      expect(attachmentsOf(stored('HL-2026-0001').documents)).toHaveLength(2);
    });

    it('is cancelled with Cancel and with Escape, and nothing is added', () => {
      draw(VIJAY.applicationId);
      attach(file('Bill.pdf'));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
          name: 'Cancel',
        }),
      );
      expect(screen.queryByRole('dialog', { name: 'Attach file' })).toBeNull();
      attach(file('Bill.pdf'));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Attach file' })).toBeNull();
      expect(sheet()).toBeInTheDocument();
      expect(attachmentsOf(stored('HL-2026-0001').documents)).toHaveLength(2);
    });

    it('stops a note at 200 characters, and counts them', () => {
      draw(VIJAY.applicationId);
      attach(file('Bill.pdf'));
      const box = within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('textbox', {
        name: 'Note (optional)',
      });
      expect(box).toHaveAttribute('maxlength', '200');
      fireEvent.change(box, { target: { value: 'abc' } });
      expect(screen.getByText('3 of 200')).toBeInTheDocument();
    });

    it('masks an Aadhaar number typed into the note, in the record and the trail', () => {
      draw(VIJAY.applicationId);
      attach(file('Bill.pdf'));
      const dialog = screen.getByRole('dialog', { name: 'Attach file' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Note (optional)' }), {
        target: { value: 'Card 2345 0007 4821' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Attach' }));
      expect(document.body.textContent).not.toMatch(/2345\s?0007/);
      expect(JSON.stringify(state().auditEvents)).not.toMatch(/2345\s?0007/);
      expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(/2345\s?0007/);
    });

    it('is available in every status, to a Branch Manager too', () => {
      draw(SHOBHA.applicationId, 'mahesh');
      attach(file('Letter.pdf'));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
          name: 'Attach',
        }),
      );
      expect(within(rowOf('Letter.pdf')).getByText(/^Mahesh Joshi · /)).toBeInTheDocument();
    });

    it('shows up in Files & Folders under 05 Other of the application, with the right status', () => {
      draw(SHOBHA.applicationId);
      attach(file('Letter.pdf'));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
          name: 'Attach',
        }),
      );
      const link = within(rowOf('Letter.pdf')).getByRole('link');
      expect(link).toHaveAttribute(
        'title',
        'Loans / Home Loan / Pending Approval / HL-2026-0002 Shobha Gaonkar / 05 Other',
      );
      expect(within(rowOf('Letter.pdf')).getByText('Pending approval')).toBeInTheDocument();
    });
  });

  describe('Remove', () => {
    it('is in the menu of the attachments of the user who is acting, and asks first', () => {
      draw(VIJAY.applicationId);
      choose(rowOf('Electricity_Bill.pdf'), 'Remove');
      const dialog = screen.getByRole('dialog', { name: 'Remove this attachment?' });
      expect(dialog).toHaveTextContent('Electricity_Bill.pdf');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep attachment' }));
      expect(screen.queryByRole('dialog', { name: 'Remove this attachment?' })).toBeNull();
      expect(attachmentsOf(stored('HL-2026-0001').documents)).toHaveLength(2);
    });

    it('removes it on Remove attachment: gone from the panel and the record, with the event and a toast', () => {
      draw(VIJAY.applicationId);
      choose(rowOf('Electricity_Bill.pdf'), 'Remove');
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Remove this attachment?' })).getByRole(
          'button',
          { name: 'Remove attachment' },
        ),
      );
      expect(within(panel()).queryByText('Electricity_Bill.pdf')).toBeNull();
      expect(attachmentsOf(stored('HL-2026-0001').documents).map((d) => d.fileName)).toEqual([
        'Salary_Slip_Aug.pdf',
      ]);
      expect(eventsOf('HL-2026-0001').at(-1)).toMatchObject({
        event: 'Attachment removed',
        oldValue: 'Electricity_Bill.pdf',
      });
      expect(screen.getByText('Removed Electricity_Bill.pdf')).toBeInTheDocument();
    });

    it('is not offered to a person who did not attach the file, and is to the administrator', () => {
      draw(VIJAY.applicationId, 'mahesh');
      fireEvent.click(menu(rowOf('Electricity_Bill.pdf')));
      expect(
        within(rowOf('Electricity_Bill.pdf'))
          .getAllByRole('menuitem')
          .map((i) => i.textContent),
      ).toEqual(['Preview', 'Download']);
    });

    it('is offered to the administrator for any attachment', () => {
      draw(MANJUNATH.applicationId, 'admin'); // attached by the officer of Gokak
      choose(rowOf('Salary_Slip_Sept.pdf'), 'Remove');
      expect(screen.getByRole('dialog', { name: 'Remove this attachment?' })).toBeInTheDocument();
    });

    it('puts the cursor in a sensible place and keeps the sheet open', () => {
      draw(VIJAY.applicationId);
      choose(rowOf('Electricity_Bill.pdf'), 'Remove');
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Remove this attachment?' })).getByRole(
          'button',
          { name: 'Remove attachment' },
        ),
      );
      expect(sheet()).toBeInTheDocument();
    });
  });
});

describe('edit mode', () => {
  it('adds Replace and Remove to the menu of a document, and Upload to one that is missing', () => {
    draw(PRAKASH.applicationId);
    startEdit();
    fireEvent.click(menu(rowOf('PAN_Card_Prakash_Naik.pdf')));
    expect(
      within(rowOf('PAN_Card_Prakash_Naik.pdf'))
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Preview', 'Download', 'Replace', 'Remove']);
    expect(
      within(rowOf('Address Proof')).getByRole('button', { name: 'Upload Address Proof' }),
    ).toBeInTheDocument();
  });

  it('replaces a document with the next version, shown as not saved yet, and saves it with Save changes', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('PAN_Card_Savita_Patil_New.pdf', 2000));
    const row = rowOf('PAN_Card_Savita_Patil_New.pdf');
    expect(within(row).getByText('v1.1')).toBeInTheDocument();
    expect(within(row).getByText('New version v1.1, not saved yet')).toBeInTheDocument();
    // not in the store yet
    expect(
      stored('HL-2026-0004').documents.some((d) => d.fileName === 'PAN_Card_Savita_Patil_New.pdf'),
    ).toBe(false);
    save();
    const saved = stored('HL-2026-0004').documents.find((d) => d.docType === 'PAN Card')!;
    expect(saved).toMatchObject({
      fileName: 'PAN_Card_Savita_Patil_New.pdf',
      version: 'v1.1',
      id: SAVITA.documents.find((d) => d.docType === 'PAN Card')!.id,
    });
    expect(stored('HL-2026-0004').documents.filter((d) => d.docType === 'PAN Card')).toHaveLength(
      1,
    );
    const event = eventsOf('HL-2026-0004').at(-1)!;
    expect(event).toMatchObject({
      event: 'Document replaced',
      field: 'PAN Card',
      oldValue: 'PAN_Card_Savita_Patil.pdf',
      newValue: 'PAN_Card_Savita_Patil_New.pdf (v1.1)',
    });
    expect(screen.getByText('Changes saved: 1 document updated')).toBeInTheDocument();
  });

  it('counts the version from the saved file: choosing twice before Save is still v1.1', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('First.pdf'));
    choose(rowOf('First.pdf'), 'Replace');
    replaceWith(file('Second.pdf'));
    expect(within(rowOf('Second.pdf')).getByText('v1.1')).toBeInTheDocument();
  });

  it('refuses a replacement that is not a PDF, JPG or PNG, or is over 5 MB, and keeps the file', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(
      file(
        'Notes.docx',
        100,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    );
    expect(
      within(rowOf('PAN_Card_Savita_Patil.pdf')).getByText('Upload PDF, JPG or PNG up to 5 MB'),
    ).toBeInTheDocument();
    expect(within(rowOf('PAN_Card_Savita_Patil.pdf')).getByText('v1.0')).toBeInTheDocument();
  });

  it('blocks Remove of a required document with the reason, and changes nothing', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Remove');
    expect(
      within(rowOf('PAN_Card_Savita_Patil.pdf')).getByText('This document is required'),
    ).toBeInTheDocument();
    expect(within(documents()).getAllByRole('listitem')).toHaveLength(12);
  });

  it('removes a document that the form does not ask for (the GST certificate of an applicant who is no longer a business)', () => {
    // Savita is an agriculturist: give her a GST certificate that the form does not ask for
    act(() => {
      const app = stored('HL-2026-0004');
      state().saveApplication({
        ...app,
        documents: [
          ...app.documents,
          {
            id: 'HL-2026-0004-gst',
            docType: 'GST Certificate or Business Licence',
            fileName: 'GST.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1000,
            uploadedAt: app.createdAt,
            uploadedBy: 'Priya Kulkarni',
          },
        ],
      });
    });
    draw(SAVITA.applicationId);
    startEdit();
    expect(
      within(rowOf('GST.pdf')).getByText('GST Certificate or Business Licence'),
    ).toBeInTheDocument();
    choose(rowOf('GST.pdf'), 'Remove');
    expect(within(panel()).queryByText('GST.pdf')).toBeNull();
    save();
    expect(stored('HL-2026-0004').documents.some((d) => d.fileName === 'GST.pdf')).toBe(false);
    expect(eventsOf('HL-2026-0004').at(-1)).toMatchObject({
      event: 'Document removed',
      field: 'GST Certificate or Business Licence',
      oldValue: 'GST.pdf',
      newValue: '',
    });
  });

  it('is not saved when it is cancelled: the replaced file is as it was, and the link to the new one is freed', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('Other.pdf'));
    fireEvent.click(within(header()).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', {
        name: 'Discard changes',
      }),
    );
    expect(within(panel()).getByText('PAN_Card_Savita_Patil.pdf')).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });

  it('makes a change to a document only a change: Cancel is asked, and a save with only that writes only that event', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('Other.pdf'));
    fireEvent.click(within(header()).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', {
        name: 'Keep editing',
      }),
    );
    const before = eventsOf('HL-2026-0004').length;
    save();
    expect(eventsOf('HL-2026-0004')).toHaveLength(before + 1);
  });

  it('asks the administrator for a reason when a document of an approved record is replaced', () => {
    draw(VIJAY.applicationId, 'admin');
    startEdit();
    choose(rowOf('PAN_Card_Vijay_Kulkarni.pdf'), 'Replace');
    replaceWith(file('PAN_new.pdf'));
    save();
    const reason = screen.getByRole('dialog', { name: 'Reason for change' });
    fireEvent.change(within(reason).getByRole('textbox', { name: /^Reason for change/ }), {
      target: { value: 'The first scan was blurred' },
    });
    fireEvent.click(within(reason).getByRole('button', { name: 'Save changes' }));
    const doc = stored('HL-2026-0001').documents.find((d) => d.docType === 'PAN Card')!;
    expect(doc).toMatchObject({ fileName: 'PAN_new.pdf', version: 'v1.1' });
    // the filing data follows the file, so the record still says it is filed
    expect(doc.filing?.docTypeTag).toBe('PAN Card');
    expect(eventsOf('HL-2026-0001').at(-1)).toMatchObject({
      event: 'Document replaced',
      comment: 'The first scan was blurred',
    });
    // and the file is still Filed in its folder
    expect(within(rowOf('PAN_new.pdf')).getByText('Filed')).toBeInTheDocument();
  });

  it('keeps the attachments added while editing: the save does not drop them', () => {
    draw(SAVITA.applicationId);
    startEdit();
    attach(file('Late_Bill.pdf'));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
        name: 'Attach',
      }),
    );
    goTo('Applicant');
    fireEvent.change(within(sheet()).getByLabelText(/^Mobile/), {
      target: { value: '9000000001' },
    });
    fireEvent.blur(within(sheet()).getByLabelText(/^Mobile/));
    save();
    expect(attachmentsOf(stored('HL-2026-0004').documents).map((d) => d.fileName)).toContain(
      'Late_Bill.pdf',
    );
    expect(stored('HL-2026-0004').mobile).toBe('9000000001');
  });

  describe('a document that is missing', () => {
    it('is uploaded with Upload as a new file (v1.0), not saved yet, and saved as "Document uploaded"', () => {
      draw(PRAKASH.applicationId);
      startEdit();
      fireEvent.click(
        within(rowOf('Address Proof')).getByRole('button', { name: 'Upload Address Proof' }),
      );
      replaceWith(file('Address_Proof_Bill.pdf'));
      const row = rowOf('Address_Proof_Bill.pdf');
      expect(within(row).getByText('v1.0')).toBeInTheDocument();
      expect(within(row).getByText('New file, not saved yet')).toBeInTheDocument();
      expect(within(panel()).getByLabelText('4 of 12 documents uploaded')).toBeInTheDocument();
    });

    it('stops the save, opens the Files panel and puts the cursor on the Upload button of the first missing document', () => {
      draw(PRAKASH.applicationId);
      // make everything else valid: tick the consent
      startEdit();
      goTo('Identity');
      fireEvent.click(within(sheet()).getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Comments' })); // another panel is on
      save();
      expect(
        screen.getByRole('button', { name: /^Files and Attachments, has errors/ }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(within(panel()).getAllByRole('alert').length).toBe(9);
      expect(within(rowOf('Address Proof')).getByRole('alert')).toHaveTextContent(
        'Upload Address Proof',
      );
      expect(screen.getByRole('button', { name: 'Upload Address Proof' })).toHaveFocus();
      expect(screen.getByTestId('rail-alert-files')).toBeInTheDocument();
      expect(stored('HL-2026-0007').consentGiven).toBe(false); // nothing was saved
    });

    it('is saved once the missing documents are there', () => {
      draw(PRAKASH.applicationId);
      startEdit();
      goTo('Identity');
      fireEvent.click(within(sheet()).getByRole('checkbox'));
      const missing = [
        'Address Proof',
        'Income Proof',
        'Surety Documents',
        'Sale or Gift Deed',
        'Records of Rights',
        'Encumbrance Certificate',
        'Building Permission',
        'Valuation Certificate',
        'Tax Paid Receipt',
      ];
      for (const docType of missing) {
        fireEvent.click(within(rowOf(docType)).getByRole('button', { name: `Upload ${docType}` }));
        replaceWith(file(`${docType.replace(/\W+/g, '_')}.pdf`));
      }
      expect(within(panel()).getByLabelText('12 of 12 documents uploaded')).toBeInTheDocument();
      save();
      // a draft that is saved from the sheet needs its checks first (an identity field was not changed): it saves
      const after = stored('HL-2026-0007');
      expect(after.documents.filter((d) => d.docType !== 'Supporting Document')).toHaveLength(12);
      expect(eventsOf('HL-2026-0007').filter((e) => e.event === 'Document uploaded')).toHaveLength(
        9 + 0,
      );
      expect(
        screen.getByText(/Changes saved: \d+ fields? and 9 documents updated/),
      ).toBeInTheDocument();
    });
  });
});

describe('leaving the sheet by a folder link', () => {
  it('goes to Files & Folders at once when nothing was changed', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(within(rowOf('PAN_Card_Vijay_Kulkarni.pdf')).getByRole('link'));
    expect(screen.getByTestId('location').textContent).toMatch(/^\/files\?folder=/);
  });

  it('asks first when there are unsaved changes: Keep editing stays, Discard changes goes on', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('Other.pdf'));
    fireEvent.click(within(rowOf('Other.pdf')).getByRole('link'));
    expect(screen.getByTestId('location').textContent).toBe('/');
    const dialog = screen.getByRole('dialog', { name: 'Discard your changes?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByTestId('location').textContent).toBe('/');
    fireEvent.click(within(rowOf('Other.pdf')).getByRole('link'));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', {
        name: 'Discard changes',
      }),
    );
    expect(screen.getByTestId('location').textContent).toMatch(/^\/files\?folder=/);
  });
});

describe('the live updates', () => {
  it('follows a final approval: the files are Filed, in the folder of the branch, and the Sanction folder is not a document', async () => {
    const instance = state().workflowInstances.find(
      (i) => i.applicationId === SHOBHA.applicationId,
    )!;
    draw(SHOBHA.applicationId);
    expect(within(documents()).getAllByText('Pending approval')).toHaveLength(13);
    act(() => {
      const out = state().approve(instance.id, DEMO_USERS.sunita, 'Sanctioned.', {
        sanctionedAmount: Math.min(1_000_000, stored('HL-2026-0002').eligibleAmount ?? 1_000_000),
        sanctionDate: '2026-10-12',
      });
      if (!out.ok) throw new Error(out.error);
    });
    await waitFor(() => expect(within(documents()).getAllByText('Filed')).toHaveLength(13));
    expect(within(documents()).getAllByRole('link')[0]).toHaveAttribute(
      'title',
      expect.stringContaining('Belagavi Main Branch (demo)'),
    );
    expect(stored('HL-2026-0002').status).toBe(ApplicationStatus.Approved);
  });
});

describe('what the review found', () => {
  const tickConsent = () => {
    goTo('Identity');
    fireEvent.click(within(sheet()).getByRole('checkbox'));
  };
  const GST = {
    id: 'HL-2026-0004-gst',
    docType: 'GST Certificate or Business Licence' as const,
    fileName: 'GST.pdf',
    mimeType: 'application/pdf' as const,
    sizeBytes: 1000,
    uploadedBy: 'Priya Kulkarni',
  };
  const giveSavitaAGstCertificate = () =>
    act(() => {
      const app = stored('HL-2026-0004');
      state().saveApplication({
        ...app,
        documents: [...app.documents, { ...GST, uploadedAt: app.createdAt }],
      });
    });

  it('offers Resubmit for approval after only a document of a returned record was replaced', () => {
    draw(SAVITA.applicationId);
    expect(
      within(header()).queryByRole('button', { name: /Resubmit for approval/ }),
    ).not.toBeInTheDocument();
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('PAN_Card_Savita_Patil_v2.pdf'));
    save();
    expect(
      within(header()).getByRole('button', { name: /Resubmit for approval/ }),
    ).toBeInTheDocument();
  });

  it('does not keep what was said about a row after Save: the file that replaced it is the file', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('PAN_new.pdf'));
    expect(
      within(panel()).getAllByText(/will replace the file when the changes are saved/).length,
    ).toBeGreaterThan(0);
    save();
    expect(within(panel()).queryByText(/will replace the file/)).toBeNull();
    expect(within(panel()).queryByText(/not saved yet/)).toBeNull();
  });

  it('does not keep it after Cancel and Discard either, nor "This document is required" in view mode', () => {
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
    replaceWith(file('Other.pdf'));
    choose(rowOf('Aadhaar_Masked_Copy'), 'Remove');
    expect(within(panel()).getAllByText('This document is required').length).toBeGreaterThan(0);
    fireEvent.click(within(header()).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', {
        name: 'Discard changes',
      }),
    );
    expect(within(panel()).queryByText(/will replace the file/)).toBeNull();
    expect(within(panel()).queryByText('This document is required')).toBeNull();
    // and a second edit starts clean
    startEdit();
    expect(within(panel()).queryByText(/will replace the file/)).toBeNull();
  });

  describe('an Aadhaar number in the name of a file', () => {
    const NAME = 'Aadhaar_234500074821_scan.pdf';

    it('is masked in the Attach dialog, the toast and the row, never shown whole', () => {
      draw(VIJAY.applicationId);
      attach(file(NAME));
      expect(screen.getByRole('dialog', { name: 'Attach file' })).toHaveTextContent(
        'XXXX XXXX 4821',
      );
      expect(document.body.textContent).not.toMatch(/2345\s?0007/);
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
          name: 'Attach',
        }),
      );
      expect(document.body.textContent).not.toMatch(/2345\s?0007/);
      expect(rowOf('XXXX XXXX 4821')).toBeInTheDocument();
    });

    it('is masked in the note of a replacement, and in the row, before Save', () => {
      draw(SAVITA.applicationId);
      startEdit();
      choose(rowOf('PAN_Card_Savita_Patil.pdf'), 'Replace');
      replaceWith(file(NAME));
      expect(document.body.textContent).not.toMatch(/2345\s?0007/);
      expect(
        within(panel()).getAllByText(/XXXX XXXX 4821.* will replace the file/).length,
      ).toBeGreaterThan(0);
    });
  });

  it('keeps the folder links to the folders that exist: an unsaved name has no folder yet', () => {
    draw(PRAKASH.applicationId);
    startEdit();
    goTo('Applicant');
    const name = within(sheet()).getByLabelText(/^Full Name \(as per PAN\)/);
    fireEvent.change(name, { target: { value: 'Prakash Naik Junior' } });
    fireEvent.blur(name);
    const link = within(rowOf('PAN_Card_Prakash_Naik.pdf')).getByRole('link');
    expect(link.getAttribute('title')).toContain('HL-2026-0007 Prakash Naik / 01 KYC');
    expect(link.getAttribute('title')).not.toContain('Junior');
  });

  describe('a blocked Save', () => {
    it('moves the cursor to the first missing document each time, not only the first', () => {
      draw(PRAKASH.applicationId);
      startEdit();
      tickConsent();
      save();
      expect(screen.getByRole('button', { name: 'Upload Address Proof' })).toHaveFocus();
      within(header()).getByRole('button', { name: 'Save changes' }).focus();
      save();
      expect(screen.getByRole('button', { name: 'Upload Address Proof' })).toHaveFocus();
    });

    it('says so in a banner even when the documents are the only problem', () => {
      draw(PRAKASH.applicationId);
      startEdit();
      tickConsent();
      save();
      expect(screen.getByText('The changes were not saved')).toBeInTheDocument();
      expect(
        screen.getByText(/9 fields need attention: Files and Attachments \(9\)/),
      ).toBeInTheDocument();
    });
  });

  describe('the cursor after a row goes', () => {
    it('is on Attach file after an attachment is removed', () => {
      draw(VIJAY.applicationId);
      choose(rowOf('Electricity_Bill.pdf'), 'Remove');
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Remove this attachment?' })).getByRole(
          'button',
          { name: 'Remove attachment' },
        ),
      );
      expect(within(panel()).getByRole('button', { name: 'Attach file' })).toHaveFocus();
    });

    it('is on the menu of the file after a missing document was uploaded', () => {
      draw(PRAKASH.applicationId);
      startEdit();
      fireEvent.click(
        within(rowOf('Address Proof')).getByRole('button', { name: 'Upload Address Proof' }),
      );
      replaceWith(file('Bill.pdf'));
      expect(
        within(rowOf('Bill.pdf')).getByRole('button', { name: /^More actions for / }),
      ).toHaveFocus();
    });

    it('is on Attach file after a document that is not required was removed', () => {
      giveSavitaAGstCertificate();
      draw(SAVITA.applicationId);
      startEdit();
      choose(rowOf('GST.pdf'), 'Remove');
      expect(within(panel()).getByRole('button', { name: 'Attach file' })).toHaveFocus();
    });
  });

  it('frees the local link of a file that was chosen and then removed before Save', () => {
    giveSavitaAGstCertificate();
    draw(SAVITA.applicationId);
    startEdit();
    choose(rowOf('GST.pdf'), 'Replace');
    replaceWith(file('GST_new.pdf'));
    choose(rowOf('GST_new.pdf'), 'Remove');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });
});
