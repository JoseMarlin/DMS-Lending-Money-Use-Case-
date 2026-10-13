import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { FileStatus, type FileSystem } from '@/data/fileSystem';
import { buildSampleFileSystem } from '@/data/sampleFiles';
import { useAppStore } from '@/data/store';
import FilesPage from './FilesPage';
import { ZOOM } from './filesPageModel';

const NOW = new Date('2026-10-12T12:00:00Z');
const FS: FileSystem = buildSampleFileSystem(NOW);
const idOf = (name: string) => FS.folders.find((f) => f.name === name)!.id;
const state = () => useAppStore.getState();

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderAt(path = '/files') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/files" element={<FilesPage fileSystem={FS} now={NOW} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const inFolder = (name: string) => `/files?folder=${idOf(name)}`;
const where = () => screen.getByTestId('where').textContent;
const searchBox = () => screen.getByRole('textbox', { name: 'Search File & Folders' });
const search = (text: string) => fireEvent.change(searchBox(), { target: { value: text } });
const foldersSection = () => screen.queryByRole('region', { name: 'Folders' });
const filesSection = () => screen.queryByRole('region', { name: 'Files' });
const folderLinks = () =>
  within(foldersSection()!)
    .getAllByRole('link')
    .map((l) => l.querySelector('span.truncate')?.textContent);
const fileNames = () =>
  within(filesSection()!)
    .getAllByRole('listitem')
    .map((li) => li.querySelector('button[aria-haspopup=dialog]')?.getAttribute('aria-label'));

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
  document.title = 'DMS+ | Home Loan Prototype';
});

