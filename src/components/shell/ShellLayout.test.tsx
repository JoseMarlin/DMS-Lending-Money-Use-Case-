import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '@/App';
import { useAppStore } from '@/data/store';
import ShellLayout from './ShellLayout';

const state = () => useAppStore.getState();

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const sidebar = () => screen.getByRole('complementary', { name: 'Sidebar' });
const heading = () => screen.getByRole('heading', { level: 1 });

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
  if (state().sidebarCollapsed) state().toggleSidebar();
  document.title = 'DMS+ | Home Loan Prototype';
});

describe('the shell is drawn on every route except /apply', () => {
  it.each([
    '/dashboard',
    '/files',
    '/metadata/master/home-loan',
    '/workflow',
    '/magic-folder',
    '/favourite',
    '/advance-search',
    '/reports',
    '/settings',
    '/bin',
    '/demo/components',
  ])('%s has the sidebar, the top bar and one content area', (path) => {
    renderApp(path);
    expect(sidebar()).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Account menu for / })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('/apply keeps its standalone layout: no sidebar, no top bar, no search', () => {
    renderApp('/apply');
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Account menu for / })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home Loan Application' })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('the content area has its own scroll, under the top bar and beside the sidebar', () => {
    renderApp('/dashboard');
    const main = screen.getByRole('main');
    expect(main).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1');
    expect(main.closest('.h-screen')).toHaveClass('overflow-hidden');
  });
});

describe('the routes', () => {
  it.each([
    ['/dashboard', 'Dashboard'],
    ['/files', 'Files & Folders'],
    ['/metadata/master/home-loan', 'Home Loan Application'],
    ['/workflow', 'Workflow'],
    ['/magic-folder', 'Magic Folder'],
    ['/favourite', 'Favourite'],
    ['/advance-search', 'Advance Search'],
    ['/reports', 'Reports'],
    ['/settings', 'Settings'],
    ['/bin', 'Bin'],
  ])('%s opens "%s"', (path, title) => {
    renderApp(path);
    expect(heading()).toHaveTextContent(title);
    expect(document.title).toBe(`${title} | DMS+`);
  });

  it.each(['/favourite', '/advance-search', '/reports', '/settings', '/bin'])(
    '%s says it is not part of this demo, inside the shell',
    (path) => {
      renderApp(path);
      expect(screen.getByRole('heading', { name: 'Not part of this demo' })).toBeInTheDocument();
      expect(sidebar()).toBeInTheDocument();
    },
  );

  it.each(['/dashboard', '/files', '/metadata/master/home-loan', '/workflow'])(
    '%s is a screen of the demo, so it does not say "not part of this demo"',
    (path) => {
      renderApp(path);
      expect(screen.queryByText('Not part of this demo')).not.toBeInTheDocument();
    },
  );

  it('sends the root and unknown addresses to the dashboard', () => {
    renderApp('/');
    expect(heading()).toHaveTextContent('Dashboard');
  });
});

describe('moving around with the sidebar', () => {
  it('opens the section that was clicked, and the active item follows', () => {
    renderApp('/dashboard');
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Reports' }));
    expect(heading()).toHaveTextContent('Reports');
    expect(within(sidebar()).getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('Metadata opens the Home Loan master', () => {
    renderApp('/dashboard');
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Metadata' }));
    expect(heading()).toHaveTextContent('Home Loan Application');
    expect(within(sidebar()).getByRole('link', { name: 'Metadata' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('Bin opens from the bottom of the sidebar', () => {
    renderApp('/dashboard');
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Bin' }));
    expect(heading()).toHaveTextContent('Bin');
    expect(within(sidebar()).getByRole('link', { name: 'Bin' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the sidebar collapsed while moving between sections', () => {
    renderApp('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Workflow' }));
    expect(heading()).toHaveTextContent('Workflow');
    expect(sidebar()).toHaveClass('w-sidebar-collapsed');
  });
});

describe('the user, as seen from the shell', () => {
  it('the dashboard says who is acting and what they can do', () => {
    renderApp('/dashboard');
    expect(
      screen.getByRole('heading', { name: 'Signed in as Priya Kulkarni' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Create and submit Home Loan applications')).toBeInTheDocument();
  });

  it.each([
    ['Mahesh', 'Signed in as Mahesh Joshi', /Review applications at Level 1/, 'MJ'],
    ['Sunita', 'Signed in as Sunita Hegde', /Review applications at Level 2/, 'SH'],
    ['Admin', 'Signed in as Admin', /See every application/, 'AD'],
  ])(
    'acting as %s changes the avatar, the dashboard and the bell with no reload',
    (first, title, action, initials) => {
      renderApp('/dashboard');
      fireEvent.click(screen.getByRole('button', { name: /^Account menu for / }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${first}`) }));
      expect(screen.getByTestId('avatar')).toHaveTextContent(initials);
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByText(action)).toBeInTheDocument();
      // what only the loan officer can do is gone
      expect(
        screen.queryByText('Correct and resubmit applications that were returned'),
      ).not.toBeInTheDocument();
    },
  );

  it('the DemoPanel no longer has the user switcher', () => {
    renderApp('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Demo controls' }));
    expect(screen.queryByLabelText('Act as')).not.toBeInTheDocument();
  });
});

describe('keyboard', () => {
  it('has a skip link that puts the cursor in the content area', () => {
    renderApp('/dashboard');
    const skip = screen.getByRole('button', { name: 'Skip to main content' });
    fireEvent.click(skip);
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('the skip link comes before everything else', () => {
    renderApp('/dashboard');
    const skip = screen.getByRole('button', { name: 'Skip to main content' });
    const first = screen.getByRole('link', { name: 'DMS+ home' });
    expect(skip.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('a screen that breaks', () => {
  function Boom(): never {
    throw new Error('boom');
  }

  it('shows the message in the content area and leaves the sidebar and the user menu working', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route path="/broken" element={<Boom />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on this page');
    expect(sidebar()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Account menu for / })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    vi.restoreAllMocks();
  });
});

describe('the content area', () => {
  it('can take the keyboard, so it can be scrolled with the arrow keys', () => {
    renderApp('/dashboard');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('tabindex', '0');
    main.focus();
    expect(main).toHaveFocus();
  });

  it('opens each new screen at its top', () => {
    renderApp('/dashboard');
    const main = screen.getByRole('main');
    main.scrollTop = 240;
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Reports' }));
    expect(main.scrollTop).toBe(0);
  });

  it('shows the skip link with room around its text when it is reached', () => {
    renderApp('/dashboard');
    const skip = screen.getByRole('button', { name: 'Skip to main content' });
    // the padding is on the "focused" variants, so it is not wiped by the one that shows the link
    expect(skip.className).toContain('focus:px-3');
    expect(skip.className).toContain('focus:py-2');
    expect(skip.className.indexOf('focus:not-sr-only')).toBeLessThan(
      skip.className.indexOf('focus:px-3'),
    );
  });
});
