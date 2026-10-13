import { useEffect } from 'react';

/** Puts the name of the screen in the browser tab, for example "Dashboard | DMS+". */
export function usePageTitle(title: string) {
  useEffect(() => {
    const before = document.title;
    document.title = `${title} | DMS+`;
    return () => {
      document.title = before;
    };
  }, [title]);
}
