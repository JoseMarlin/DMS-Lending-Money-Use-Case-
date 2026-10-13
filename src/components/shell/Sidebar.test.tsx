import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { STORAGE_KEY, useAppStore } from '@/data/store';
import Sidebar from './Sidebar';

const state = () => useAppStore.getState();

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

const main = () => screen.getByRole('navigation', { name: 'Main' });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
  if (state().sidebarCollapsed) state().toggleSidebar();
});

describe('Sidebar items', () => {
  it('lists the nine sections in the order of the design, each with its address', () => {
    renderAt('/dashboard');
    const links = within(main()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Files & Folders',
      'Magic Folder',
      'Favourite',
      'Advance Search',
      'Metadata',
      'Workflow',
      'Reports',
      'Settings',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard',
      '/files',
      '/magic-folder',
      '/favourite',
      '/advance-search',
      '/metadata/master/home-loan',
      '/workflow',
      '/reports',
      '/settings',
    ]);
  });

  it('puts Bin and the collapse button at the bottom, outside the list', () => {
    renderAt('/dashboard');
    const bin = screen.getByRole('link', { name: 'Bin' });
    expect(bin).toHaveAttribute('href', '/bin');
    expect(main()).not.toContainElement(bin);
    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    // Bin comes before the collapse button in the page
    expect(bin.compareDocumentPosition(collapse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has the logo at the top as a link home, and an app launcher button', () => {
    renderAt('/files');
    expect(screen.getByRole('link', { name: 'DMS+ home' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('button', { name: 'DMS+ apps' })).toBeInTheDocument();
    expect(screen.getByText('DMS+')).toBeInTheDocument();
    expect(screen.getByText(/dMACQ/)).toBeInTheDocument();
  });

  it('is 240px wide and navy', () => {
    renderAt('/dashboard');
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    expect(sidebar).toHaveClass('w-sidebar', 'bg-sidebar');
  });
});

describe('Sidebar active item', () => {
  it.each([
    ['/dashboard', 'Dashboard'],
    ['/files', 'Files & Folders'],
    ['/magic-folder', 'Magic Folder'],
    ['/favourite', 'Favourite'],
    ['/advance-search', 'Advance Search'],
    ['/metadata/master/home-loan', 'Metadata'],
    ['/workflow', 'Workflow'],
    ['/reports', 'Reports'],
    ['/settings', 'Settings'],
    ['/bin', 'Bin'],
  ])('at %s the active item is %s, and only that one', (path, label) => {
    renderAt(path);
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it('keeps Metadata active on any page below it', () => {
    renderAt('/metadata/master/home-loan/HL-2026-0001');
    expect(screen.getByRole('link', { name: 'Metadata' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not treat a similar address as active', () => {
    renderAt('/metadata-other');
    expect(
      screen.queryAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0);
  });

  it('marks the active item with the blue bar and the gradient, and no other item', () => {
    renderAt('/workflow');
    const active = screen.getByRole('link', { name: 'Workflow' });
    expect(active.querySelector('.bg-sidebar-indicator')).not.toBeNull();
    expect(active.className).toContain('--color-sidebar-active-from');
    expect(active).toHaveClass('text-white');
    const other = screen.getByRole('link', { name: 'Reports' });
    expect(other.querySelector('.bg-sidebar-indicator')).toBeNull();
    expect(other.className).not.toContain('--color-sidebar-active-from');
  });
});

describe('Magic Folder', () => {
  it('has the sparkle icon and is drawn dimmed, as a section that is not in the demo', () => {
    renderAt('/dashboard');
    const link = screen.getByRole('link', { name: 'Magic Folder' });
    expect(link).toHaveClass('text-sidebar-ink-dim');
    expect(link).not.toHaveClass('text-sidebar-ink');
    expect(link.querySelector('svg')).not.toBeNull();
    // the others keep the normal colour
    expect(screen.getByRole('link', { name: 'Favourite' })).toHaveClass('text-sidebar-ink');
  });

  it('sits between Files & Folders and Favourite', () => {
    renderAt('/dashboard');
    const names = within(main())
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(names.indexOf('Magic Folder')).toBe(names.indexOf('Files & Folders') + 1);
    expect(names.indexOf('Favourite')).toBe(names.indexOf('Magic Folder') + 1);
  });

  it('is lit up like any other item when it is the page, and not dimmed then', () => {
    renderAt('/magic-folder');
    const link = screen.getByRole('link', { name: 'Magic Folder' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('text-white');
    expect(link).not.toHaveClass('text-sidebar-ink-dim');
  });

  it('keeps its name on the rail when the sidebar is collapsed', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fireEvent.focus(screen.getByRole('link', { name: 'Magic Folder' }));
    expect(screen.getByTestId('sidebar-tooltip')).toHaveTextContent('Magic Folder');
  });
});

describe('Sidebar collapse', () => {
  it('starts open', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(state().sidebarCollapsed).toBe(false);
  });

  it('names the button by what it will do, and does not also say expanded or collapsed', () => {
    // a button whose name changes and that also reports a state would be read out twice over
    renderAt('/dashboard');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).not.toHaveAttribute(
      'aria-expanded',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).not.toHaveAttribute(
      'aria-expanded',
    );
  });

  it('collapses to a narrow rail, and every item keeps its name', () => {
    renderAt('/reports');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    expect(sidebar).toHaveClass('w-sidebar-collapsed');
    expect(sidebar).not.toHaveClass('w-sidebar');
    expect(state().sidebarCollapsed).toBe(true);
    // the words are hidden from the eye but still name each link
    for (const name of ['Dashboard', 'Files & Folders', 'Workflow', 'Settings', 'Bin']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
    // the launcher goes, the logo mark stays
    expect(screen.queryByRole('button', { name: 'DMS+ apps' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DMS+ home' })).toBeInTheDocument();
    expect(screen.queryByText('DMS+')).not.toBeInTheDocument();
  });

  it('expands again with the same button', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('w-sidebar');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(state().sidebarCollapsed).toBe(false);
  });

  it('is remembered after a reload', async () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const saved = localStorage.getItem(STORAGE_KEY)!;
    expect(JSON.parse(saved).state.sidebarCollapsed).toBe(true);
    useAppStore.setState({ sidebarCollapsed: false });
    localStorage.setItem(STORAGE_KEY, saved);
    await useAppStore.persist.rehydrate();
    expect(state().sidebarCollapsed).toBe(true);
  });

  it('is not undone by Reset demo: it is a screen setting, not demo data', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    state().resetDemo();
    expect(state().sidebarCollapsed).toBe(true);
  });

  it('shows no label text while collapsed, so nothing is cut off', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const label = within(screen.getByRole('link', { name: 'Dashboard' })).getByText('Dashboard');
    expect(label).toHaveClass('sr-only');
  });
});

describe('Sidebar tooltips for the icons that have no words', () => {
  const tip = () => screen.queryByTestId('sidebar-tooltip');

  it('shows the name of a rail item on hover, and takes it away when the pointer leaves', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const link = screen.getByRole('link', { name: 'Workflow' });
    fireEvent.mouseEnter(link);
    expect(tip()).toHaveTextContent('Workflow');
    fireEvent.mouseLeave(link);
    expect(tip()).not.toBeInTheDocument();
  });

  it('shows it when the keyboard is on the item, too, and takes it away when the cursor moves on', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const link = screen.getByRole('link', { name: 'Reports' });
    fireEvent.focus(link);
    expect(tip()).toHaveTextContent('Reports');
    fireEvent.blur(link);
    expect(tip()).not.toBeInTheDocument();
  });

  it('has a tooltip for Bin on the rail', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fireEvent.focus(screen.getByRole('link', { name: 'Bin' }));
    expect(tip()).toHaveTextContent('Bin');
  });

  it('has none for the items of the open sidebar, which show their words', () => {
    renderAt('/dashboard');
    fireEvent.focus(screen.getByRole('link', { name: 'Workflow' }));
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Workflow' }));
    expect(tip()).not.toBeInTheDocument();
  });

  it('has one for the collapse button and the apps button, which are only icons', () => {
    renderAt('/dashboard');
    fireEvent.focus(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(tip()).toHaveTextContent('Collapse sidebar');
    fireEvent.blur(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'DMS+ apps' }));
    expect(tip()).toHaveTextContent('DMS+ apps');
  });

  it('says "Expand sidebar" on the collapse button once the rail is narrow', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(tip()).toHaveTextContent('Expand sidebar');
  });

  it('is gone after the sidebar is collapsed or expanded, so it is never in the wrong place', () => {
    renderAt('/dashboard');
    const button = screen.getByRole('button', { name: 'Collapse sidebar' });
    fireEvent.mouseEnter(button);
    expect(tip()).toBeInTheDocument();
    fireEvent.click(button);
    expect(tip()).not.toBeInTheDocument();
  });

  it('is only for the eye: a screen reader gets the names from the controls', () => {
    renderAt('/dashboard');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'DMS+ apps' }));
    expect(tip()).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Sidebar landmarks and other cues', () => {
  it('puts Bin in a navigation landmark of its own, so every destination is in one', () => {
    renderAt('/dashboard');
    const secondary = screen.getByRole('navigation', { name: 'Secondary' });
    expect(within(secondary).getByRole('link', { name: 'Bin' })).toBeInTheDocument();
    // the collapse button is a control, not a destination
    expect(within(secondary).queryByRole('button')).not.toBeInTheDocument();
  });

  it('has the sidebar clip what is inside it, so nothing spills out while it is resizing', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('overflow-hidden');
  });

  it('gives the current item a real border in forced-colours mode (Windows High Contrast)', () => {
    renderAt('/workflow');
    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveClass('forced-colors:border-l-4');
    expect(screen.getByRole('link', { name: 'Reports' })).not.toHaveClass(
      'forced-colors:border-l-4',
    );
  });

  it('marks the active item whatever the letter case of the address', () => {
    renderAt('/DASHBOARD');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Metadata active for a mixed-case address below it', () => {
    renderAt('/Metadata/Master/Home-Loan');
    expect(screen.getByRole('link', { name: 'Metadata' })).toHaveAttribute('aria-current', 'page');
  });
});
