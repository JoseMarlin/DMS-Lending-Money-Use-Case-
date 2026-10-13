import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FileStatus, type FileNode } from '@/data/fileSystem';
import FileCard from './FileCard';
import FileRowMenu from './FileRowMenu';
import FileStatusBadge from './FileStatusBadge';
import FilesSection from './FilesSection';
import FolderBreadcrumb from './FolderBreadcrumb';
import FolderCard from './FolderCard';
import ViewToggle from './ViewToggle';
import ZoomControl from './ZoomControl';
import { ZOOM } from './filesPageModel';

const FILE: FileNode = {
  id: 'file-1',
  name: 'PAN_Card_Ramesh_Patil.pdf',
  folderId: 'kyc',
  mimeType: 'application/pdf',
  sizeBytes: 184320,
  uploadedBy: 'Priya Kulkarni',
  uploadedAt: '2026-10-09T18:23:00+05:30',
  version: 'v1.1',
  status: FileStatus.Filed,
  docType: 'PAN Card',
  applicationId: 'HL-2026-0001',
  applicantName: 'Ramesh Patil',
};

describe('FileStatusBadge', () => {
  it.each([
    [FileStatus.Draft, 'status-draft'],
    [FileStatus.PendingApproval, 'status-progress'],
    [FileStatus.Returned, 'status-action'],
    [FileStatus.Rejected, 'status-rejected'],
  ])('shows %s in its own colour, with the word in it', (status, token) => {
    render(<FileStatusBadge status={status} />);
    const badge = screen.getByText(status);
    expect(badge.className).toContain(`bg-${token}-bg`);
    expect(badge.className).toContain(`text-${token}-text`);
  });

  it('gives a different colour to each of the four', () => {
    const classes = [
      FileStatus.Draft,
      FileStatus.PendingApproval,
      FileStatus.Returned,
      FileStatus.Rejected,
    ].map((status) => {
      const { unmount } = render(<FileStatusBadge status={status} />);
      const value = screen.getByText(status).className.match(/bg-status-[a-z]+-bg/)![0];
      unmount();
      return value;
    });
    expect(new Set(classes).size).toBe(4);
  });

  it('draws nothing for a filed file', () => {
    const { container } = render(<FileStatusBadge status={FileStatus.Filed} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('writes "Filed" as plain text, not a pill, when a table asks for it', () => {
    render(<FileStatusBadge status={FileStatus.Filed} showFiled />);
    const filed = screen.getByText('Filed');
    expect(filed.className).not.toContain('rounded-full');
    expect(filed.className).not.toContain('border');
  });
});

describe('FolderCard', () => {
  const card = () =>
    render(
      <MemoryRouter>
        <FolderCard
          name="Home Loan"
          to="/files?folder=folder-2"
          counts="3 Folders, 12 files"
          updated="Last updated 5 Secs ago"
        />
      </MemoryRouter>,
    );

  it('is a link that opens the folder, and says the counts and the time', () => {
    card();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/files?folder=folder-2');
    expect(link).toHaveTextContent('Home Loan');
    expect(link).toHaveTextContent('3 Folders, 12 files');
    expect(link).toHaveTextContent('Last updated 5 Secs ago');
  });

  it('has the Moved mark on the line of the counts, so that the name keeps its room', () => {
    render(
      <MemoryRouter>
        <FolderCard
          name="HL-2026-0006 Ramesh Patil"
          to="/files"
          counts="3 Folders, 13 files"
          updated=""
          moved
        />
      </MemoryRouter>,
    );
    const mark = screen.getByText('Moved');
    const name = screen.getByTitle('HL-2026-0006 Ramesh Patil');
    // not beside the name: the line it is on is the line of the counts
    expect(mark.closest('span.flex')).not.toContainElement(name);
    expect(mark.closest('span.flex')).toHaveTextContent('3 Folders, 13 filesMoved');
    // a screen reader hears what it means
    expect(screen.getByRole('link')).toHaveAccessibleName(
      expect.stringContaining('files were moved into this folder and it has not been opened since'),
    );
  });

  it('has no Moved mark unless it is asked to', () => {
    card();
    expect(screen.queryByText('Moved')).not.toBeInTheDocument();
  });

  it('is 78px high, as in the design', () => {
    card();
    expect(screen.getByRole('link')).toHaveClass('h-[78px]');
  });

  it('keeps the long name whole in its tooltip', () => {
    render(
      <MemoryRouter>
        <FolderCard
          name="HL-2026-0001 Vijay Kulkarni"
          to="/files"
          counts="1 Folder, 1 file"
          updated=""
        />
      </MemoryRouter>,
    );
    expect(screen.getByTitle('HL-2026-0001 Vijay Kulkarni')).toBeInTheDocument();
  });

  it('says where the folder is, when asked to (the results of a search)', () => {
    render(
      <MemoryRouter>
        <FolderCard
          name="01 KYC"
          to="/files"
          counts="0 Folders, 4 files"
          updated=""
          location="HL-2026-0001 Vijay Kulkarni"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveTextContent(
      '01 KYCin HL-2026-0001 Vijay Kulkarni0 Folders, 4 files',
    );
  });

  it('leaves the time line out when the folder has no date', () => {
    render(
      <MemoryRouter>
        <FolderCard name="A" to="/files" counts="0 Folders, 0 files" updated="" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link').textContent).toBe('A0 Folders, 0 files');
  });

  it('tells the page when it is opened', () => {
    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <FolderCard name="A" to="/files?folder=a" counts="" updated="" onOpen={onOpen} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

const THUMB = '.aspect-\\[6\\/5\\]';

describe('FileCard', () => {
  const draw = (file: FileNode = FILE, extra: Partial<Parameters<typeof FileCard>[0]> = {}) => {
    const props = {
      file,
      iconSize: 58,
      favourite: false,
      onToggleFavourite: vi.fn(),
      onOpen: vi.fn(),
      ...extra,
    };
    render(<FileCard {...props} />);
    return props;
  };

  it('shows the name, the uploader, the version and the DocType', () => {
    draw();
    expect(screen.getByRole('button', { name: FILE.name })).toBeInTheDocument();
    expect(screen.getByText('Priya Kulkarni')).toBeInTheDocument();
    expect(screen.getByText('v1.1')).toBeInTheDocument();
    expect(screen.getByText('PAN Card')).toBeInTheDocument();
  });

  it('has no OCR chip', () => {
    draw();
    expect(screen.queryByText(/OCR/i)).not.toBeInTheDocument();
  });

  it('shows only the version chip for a file with no DocType', () => {
    draw({ ...FILE, docType: undefined });
    expect(screen.getByText('v1.1')).toBeInTheDocument();
    expect(screen.queryByText('PAN Card')).not.toBeInTheDocument();
  });

  it('has a plain placeholder for a thumbnail: the file type on a light panel, nothing drawn of a real document', () => {
    const { container } = render(
      <FileCard
        file={FILE}
        iconSize={58}
        favourite={false}
        onToggleFavourite={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(container.querySelector('.bg-table-head')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByText('PDF').length).toBeGreaterThan(0);
  });

  it('calls a picture JPG or PNG under its icon', () => {
    draw({ ...FILE, mimeType: 'image/jpeg' });
    expect(screen.getByText('JPG')).toBeInTheDocument();
  });

  it('shows no badge for a filed file', () => {
    draw();
    for (const status of Object.values(FileStatus)) expect(screen.queryByText(status)).toBeNull();
  });

  it.each([FileStatus.Draft, FileStatus.PendingApproval, FileStatus.Returned, FileStatus.Rejected])(
    'shows the badge %s on the corner of the thumbnail',
    (status) => {
      draw({ ...FILE, status });
      const badge = screen.getByText(status);
      expect(badge.className).toContain('absolute');
      expect(badge.className).toContain('top-2');
    },
  );

  it('opens the preview from the name', () => {
    const props = draw();
    fireEvent.click(screen.getByRole('button', { name: FILE.name }));
    expect(props.onOpen).toHaveBeenCalledTimes(1);
  });

  it('stretches the name over the whole card, so the thumbnail is a target too', () => {
    draw();
    expect(screen.getByRole('button', { name: FILE.name }).className).toContain('after:inset-0');
  });

  it('has a star that says whether the file is a favourite, and toggles it without opening the preview', () => {
    const props = draw();
    const star = screen.getByRole('button', { name: `Favourite ${FILE.name}` });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star);
    expect(props.onToggleFavourite).toHaveBeenCalledTimes(1);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('draws the star filled for a favourite', () => {
    draw(FILE, { favourite: true });
    const star = screen.getByRole('button', { name: `Favourite ${FILE.name}` });
    expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(star.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
  });

  it('draws the star as an outline when it is not a favourite', () => {
    draw();
    const star = screen.getByRole('button', { name: `Favourite ${FILE.name}` });
    expect(star.querySelector('svg')?.getAttribute('fill')).toBe('none');
  });

  it('has a name as it is written, whatever line breaks the card makes, and says the DocType in its tip', () => {
    draw();
    const name = screen.getByRole('button', { name: FILE.name });
    expect(name).toHaveAttribute('aria-label', FILE.name);
    expect(name).toHaveAttribute('title', `${FILE.name} · PAN Card`);
  });

  it('gives the star a target of 24 pixels', () => {
    draw();
    expect(screen.getByRole('button', { name: `Favourite ${FILE.name}` })).toHaveClass(
      'h-6',
      'w-6',
    );
  });

  it('keeps a strip at the top of the thumbnail for the badge, so that it never covers the icon', () => {
    const props = { iconSize: 58, favourite: false, onToggleFavourite: () => {}, onOpen: () => {} };
    const { container, rerender } = render(
      <FileCard file={{ ...FILE, status: FileStatus.Rejected }} {...props} />,
    );
    expect(container.querySelector(THUMB)).toHaveClass('pt-7');
    rerender(<FileCard file={FILE} {...props} />);
    expect(container.querySelector(THUMB)).not.toHaveClass('pt-7');
  });

  it('lines up the uploader and the chips from card to card: the name has two lines of room', () => {
    const { container } = render(
      <FileCard
        file={FILE}
        iconSize={58}
        favourite={false}
        onToggleFavourite={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(container.querySelector('.min-h-9')).not.toBeNull();
  });

  it('shows a hover on the thumbnail when the pointer is on the card', () => {
    const { container } = render(
      <FileCard
        file={FILE}
        iconSize={58}
        favourite={false}
        onToggleFavourite={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(container.firstElementChild).toHaveClass('group');
    expect(container.querySelector(THUMB)?.className).toContain('group-has-');
  });

  it('may break a long name after an underscore, and still has one accessible name', () => {
    const { container } = render(
      <FileCard
        file={{ ...FILE, name: 'Aadhaar_Masked_Copy_Vijay_Kulkarni.pdf' }}
        iconSize={58}
        favourite={false}
        onToggleFavourite={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(container.querySelectorAll('wbr').length).toBe(4);
    expect(
      screen.getByRole('button', { name: 'Aadhaar_Masked_Copy_Vijay_Kulkarni.pdf' }),
    ).toBeInTheDocument();
  });
});

describe('FilesSection', () => {
  it('opens and closes with its heading, and says which in aria-expanded', () => {
    render(
      <FilesSection title="Folders">
        <p>contents</p>
      </FilesSection>,
    );
    const heading = screen.getByRole('button', { name: 'Folders' });
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('contents')).toBeVisible();
    fireEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('contents')).not.toBeVisible();
    fireEvent.click(heading);
    expect(screen.getByText('contents')).toBeVisible();
  });

  it('points the heading at the part it opens', () => {
    render(
      <FilesSection title="Files">
        <p>contents</p>
      </FilesSection>,
    );
    const heading = screen.getByRole('button', { name: 'Files' });
    expect(document.getElementById(heading.getAttribute('aria-controls')!)).toContainElement(
      screen.getByText('contents'),
    );
  });

  it('is a region named after the heading, and keeps what is at the right end while closed', () => {
    render(
      <FilesSection title="Files" actions={<button type="button">Zoom</button>}>
        <p>contents</p>
      </FilesSection>,
    );
    expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    expect(screen.getByRole('button', { name: 'Zoom' })).toBeVisible();
  });
});

describe('ZoomControl', () => {
  it('has a minus button, a slider and a plus button', () => {
    render(<ZoomControl value={ZOOM.initial} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Smaller cards' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(screen.getByRole('button', { name: 'Larger cards' })).not.toHaveAttribute(
      'aria-disabled',
    );
    const slider = screen.getByRole('slider', { name: 'Card size' });
    expect(slider).toHaveValue(String(ZOOM.initial));
    expect(slider).toHaveAttribute('min', String(ZOOM.min));
    expect(slider).toHaveAttribute('max', String(ZOOM.max));
    expect(slider).toHaveAttribute('aria-valuetext', '100%');
  });

  it('moves one step with the buttons', () => {
    const onChange = vi.fn();
    render(<ZoomControl value={ZOOM.initial} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Larger cards' }));
    expect(onChange).toHaveBeenLastCalledWith(ZOOM.initial + ZOOM.step);
    fireEvent.click(screen.getByRole('button', { name: 'Smaller cards' }));
    expect(onChange).toHaveBeenLastCalledWith(ZOOM.initial - ZOOM.step);
  });

  it('follows the slider', () => {
    const onChange = vi.fn();
    render(<ZoomControl value={ZOOM.initial} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Card size' }), {
      target: { value: '200' },
    });
    expect(onChange).toHaveBeenCalledWith(200);
  });

  it('turns the buttons off at the ends', () => {
    const { rerender } = render(<ZoomControl value={ZOOM.min} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Smaller cards' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Larger cards' })).not.toHaveAttribute(
      'aria-disabled',
    );
    rerender(<ZoomControl value={ZOOM.max} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Larger cards' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Smaller cards' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });
});

describe('ViewToggle', () => {
  it('has a list and a grid button, and marks the one in use', () => {
    render(<ViewToggle value="grid" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('puts list before grid, as in the design', () => {
    render(<ViewToggle value="grid" onChange={() => {}} />);
    const names = within(screen.getByRole('group', { name: 'View' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['List view', 'Grid view']);
  });

  it('can be told in forced-colours mode (Windows High Contrast), where colours are dropped', () => {
    render(<ViewToggle value="grid" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Grid view' }).className).toContain(
      'forced-colors:bg-[Highlight]',
    );
    expect(screen.getByRole('button', { name: 'List view' }).className).not.toContain(
      'forced-colors:bg-[Highlight]',
    );
  });

  it('asks for the other view when it is pressed', () => {
    const onChange = vi.fn();
    render(<ViewToggle value="grid" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(onChange).toHaveBeenCalledWith('list');
  });
});

describe('FolderBreadcrumb', () => {
  const crumbs = [
    { label: 'Files & Folders', to: '/files' },
    { label: 'Loans', to: '/files?folder=loans' },
    { label: 'Home Loan', to: '/files?folder=hl' },
  ];

  it('is a navigation with a link for every part, in order', () => {
    render(
      <MemoryRouter>
        <FolderBreadcrumb crumbs={crumbs} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Files & Folders', 'Loans', 'Home Loan']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/files',
      '/files?folder=loans',
      '/files?folder=hl',
    ]);
  });

  it('marks the folder you are in as the current place, and only that one', () => {
    render(
      <MemoryRouter>
        <FolderBreadcrumb crumbs={crumbs} />
      </MemoryRouter>,
    );
    const current = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.textContent)).toEqual(['Home Loan']);
  });

  it('tells the page when a part is chosen', () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <FolderBreadcrumb crumbs={crumbs} onNavigate={onNavigate} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Loans' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('FileRowMenu with the keyboard', () => {
  const items = [
    { label: 'Preview', onSelect: () => {} },
    { label: 'Add to favourites', onSelect: () => {} },
    { label: 'Download', onSelect: () => {} },
  ];
  const open = () => {
    render(<FileRowMenu fileName="A.pdf" items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for A.pdf' }));
    return screen.getByRole('menu');
  };

  it('moves down and up between the items, and round the ends', () => {
    const menu = open();
    const [a, b, c] = within(menu).getAllByRole('menuitem');
    expect(a).toHaveFocus();
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    expect(b).toHaveFocus();
    fireEvent.keyDown(b, { key: 'ArrowDown' });
    expect(c).toHaveFocus();
    fireEvent.keyDown(c, { key: 'ArrowDown' });
    expect(a).toHaveFocus();
    fireEvent.keyDown(a, { key: 'ArrowUp' });
    expect(c).toHaveFocus();
  });

  it('goes to the first and the last item with Home and End', () => {
    const menu = open();
    const [a, , c] = within(menu).getAllByRole('menuitem');
    fireEvent.keyDown(a, { key: 'End' });
    expect(c).toHaveFocus();
    fireEvent.keyDown(c, { key: 'Home' });
    expect(a).toHaveFocus();
  });

  it('leaves other keys alone', () => {
    const menu = open();
    const [a] = within(menu).getAllByRole('menuitem');
    fireEvent.keyDown(a, { key: 'x' });
    expect(a).toHaveFocus();
  });
});

describe('FileRowMenu', () => {
  const items = [
    { label: 'Preview', onSelect: vi.fn() },
    { label: 'Add to favourites', onSelect: vi.fn() },
  ];

  beforeEach(() => items.forEach((item) => item.onSelect.mockClear()));

  it('opens a menu of what can be done, named after the file', () => {
    render(<FileRowMenu fileName="A.pdf" items={items} />);
    const kebab = screen.getByRole('button', { name: 'More actions for A.pdf' });
    expect(kebab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(kebab);
    expect(kebab).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Actions for A.pdf' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Preview', 'Add to favourites']);
  });

  it('puts the cursor on the first item', () => {
    render(<FileRowMenu fileName="A.pdf" items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for A.pdf' }));
    expect(screen.getByRole('menuitem', { name: 'Preview' })).toHaveFocus();
  });

  it('does what was chosen and closes', () => {
    render(<FileRowMenu fileName="A.pdf" items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for A.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to favourites' }));
    expect(items[1].onSelect).toHaveBeenCalledTimes(1);
    expect(items[0].onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes with Escape and gives the cursor back to the kebab', () => {
    render(<FileRowMenu fileName="A.pdf" items={items} />);
    const kebab = screen.getByRole('button', { name: 'More actions for A.pdf' });
    fireEvent.click(kebab);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(kebab).toHaveFocus();
  });
});
