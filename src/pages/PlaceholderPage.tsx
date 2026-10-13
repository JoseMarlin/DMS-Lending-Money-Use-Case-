import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/usePageTitle';

interface PlaceholderPageProps {
  title: string;
  /** One line under the title */
  note?: string;
  children?: ReactNode;
}

/** A screen that is not built yet: its name, a line saying when, and optionally something more. */
export default function PlaceholderPage({ title, note, children }: PlaceholderPageProps) {
  usePageTitle(title);
  return (
    <div className="px-5 py-6">
      <h1 className="text-heading-s text-label">{title}</h1>
      {note ? <p className="mt-1 text-body-m text-subtle">{note}</p> : null}
      {children}
    </div>
  );
}
