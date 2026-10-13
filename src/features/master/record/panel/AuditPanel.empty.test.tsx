/** The Audit Log of an application that has no events at all (the empty state). */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SEED_APPLICATIONS } from '@/data/seed';
import AuditPanel from './AuditPanel';

// every application has at least its creation in practice, so the empty state is drawn from an empty timeline
vi.mock('./auditLogModel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./auditLogModel')>()),
  auditTimeline: () => [],
}));

describe('an Audit Log with nothing in it', () => {
  it('says "No activity yet", with every filter at 0 and no day headings', () => {
    render(<AuditPanel application={SEED_APPLICATIONS[0]} />);
    expect(screen.getByText('No activity yet', { selector: 'p' })).toBeInTheDocument();
    expect(
      screen.getByText('What happens to this application will be listed here.'),
    ).toBeInTheDocument();
    const chips = within(screen.getByRole('group', { name: 'Filter the activity' }));
    for (const b of chips.getAllByRole('button')) expect(b).toHaveTextContent(/ 0$/);
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('No activity yet');
  });

  it('keeps saying so when a filter is chosen, but as that filter having nothing', () => {
    render(<AuditPanel application={SEED_APPLICATIONS[0]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Files 0$/ }));
    expect(screen.getByText('No activity yet', { selector: 'p' })).toBeInTheDocument();
  });
});
