import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { STORAGE_KEY, useAppStore } from '@/data/store';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();
const field = (label: string | RegExp) => screen.getByLabelText(label);
const MB = 1024 * 1024;
const ERROR_TEXT = 'Upload PDF, JPG or PNG up to 5 MB';

function renderBare() {
  return render(
    <MemoryRouter>
      <ApplyPage />
    </MemoryRouter>,
  );
}

function renderPage() {
  const view = renderBare();
  // the sections are accordions and the first one is open: open them all, as a presenter would
  fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
  return view;
}

const pickFile = (docType: string, file: File) =>
  fireEvent.change(screen.getByLabelText(`${docType} file`), { target: { files: [file] } });

const pdf = (name = 'pan.pdf', size = 184_320) => {
  const file = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const row = (docType: string) =>
  screen.getByRole('group', { name: new RegExp(`^${escape(docType)}`) });
const docFor = (docType: string) => state().draft.documents.find((d) => d.docType === docType);

let urlCounter = 0;
const createObjectURL = vi.fn(() => `blob:mock-${++urlCounter}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  localStorage.clear();
  urlCounter = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  state().resetDemo();
  revokeObjectURL.mockClear();
});

describe('Documents section', () => {
  it('has a Documents heading, a note, and the three groups', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 2, name: /^Documents/ })).toBeInTheDocument();
    expect(screen.getByText('PDF, JPG or PNG, up to 5 MB each.')).toBeInTheDocument();
    const groups = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(groups).toEqual(['KYC', 'Income', 'Property']);
  });

  it('shows one upload row per DocType, in the order of the overview', () => {
    renderPage();
    const labels = screen
      .getAllByRole('group')
      .map((g) => g.textContent ?? '')
      .map((t) =>
        t
          .replace(/\*.*$/, '')
          .replace(/No file chosen.*$/, '')
          .trim(),
      );
    expect(labels).toEqual([
      'PAN Card',
      'Aadhaar (Masked Copy)',
      'Photograph',
      'Address Proof',
      'Income Proof',
      'Surety Documents',
      'Sale or Gift Deed',
      'Records of Rights',
      'Encumbrance Certificate',
      'Building Permission',
      'Valuation Certificate',
      'Tax Paid Receipt',
    ]);
  });

  it('marks every row as required', () => {
    renderPage();
    screen.getAllByRole('group').forEach((group) => {
      expect(group.textContent).toContain('*');
    });
  });

  it('shows the GST certificate row only when GSTIN is shown', () => {
    renderPage();
    expect(
      screen.queryByLabelText('GST Certificate or Business Licence file'),
    ).not.toBeInTheDocument();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Business' } });
    expect(screen.getByLabelText('GST Certificate or Business Licence file')).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(13);
    fireEvent.change(field(/^Occupation/), { target: { value: 'Professional' } });
    expect(screen.getByLabelText('GST Certificate or Business Licence file')).toBeInTheDocument();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Agriculturist' } });
    expect(
      screen.queryByLabelText('GST Certificate or Business Licence file'),
    ).not.toBeInTheDocument();
  });

  it('drops the GST file when its row is hidden again', () => {
    renderPage();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Business' } });
    pickFile('GST Certificate or Business Licence', pdf('gst.pdf'));
    expect(docFor('GST Certificate or Business Licence')).toBeDefined();
    fireEvent.change(field(/^Occupation/), { target: { value: 'Salaried' } });
    expect(docFor('GST Certificate or Business Licence')).toBeUndefined();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });
});

describe('choosing a file', () => {
  it('shows the name, size and type icon, and keeps only metadata in the store', () => {
    renderPage();
    pickFile('PAN Card', pdf('PAN_Card_Ramesh_Patil.pdf', 184_320));

    const pan = row('PAN Card');
    expect(within(pan).getByText('PAN_Card_Ramesh_Patil.pdf')).toBeInTheDocument();
    expect(within(pan).getByText('180 KB')).toBeInTheDocument();
    expect(within(pan).getByText('PDF')).toBeInTheDocument();
    expect(within(pan).getByRole('button', { name: 'Replace PAN Card file' })).toBeInTheDocument();
    expect(within(pan).getByRole('button', { name: 'Remove PAN Card file' })).toBeInTheDocument();

    expect(docFor('PAN Card')).toMatchObject({
      docType: 'PAN Card',
      fileName: 'PAN_Card_Ramesh_Patil.pdf',
      sizeBytes: 184_320,
      mimeType: 'application/pdf',
      previewUrl: 'blob:mock-1',
      uploadedBy: 'Priya Kulkarni',
    });
    // nothing but plain data in the store
    expect(JSON.stringify(state().draft.documents)).not.toContain('"File"');
    expect(Object.keys(docFor('PAN Card')!).sort()).toEqual(
      [
        'docType',
        'fileName',
        'id',
        'mimeType',
        'previewUrl',
        'sizeBytes',
        'uploadedAt',
        'uploadedBy',
        'version',
      ].sort(),
    );
    expect(docFor('PAN Card')?.version).toBe('v1.0');
  });

  it('keeps one file when a file is replaced, with the next version', () => {
    renderPage();
    pickFile('PAN Card', pdf('pan_1.pdf'));
    const first = docFor('PAN Card')!;
    pickFile('PAN Card', pdf('pan_2.pdf'));
    expect(state().draft.documents.filter((d) => d.docType === 'PAN Card')).toHaveLength(1);
    expect(docFor('PAN Card')).toMatchObject({
      id: first.id,
      fileName: 'pan_2.pdf',
      version: 'v1.1',
    });
    pickFile('PAN Card', pdf('pan_3.pdf'));
    expect(docFor('PAN Card')?.version).toBe('v1.2');
  });

  it('starts again at v1.0 when a file is removed and another one is chosen', () => {
    renderPage();
    pickFile('PAN Card', pdf('pan_1.pdf'));
    pickFile('PAN Card', pdf('pan_2.pdf'));
    fireEvent.click(within(row('PAN Card')).getByRole('button', { name: 'Remove PAN Card file' }));
    expect(docFor('PAN Card')).toBeUndefined();
    pickFile('PAN Card', pdf('pan_3.pdf'));
    expect(docFor('PAN Card')?.version).toBe('v1.0');
  });

  it('turns the file name into a link to the local preview', () => {
    renderPage();
    pickFile('PAN Card', pdf('pan.pdf'));
    expect(within(row('PAN Card')).getByRole('link', { name: 'pan.pdf' })).toHaveAttribute(
      'href',
      'blob:mock-1',
    );
  });

  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.png', 'image/png'],
  ])('accepts %s', (name, type) => {
    renderPage();
    pickFile('Photograph', new File(['x'], name, { type }));
    expect(docFor('Photograph')).toMatchObject({ fileName: name, mimeType: type });
  });

  it('accepts a file of exactly 5 MB', () => {
    renderPage();
    pickFile('PAN Card', pdf('big.pdf', 5 * MB));
    expect(docFor('PAN Card')).toBeDefined();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps each DocType separate, one file per DocType', () => {
    renderPage();
    pickFile('PAN Card', pdf('a.pdf'));
    pickFile('Address Proof', pdf('b.pdf'));
    expect(
      state()
        .draft.documents.map((d) => d.docType)
        .sort(),
    ).toEqual(['Address Proof', 'PAN Card']);
  });

  it('saves the metadata to localStorage but not the local preview link', () => {
    renderPage();
    pickFile('PAN Card', pdf('pan.pdf'));
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(saved).toContain('pan.pdf');
    expect(saved).not.toContain('blob:');
  });
});

describe('rejected files', () => {
  it('rejects a file of the wrong type with the error text, and keeps nothing', () => {
    renderPage();
    pickFile('PAN Card', new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(within(row('PAN Card')).getByRole('alert')).toHaveTextContent(ERROR_TEXT);
    expect(docFor('PAN Card')).toBeUndefined();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(within(row('PAN Card')).getByText('No file chosen')).toBeInTheDocument();
  });

  it('rejects a file over 5 MB', () => {
    renderPage();
    pickFile('Photograph', pdf('huge.pdf', 5 * MB + 1));
    expect(within(row('Photograph')).getByRole('alert')).toHaveTextContent(ERROR_TEXT);
    expect(docFor('Photograph')).toBeUndefined();
  });

  it('shows the error only under the row that rejected the file', () => {
    renderPage();
    pickFile('PAN Card', new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps the earlier file when a replacement is rejected', () => {
    renderPage();
    pickFile('PAN Card', pdf('good.pdf'));
    pickFile('PAN Card', new File(['x'], 'bad.exe', { type: 'application/x-msdownload' }));
    expect(docFor('PAN Card')?.fileName).toBe('good.pdf');
    expect(within(row('PAN Card')).getByText('good.pdf')).toBeInTheDocument();
    expect(within(row('PAN Card')).getByRole('alert')).toHaveTextContent(ERROR_TEXT);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('clears the error when a good file is chosen', () => {
    renderPage();
    pickFile('PAN Card', new File(['x'], 'notes.txt', { type: 'text/plain' }));
    pickFile('PAN Card', pdf('good.pdf'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(docFor('PAN Card')?.fileName).toBe('good.pdf');
  });

  it('clears the error when the file is removed', () => {
    renderPage();
    pickFile('PAN Card', pdf('good.pdf'));
    pickFile('PAN Card', new File(['x'], 'bad.txt', { type: 'text/plain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove PAN Card file' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('forgets errors when a scenario is filled', () => {
    renderPage();
    pickFile('PAN Card', new File(['x'], 'notes.txt', { type: 'text/plain' }));
    act(() => state().fillScenario('A'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Replace and Remove', () => {
  it('Replace swaps the file, frees the old preview link and keeps one file for the DocType', () => {
    renderPage();
    pickFile('PAN Card', pdf('first.pdf'));
    pickFile('PAN Card', pdf('second.pdf', 300_000));
    expect(state().draft.documents.filter((d) => d.docType === 'PAN Card')).toHaveLength(1);
    expect(docFor('PAN Card')).toMatchObject({ fileName: 'second.pdf', previewUrl: 'blob:mock-2' });
    expect(within(row('PAN Card')).getByText('293 KB')).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:mock-2');
  });

  it('Remove empties the row, frees the preview link and clears the record', () => {
    renderPage();
    pickFile('PAN Card', pdf('first.pdf'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove PAN Card file' }));
    expect(docFor('PAN Card')).toBeUndefined();
    expect(within(row('PAN Card')).getByText('No file chosen')).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });

  it('Remove leaves the other documents alone', () => {
    renderPage();
    pickFile('PAN Card', pdf('a.pdf'));
    pickFile('Photograph', new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove PAN Card file' }));
    expect(state().draft.documents.map((d) => d.docType)).toEqual(['Photograph']);
  });
});

describe('Fill with scenario: documents', () => {
  it('scenario A attaches 13 placeholder files with realistic names', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    expect(within(row('PAN Card')).getByText('PAN_Card_Ramesh_Patil.pdf')).toBeInTheDocument();
    expect(within(row('PAN Card')).getByText('180 KB')).toBeInTheDocument();
    expect(
      within(row('Photograph')).getByText('Passport_Photo_Ramesh_Patil.jpg'),
    ).toBeInTheDocument();
    expect(
      within(row('GST Certificate or Business Licence')).getByText(
        'GST_Registration_Certificate_Ramesh_Patil.pdf',
      ),
    ).toBeInTheDocument();
    expect(
      within(row('Income Proof')).getByText('ITR_Acknowledgement_FY2025-26_Ramesh_Patil.pdf'),
    ).toBeInTheDocument();
    expect(
      within(row('Records of Rights')).getByText('RTC_Record_of_Rights_Ramesh_Patil.pdf'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remove .* file$/ })).toHaveLength(13);
    expect(screen.queryByText('No file chosen')).not.toBeInTheDocument();
  });

  it('placeholder files have no preview link and the name is plain text', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('scenario B has 12 files named after the applicant, with salary slips as income proof', () => {
    renderPage();
    act(() => state().fillScenario('B'));
    expect(screen.getAllByRole('button', { name: /^Remove .* file$/ })).toHaveLength(12);
    expect(
      within(row('Income Proof')).getByText('Salary_Slips_Last_3_Months_Anita_Desai.pdf'),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('GST Certificate or Business Licence file'),
    ).not.toBeInTheDocument();
  });

  it('filling a scenario frees the preview links of files chosen by hand', () => {
    renderPage();
    pickFile('PAN Card', pdf('mine.pdf'));
    act(() => state().fillScenario('A'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    expect(docFor('PAN Card')?.fileName).toBe('PAN_Card_Ramesh_Patil.pdf');
  });

  it('placeholder files can be replaced or removed like any other', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    pickFile('PAN Card', pdf('my-pan.pdf'));
    expect(docFor('PAN Card')?.fileName).toBe('my-pan.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Photograph file' }));
    expect(docFor('Photograph')).toBeUndefined();
    expect(state().draft.documents).toHaveLength(12);
  });
});

describe('Consent section', () => {
  const consent = () =>
    screen.getByRole('checkbox', {
      name: /I authorise the bank to verify my PAN, Aadhaar and GST details/,
    });

  it('shows the consent text exactly, required, and unticked', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 2, name: /^Consent/ })).toBeInTheDocument();
    expect(
      screen.getByText(
        /I authorise the bank to verify my PAN, Aadhaar and GST details with government sources for this loan application\./,
      ),
    ).toBeInTheDocument();
    expect(consent()).not.toBeChecked();
    expect(screen.getByText(/government sources/).textContent).toContain('*');
    expect(screen.queryByText(/Consent Time/)).not.toBeInTheDocument();
  });

  it('ticking sets Consent Given and Consent Time and shows the time as small text', () => {
    renderPage();
    const before = Date.now();
    fireEvent.click(consent());
    expect(consent()).toBeChecked();
    expect(state().draft.consentGiven).toBe(true);
    const stamped = new Date(state().draft.consentTime).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
    expect(
      screen.getByText(/^Consent Time: \d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2} (AM|PM)$/),
    ).toBeInTheDocument();
  });

  it('unticking clears both', () => {
    renderPage();
    fireEvent.click(consent());
    fireEvent.click(consent());
    expect(consent()).not.toBeChecked();
    expect(state().draft.consentGiven).toBe(false);
    expect(state().draft.consentTime).toBe('');
    expect(screen.queryByText(/Consent Time/)).not.toBeInTheDocument();
  });

  it('keeps the first Consent Time while other fields change', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-08T12:00:00.000Z'));
      renderPage();
      fireEvent.click(consent());
      expect(state().draft.consentTime).toBe('2026-10-08T12:00:00.000Z');
      vi.setSystemTime(new Date('2026-10-08T15:00:00.000Z'));
      fireEvent.change(field(/^Full Name/), { target: { value: 'Anita Desai' } });
      expect(state().draft.consentTime).toBe('2026-10-08T12:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('survives a reload', () => {
    const first = renderPage();
    fireEvent.click(consent());
    first.unmount();
    renderPage();
    expect(consent()).toBeChecked();
    expect(screen.getByText(/^Consent Time:/)).toBeInTheDocument();
  });

  it('is left unticked by Fill with scenario, for the presenter to tick', () => {
    renderPage();
    act(() => state().fillScenario('A'));
    expect(consent()).not.toBeChecked();
    expect(state().draft.consentTime).toBe('');
  });

  it('is cleared by Reset demo', () => {
    renderPage();
    fireEvent.click(consent());
    act(() => state().resetDemo());
    // Reset demo goes back to the first section only
    fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }));
    expect(consent()).not.toBeChecked();
  });
});

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