describe('the header', () => {
  it('has the title Files & Folders and names the tab after it', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Files & Folders' })).toBeInTheDocument();
    expect(document.title).toBe('Files & Folders | DMS+');
  });

  it('has a primary Add New button that is only drawn: it opens nothing', () => {
    renderAt();
    const add = screen.getByRole('button', { name: 'Add New' });
    expect(add.className).toContain('bg-primary');
    expect(add.querySelector('svg')).not.toBeNull();
    fireEvent.click(add);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(add).not.toHaveAttribute('aria-expanded');
  });

  it('has a search box that says "Search File & Folders" and a list/grid switch, in grid by default', () => {
    renderAt();
    expect(searchBox()).toHaveAttribute('placeholder', 'Search File & Folders');
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('has no breadcrumb at the top of the tree', () => {
    renderAt();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });
});

describe('the top of the tree', () => {
  it('shows the folders as cards, A to Z, with their counts and the time they last changed', () => {
    renderAt();
    expect(folderLinks()).toEqual([
      'Archive 2024',
      'In Workflow',
      'Loans',
      'Policies & Circulars',
      'Templates',
    ]);
    const loans = screen.getByRole('link', { name: /^Loans/ });
    expect(loans).toHaveTextContent('Loans');
    expect(loans).toHaveTextContent(/\d+ Folders, \d+ files/);
    expect(loans).toHaveTextContent('Last updated 5 Hours ago');
    expect(screen.getByRole('link', { name: /^Archive 2024/ })).toHaveTextContent(
      '0 Folders, 0 files',
    );
    expect(screen.getByRole('link', { name: /^In Workflow/ })).toHaveTextContent(
      'Last updated 2 Mins ago',
    );
  });

  it('puts the folders in a four-column grid', () => {
    renderAt();
    const grid = within(foldersSection()!).getByRole('list');
    // as many columns as fit, and never more than four: a card is not narrower than 248px
    expect(grid.getAttribute('style')).toContain('repeat(auto-fill, minmax(max(248px');
    expect(grid.getAttribute('style')).toContain('/ 4)');
  });

  it('shows the files at the top as cards', () => {
    renderAt();
    expect(fileNames()).toEqual(['Branch_Directory.pdf', 'Document_Naming_Guide.pdf']);
  });

  it('counts a folder by everything below it, at any depth', () => {
    renderAt();
    // In Workflow has 4 application folders and 4 + 3 + 3 + 2 files... the sample says it
    const inWorkflow = FS.files.filter(
      (f) => f.status !== FileStatus.Filed && f.folderId !== 'root',
    );
    expect(screen.getByRole('link', { name: /^In Workflow/ })).toHaveTextContent(
      `4 Folders, ${inWorkflow.length} files`,
    );
  });
});

describe('opening a folder', () => {
  it('goes into the folder when its card is chosen, and writes it in the address', () => {
    renderAt();
    fireEvent.click(screen.getByRole('link', { name: /^Loans/ }));
    expect(where()).toBe(inFolder('Loans'));
    expect(folderLinks()).toEqual(['Home Loan']);
  });

  it('shows the folder of the address', () => {
    renderAt(inFolder('Policies & Circulars'));
    expect(fileNames()).toContain('KYC_Guidelines.pdf');
    expect(
      screen.getByRole('region', { name: 'Contents of Policies & Circulars' }),
    ).toBeInTheDocument();
  });

  it('shows the top when the folder of the address does not exist', () => {
    renderAt('/files?folder=nowhere');
    expect(folderLinks()).toContain('Loans');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('shows a breadcrumb above the title, Files & Folders > Loans > Home Loan, each part a link', () => {
    renderAt(inFolder('Home Loan'));
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Files & Folders', 'Loans', 'Home Loan']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/files',
      inFolder('Loans'),
      inFolder('Home Loan'),
    ]);
    // above the title, in the page
    const title = screen.getByRole('heading', { level: 1 });
    expect(nav.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('goes back up when a part of the breadcrumb is chosen', () => {
    renderAt(inFolder('Home Loan'));
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Loans',
      }),
    );
    expect(where()).toBe(inFolder('Loans'));
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Files & Folders',
      }),
    );
    expect(where()).toBe('/files');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('hides the Folders section when the folder has no folders', () => {
    renderAt(inFolder('Policies & Circulars'));
    expect(foldersSection()).not.toBeInTheDocument();
    expect(fileNames()).toEqual([
      'Home_Loan_Policy_2026.pdf',
      'Interest_Rate_Circular_Oct_2026.pdf',
      'KYC_Guidelines.pdf',
    ]);
  });

  it('says there are no files in a folder that holds only folders, and still shows the folders', () => {
    renderAt(inFolder('Loans'));
    expect(foldersSection()).toBeInTheDocument();
    expect(
      within(filesSection()!).getByText('There are no files in this folder.'),
    ).toBeInTheDocument();
  });

  it('moves the cursor to the contents when another folder is opened', () => {
    renderAt();
    fireEvent.click(screen.getByRole('link', { name: /^Loans/ }));
    expect(screen.getByRole('region', { name: 'Contents of Loans' })).toHaveFocus();
  });

  it('does not take the cursor when the page first opens', () => {
    renderAt(inFolder('Loans'));
    expect(document.body).toHaveFocus();
  });

  it('tells a screen reader which folder is open', () => {
    renderAt(inFolder('Policies & Circulars'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Policies & Circulars: 0 Folders, 3 files',
    );
  });
});

describe('an empty folder', () => {
  it('says it is empty, and shows neither section', () => {
    renderAt(inFolder('Archive 2024'));
    expect(screen.getByText('This folder is empty')).toBeInTheDocument();
    expect(foldersSection()).not.toBeInTheDocument();
    expect(filesSection()).not.toBeInTheDocument();
    // the breadcrumb is there, so there is a way back
    expect(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Archive 2024',
      }),
    ).toBeInTheDocument();
  });

  it('says so in the list view too', () => {
    renderAt(inFolder('Archive 2024'));
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByText('This folder is empty')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('file cards', () => {
  const kyc = () => inFolder('01 KYC');

  it('show the version and the DocType as chips, the uploader, and no OCR chip', () => {
    renderAt(kyc());
    const card = within(filesSection()!)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('PAN_Card'))!;
    expect(within(card).getByText('v1.0')).toBeInTheDocument();
    expect(within(card).getByText('PAN Card')).toBeInTheDocument();
    expect(within(card).getByText('Priya Kulkarni')).toBeInTheDocument();
    expect(screen.queryByText(/OCR/i)).not.toBeInTheDocument();
  });

  it('show no status badge for filed files', () => {
    renderAt(kyc());
    for (const status of [
      FileStatus.Draft,
      FileStatus.PendingApproval,
      FileStatus.Returned,
      FileStatus.Rejected,
    ])
      expect(within(filesSection()!).queryByText(status)).not.toBeInTheDocument();
  });

  it.each([
    ['HL-2026-0002 Shobha Gaonkar', FileStatus.PendingApproval],
    ['HL-2026-0004 Savita Patil', FileStatus.Returned],
    ['HL-2026-0005 Basavaraj Kadam', FileStatus.Rejected],
    ['HL-2026-0010 Anita Desai', FileStatus.Draft],
  ])('in %s show the badge %s on every thumbnail', (folder, status) => {
    renderAt(inFolder(folder));
    const cards = within(filesSection()!).getAllByRole('listitem');
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) expect(within(card).getByText(status)).toBeInTheDocument();
  });

  it('draw no picture of a document: a plain placeholder with the type of the file', () => {
    renderAt(kyc());
    expect(filesSection()!.querySelector('img')).toBeNull();
    expect(within(filesSection()!).getAllByText('PDF').length).toBeGreaterThan(0);
    expect(within(filesSection()!).getByText('JPG')).toBeInTheDocument();
  });
});

describe('the star of a file', () => {
  const star = (name: string) => screen.getByRole('button', { name: `Favourite ${name}` });

  it('starts off, and turns on and off when pressed', () => {
    renderAt(inFolder('Policies & Circulars'));
    expect(star('KYC_Guidelines.pdf')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star('KYC_Guidelines.pdf'));
    expect(star('KYC_Guidelines.pdf')).toHaveAttribute('aria-pressed', 'true');
    expect(star('Home_Loan_Policy_2026.pdf')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star('KYC_Guidelines.pdf'));
    expect(star('KYC_Guidelines.pdf')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is kept in the store, and shown again when the page is opened again', () => {
    const { unmount } = renderAt(inFolder('Policies & Circulars'));
    fireEvent.click(star('KYC_Guidelines.pdf'));
    const id = FS.files.find((f) => f.name === 'KYC_Guidelines.pdf')!.id;
    expect(state().favouriteFileIds).toEqual([id]);
    unmount();
    renderAt(inFolder('Policies & Circulars'));
    expect(star('KYC_Guidelines.pdf')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not open the preview', () => {
    renderAt(inFolder('Policies & Circulars'));
    fireEvent.click(star('KYC_Guidelines.pdf'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the zoom of the file cards', () => {
  const columns = () =>
    (within(filesSection()!).getByRole('list') as HTMLElement).style.gridTemplateColumns;

  it('starts at the size of the design', () => {
    renderAt(inFolder('Policies & Circulars'));
    expect(columns()).toContain(`minmax(${ZOOM.initial}px`);
    expect(screen.getByRole('slider', { name: 'Card size' })).toHaveAttribute(
      'aria-valuetext',
      '100%',
    );
  });

  it('makes the cards larger and smaller with the plus and minus buttons', () => {
    renderAt(inFolder('Policies & Circulars'));
    fireEvent.click(screen.getByRole('button', { name: 'Larger cards' }));
    expect(columns()).toContain(`minmax(${ZOOM.initial + ZOOM.step}px`);
    fireEvent.click(screen.getByRole('button', { name: 'Smaller cards' }));
    fireEvent.click(screen.getByRole('button', { name: 'Smaller cards' }));
    expect(columns()).toContain(`minmax(${ZOOM.initial - ZOOM.step}px`);
  });

  it('follows the slider and stops at the ends', () => {
    renderAt(inFolder('Policies & Circulars'));
    fireEvent.change(screen.getByRole('slider', { name: 'Card size' }), {
      target: { value: String(ZOOM.max) },
    });
    expect(columns()).toContain(`minmax(${ZOOM.max}px`);
    expect(screen.getByRole('button', { name: 'Larger cards' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    fireEvent.change(screen.getByRole('slider', { name: 'Card size' }), {
      target: { value: String(ZOOM.min) },
    });
    expect(screen.getByRole('button', { name: 'Smaller cards' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('is only in the Files section, and not in the list view', () => {
    renderAt(inFolder('Policies & Circulars'));
    expect(within(filesSection()!).getByRole('slider')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});

describe('keeping the cursor on the page', () => {
  it('moves the cursor to the contents when the search is cleared with its button', () => {
    renderAt();
    search('zzzz');
    const clear = screen.getByRole('button', { name: 'Clear search' });
    clear.focus();
    fireEvent.click(clear);
    expect(screen.getByRole('region', { name: /^Contents of/ })).toHaveFocus();
  });

  it('does the same when the folder that was found is the one that is open', () => {
    renderAt(inFolder('Loans'));
    search('loans');
    fireEvent.click(within(foldersSection()!).getByRole('link', { name: /^Loans/ }));
    expect(searchBox()).toHaveValue('');
    expect(screen.getByRole('region', { name: /^Contents of/ })).toHaveFocus();
  });

  it('puts the cursor on the contents of a folder that was opened with nothing typed', () => {
    renderAt();
    fireEvent.click(screen.getByRole('link', { name: /^Templates/ }));
    expect(screen.getByRole('region', { name: 'Contents of Templates' })).toHaveFocus();
  });
});

describe('a folder found by a search says where it is', () => {
  it('shows the folder it is in, because three folders are called 01 KYC', () => {
    renderAt();
    search('01 KYC');
    const cards = within(foldersSection()!).getAllByRole('link');
    expect(cards.length).toBe(3);
    expect(cards.every((c) => /in HL-2026-\d{4} /.test(c.textContent ?? ''))).toBe(true);
    expect(new Set(cards.map((c) => c.textContent)).size).toBe(3);
  });

  it('shows no such line in a folder that is open', () => {
    renderAt(inFolder('HL-2026-0001 Vijay Kulkarni'));
    expect(within(foldersSection()!).queryByText(/^in /)).not.toBeInTheDocument();
  });
});

describe('opening and closing the sections', () => {
  it('hides the folders or the files when their heading is pressed', () => {
    renderAt();
    const foldersHeading = within(foldersSection()!).getByRole('button', { name: 'Folders' });
    const filesHeading = within(filesSection()!).getByRole('button', { name: 'Files' });
    fireEvent.click(foldersHeading);
    expect(foldersHeading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Loans')).not.toBeVisible();
    expect(screen.getByText('Branch_Directory.pdf', { selector: 'button' })).toBeVisible();
    fireEvent.click(filesHeading);
    expect(screen.getByText('Branch_Directory.pdf', { selector: 'button' })).not.toBeVisible();
    fireEvent.click(foldersHeading);
    expect(screen.getByText('Loans')).toBeVisible();
  });
});

describe('the list view', () => {
  const table = () => screen.getByRole('table', { name: 'Files and folders' });
  const rowsText = () => within(table()).getAllByRole('row').slice(1);

  it('is a table with the columns File, DocType, Folder and Status, and a column of menus', () => {
    renderAt(inFolder('01 KYC'));
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['File', 'DocType', 'Folder', 'Status', 'Actions']);
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(foldersSection()).not.toBeInTheDocument();
  });

  it('writes the uploader and the date and time under the name of a file', () => {
    renderAt(inFolder('01 KYC'));
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const row = rowsText().find((r) => r.textContent?.includes('PAN_Card'))!;
    expect(row).toHaveTextContent(
      /PAN_Card_Vijay_Kulkarni\.pdfPriya Kulkarni · \d{1,2} [A-Z][a-z]{2} 2026, \d{1,2}:\d{2} (AM|PM)/,
    );
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('PAN Card');
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('... / 01 KYC');
    expect(within(row).getAllByRole('cell')[3]).toHaveTextContent('Filed');
  });

  it('shows the status of a file that is not final as its badge', () => {
    renderAt(inFolder('HL-2026-0004 Savita Patil'));
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const cells = rowsText().map((r) => within(r).getAllByRole('cell')[3].textContent);
    expect(cells.every((c) => c === 'Returned')).toBe(true);
  });

  it('has the folders first, so that they can be opened, then the files', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const first = rowsText().map((r) => {
      const link = within(r).queryByRole('link');
      return link ? `folder ${link.textContent}` : 'file';
    });
    expect(first).toEqual([
      'folder Archive 2024',
      'folder In Workflow',
      'folder Loans',
      'folder Policies & Circulars',
      'folder Templates',
      'file',
      'file',
    ]);
    fireEvent.click(within(table()).getByRole('link', { name: 'Loans' }));
    expect(where()).toBe(inFolder('Loans'));
    // the view stays as it was
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('opens the preview from the name of a file', () => {
    renderAt(inFolder('01 KYC'));
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    fireEvent.click(within(table()).getByRole('button', { name: 'PAN_Card_Vijay_Kulkarni.pdf' }));
    expect(screen.getByRole('dialog', { name: 'PAN_Card_Vijay_Kulkarni.pdf' })).toBeInTheDocument();
  });

  it('has a menu for a file with Preview and a star, and none for a folder', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(
      screen.queryByRole('button', { name: /More actions for Loans/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Branch_Directory.pdf' }));
    const menu = screen.getByRole('menu', { name: 'Actions for Branch_Directory.pdf' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Preview', 'Add to favourites']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Add to favourites' }));
    expect(state().favouriteFileIds).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Branch_Directory.pdf' }));
    expect(screen.getByRole('menuitem', { name: 'Remove from favourites' })).toBeInTheDocument();
  });

  it('opens the preview from the menu', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Branch_Directory.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preview' }));
    expect(screen.getByRole('dialog', { name: 'Branch_Directory.pdf' })).toBeInTheDocument();
  });

  it('goes back to the grid', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(foldersSection()).toBeInTheDocument();
  });
});

describe('the preview of a file', () => {
  const openCard = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

  it('opens from a file card, with the file name, DocType, linked application and status', () => {
    renderAt(inFolder('HL-2026-0002 Shobha Gaonkar'));
    openCard('PAN_Card_Shobha_Gaonkar.pdf');
    const dialog = screen.getByRole('dialog', { name: 'PAN_Card_Shobha_Gaonkar.pdf' });
    const row = (label: string) =>
      within(dialog).getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(row('DocType')).toHaveTextContent('PAN Card');
    expect(row('Linked application')).toHaveTextContent('HL-2026-0002 · Shobha Gaonkar');
    expect(row('Status')).toHaveTextContent('Pending approval');
    expect(
      within(dialog).getByRole('img', { name: /Placeholder for the preview/ }),
    ).toBeInTheDocument();
  });

  it('has a View record link to the record of the application', () => {
    renderAt(inFolder('HL-2026-0002 Shobha Gaonkar'));
    openCard('PAN_Card_Shobha_Gaonkar.pdf');
    expect(screen.getByRole('link', { name: 'View record' })).toHaveAttribute(
      'href',
      '/metadata/master/home-loan?record=HL-2026-0002',
    );
  });

  it('has no View record link for an application that is not in the store (the sample has three that are not)', () => {
    renderAt(inFolder('HL-2026-0010 Anita Desai'));
    openCard('PAN_Card_Anita_Desai.pdf');
    expect(screen.getByRole('dialog', { name: 'PAN_Card_Anita_Desai.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View record' })).not.toBeInTheDocument();
  });

  it('has no View record link when the store has another person under that Application ID', () => {
    state().saveApplication({
      ...state().draft,
      applicationId: 'HL-2026-0010',
      fullNameAsPerPan: 'Someone Else',
    });
    renderAt(inFolder('HL-2026-0010 Anita Desai'));
    openCard('PAN_Card_Anita_Desai.pdf');
    expect(screen.queryByRole('link', { name: 'View record' })).not.toBeInTheDocument();
  });

  it('has a View record link for an application that the store has, with the same name', () => {
    renderAt(inFolder('HL-2026-0004 Savita Patil'));
    openCard('PAN_Card_Savita_Patil.pdf');
    expect(screen.getByRole('link', { name: 'View record' })).toHaveAttribute(
      'href',
      '/metadata/master/home-loan?record=HL-2026-0004',
    );
  });

  it('has no View record link for a file of no application', () => {
    renderAt();
    openCard('Branch_Directory.pdf');
    expect(screen.getByRole('dialog', { name: 'Branch_Directory.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View record' })).not.toBeInTheDocument();
  });

  it('closes with Escape and gives the cursor back to the card', () => {
    renderAt();
    const card = screen.getByRole('button', { name: 'Branch_Directory.pdf' });
    card.focus(); // a click puts the cursor on the card, as the browser would
    fireEvent.click(card);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(card).toHaveFocus();
  });

  it('never shows a full Aadhaar number', () => {
    renderAt(inFolder('01 KYC'));
    openCard('Aadhaar_Masked_Copy_Vijay_Kulkarni.pdf');
    expect(screen.getByRole('dialog').textContent).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
  });
});

describe('searching', () => {
  it('looks through the whole tree for a file by name, DocType, application ID or applicant name', () => {
    renderAt();
    search('Vijay');
    expect(fileNames().length).toBeGreaterThan(10);
    expect(fileNames().every((n) => n?.includes('Vijay_Kulkarni'))).toBe(true);
    search('sale or gift');
    expect(fileNames().length).toBeGreaterThan(2);
    expect(fileNames().every((n) => n?.startsWith('Sale_Deed'))).toBe(true);
    search('HL-2026-0099');
    expect(fileNames().every((n) => n?.includes('Meera_Joshi'))).toBe(true);
    search('meera');
    expect(fileNames().every((n) => n?.includes('Meera_Joshi'))).toBe(true);
    search('Branch_Directory');
    expect(fileNames()).toEqual(['Branch_Directory.pdf']);
  });

  it('finds folders by their name', () => {
    renderAt();
    search('Vijay');
    expect(folderLinks()).toEqual(['HL-2026-0001 Vijay Kulkarni']);
    search('policies');
    expect(folderLinks()).toEqual(['Policies & Circulars']);
  });

  it('ignores the case and the spaces round what was typed', () => {
    renderAt();
    search('  PAN CARD  ');
    expect(fileNames().length).toBeGreaterThan(3);
  });

  it('looks through the whole tree even when a folder is open', () => {
    renderAt(inFolder('Archive 2024'));
    search('meera');
    expect(fileNames().length).toBeGreaterThan(0);
    expect(screen.queryByText('This folder is empty')).not.toBeInTheDocument();
  });

  it('says what it is showing, and tells a screen reader how many it found', () => {
    renderAt();
    search('policies');
    expect(screen.getByText('Results for “policies” in all folders')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 folder and 0 files match "policies"');
  });

  it('hides the Folders section when no folder matches', () => {
    renderAt();
    search('branch_directory');
    expect(foldersSection()).not.toBeInTheDocument();
    expect(filesSection()).toBeInTheDocument();
  });

  it('says so, in the Files section, when only folders match', () => {
    renderAt();
    search('policies');
    expect(within(filesSection()!).getByText('No files match your search.')).toBeInTheDocument();
  });

  it('shows the results in the list view, with the folder each file is in', () => {
    renderAt();
    search('meera');
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.some((r) => r.textContent?.includes('... / 01 KYC'))).toBe(true);
  });

  it('finds a file by several words, in any order, though its name has underscores', () => {
    renderAt();
    search('sale deed');
    expect(fileNames().length).toBeGreaterThan(2);
    expect(fileNames().every((n) => n?.startsWith('Sale_Deed'))).toBe(true);
    search('vijay pan card');
    expect(fileNames()).toEqual(['PAN_Card_Vijay_Kulkarni.pdf']);
  });

  it('has no hairline under the message when nothing is found, nor under an empty folder', () => {
    const { unmount } = renderAt();
    search('zzzz');
    expect(screen.getByText('No results for “zzzz”').parentElement).not.toHaveClass('border-b');
    unmount();
    renderAt(inFolder('Archive 2024'));
    expect(screen.getByText('This folder is empty').parentElement).not.toHaveClass('border-b');
  });

  it('says when nothing is found, with a way to clear the search', () => {
    renderAt();
    search('zzzz');
    expect(screen.getByText('No results for “zzzz”')).toBeInTheDocument();
    expect(screen.getByText(/Check the spelling/)).toBeInTheDocument();
    expect(foldersSection()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(searchBox()).toHaveValue('');
    expect(folderLinks()).toContain('Loans');
  });

  it('comes back to the open folder when the box is emptied', () => {
    renderAt(inFolder('Policies & Circulars'));
    search('meera');
    search('');
    expect(fileNames()).toEqual([
      'Home_Loan_Policy_2026.pdf',
      'Interest_Rate_Circular_Oct_2026.pdf',
      'KYC_Guidelines.pdf',
    ]);
  });

  it('opens a folder that was found, and clears the search', () => {
    renderAt();
    search('Vijay');
    fireEvent.click(screen.getByRole('link', { name: /^HL-2026-0001 Vijay Kulkarni/ }));
    expect(where()).toBe(inFolder('HL-2026-0001 Vijay Kulkarni'));
    expect(searchBox()).toHaveValue('');
    expect(folderLinks()).toEqual(['01 KYC', '02 Income', '03 Property', '04 Sanction']);
  });

  it('clears the search when a part of the breadcrumb is chosen', () => {
    renderAt(inFolder('Home Loan'));
    search('zzzz');
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Home Loan',
      }),
    );
    expect(searchBox()).toHaveValue('');
  });

  it('opens a file that was found', () => {
    renderAt();
    search('branch_directory');
    fireEvent.click(screen.getByRole('button', { name: 'Branch_Directory.pdf' }));
    expect(screen.getByRole('dialog', { name: 'Branch_Directory.pdf' })).toBeInTheDocument();
  });
});
