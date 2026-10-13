import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

/**
 * The DMS+ app shell: sidebar at the left, top bar above, and the content area with its own
 * scroll. Every route is drawn inside it except /apply, which keeps its own standalone layout (see
 * App.tsx). A screen that breaks shows the error message in the content area only, so the sidebar
 * and the user menu keep working.
 */
export default function ShellLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // A new screen opens at its top, not where the last one was scrolled to
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => mainRef.current?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[10000] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-button-s focus:text-primary focus:shadow-card"
      >
        Skip to main content
      </button>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {/* tabIndex 0: a keyboard user can put the cursor here and scroll it with the arrow keys */}
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={0}
          className="thin-scrollbar min-h-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
