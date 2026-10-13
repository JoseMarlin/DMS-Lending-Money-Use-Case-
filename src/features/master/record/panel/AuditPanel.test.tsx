/**
 * The Audit Log panel of the record sheet, as a person uses it: a timeline, newest first, grouped by
 * day, with filter chips that count, and changes shown as old → new.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import RecordSheet from '../RecordSheet';
import { DEFAULT_SHEET_TAB, type SheetTabId } from '../recordSheetModel';
import { AUDIT_FILTERS, auditTimeline, filterCounts } from './auditLogModel';

const state = () => useAppStore.getState();
const [VIJAY, SHOBHA, , SAVITA, BASAVARAJ, MEERA, PRAKASH] = SEED_APPLICATIONS;

function Harness({ applicationId }: { applicationId: string }) {
  const [tab, setTab] = useState<SheetTabId>(DEFAULT_SHEET_TAB);
  return (
    <MemoryRouter>
      <ToastProvider>
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
  fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
  return view;
};

const sheet = () => screen.getByRole('dialog', { name: /, record$/ });
const header = () => within(sheet()).getByRole('banner');
const panel = () => screen.getByTestId('record-side-panel');
const chips = () => within(within(panel()).getByRole('group', { name: 'Filter the activity' }));
const chip = (label: string) =>
  chips().getByRole('button', { name: new RegExp(`^${label} \\d+$`) });
const countOf = (label: string) => Number(chip(label).textContent!.replace(/^\D+/, '').trim());
const entries = () => within(panel()).queryAllByRole('listitem');
const headings = () =>
  within(panel())
    .queryAllByRole('heading', { level: 4 })
    .map((h) => h.textContent);
const timelineOf = (id: string) =>
  auditTimeline(
    state().applications.find((a) => a.applicationId === id)!,
    state().auditEvents,
  );

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the panel', () => {
  it('is the Audit Log: its title, the filter chips in order, and All is on', () => {
    draw(VIJAY.applicationId);
    expect(
      within(panel()).getByRole('heading', { level: 3, name: 'Audit Log' }),
    ).toBeInTheDocument();
    expect(
      chips()
        .getAllByRole('button')
        .map((b) => b.textContent?.replace(/\s*\d+$/, '')),
    ).toEqual(['All', 'Data changes', 'Workflow', 'KYC', 'Files', 'Comments']);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Workflow')).toHaveAttribute('aria-pressed', 'false');
  });

  it('counts each chip live, and All is the whole', () => {
    draw(VIJAY.applicationId);
    const expected = filterCounts(timelineOf(VIJAY.applicationId));
    for (const f of AUDIT_FILTERS) expect(countOf(f.label)).toBe(expected[f.id]);
    const parts = AUDIT_FILTERS.filter((f) => f.id !== 'all').reduce(
      (n, f) => n + expected[f.id],
      0,
    );
    expect(expected.all).toBe(parts);
    expect(expected.all).toBeGreaterThan(20);
    expect(entries()).toHaveLength(expected.all);
  });

  it('has a full history for an approved application, newest first', () => {
    draw(VIJAY.applicationId);
    const titles = entries().map((li) => li.querySelector('p')?.textContent);
    expect(titles[0]).toBe('Comment added'); // the last thing that happened
    expect(titles.at(-1)).toBe('Application created'); // the first
    for (const wanted of [
      'Consent given',
      'KYC check run: PAN',
      'KYC result set: Pass',
      'Submitted for approval',
      'Level 1 decision: Approved',
      'Level 2 decision: Approved',
      'Record created',
      'Files stored',
      'Attachment added',
    ]) {
      expect(titles).toContain(wanted);
    }
  });

  it('groups the events by day, newest day first, each with a date as a heading', () => {
    draw(VIJAY.applicationId);
    const days = headings();
    expect(days.length).toBeGreaterThan(3);
    expect(days.every((d) => /^(Today, |Yesterday, )?\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(d!))).toBe(
      true,
    );
    expect(new Set(days).size).toBe(days.length); // a day is one group
    const times = days.map((d) => Date.parse(d!.replace(/^(Today|Yesterday), /, '')));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(days).toContain('19 Aug 2026'); // the day the attachments were added
  });

  it('shows who did it, with the role, and when, on each event', () => {
    draw(VIJAY.applicationId);
    const attachment = entries().find((li) => li.textContent?.includes('Salary_Slip_Aug.pdf'))!;
    expect(attachment).toHaveTextContent('Attachment added');
    expect(within(attachment).getByText('Priya Kulkarni')).toBeInTheDocument();
    expect(within(attachment).getByText('Loan officer')).toBeInTheDocument();
    expect(within(attachment).getByText('11:00 AM')).toBeInTheDocument();
    expect(
      within(attachment).getByText('Latest salary slip, added after the first upload'),
    ).toBeInTheDocument();
    const approval = entries().find((li) =>
      li.textContent?.includes('Level 2 decision: Approved'),
    )!;
    expect(within(approval).getByText('Sunita Hegde')).toBeInTheDocument();
    expect(within(approval).getByText('Credit approver')).toBeInTheDocument();
  });

  it('has an icon for the kind of event', () => {
    draw(VIJAY.applicationId);
    for (const kind of [
      'created',
      'consent',
      'file',
      'kyc',
      'submit',
      'approved',
      'record',
      'comment',
    ]) {
      expect(within(panel()).getAllByTestId(`audit-icon-${kind}`).length).toBeGreaterThan(0);
    }
  });

  it('keeps the Aadhaar number out of the timeline, in whatever form', () => {
    draw(VIJAY.applicationId);
    expect(panel().textContent).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
  });
});

describe('the filter chips', () => {
  it.each([
    ['Workflow', ['Submitted for approval', 'Level 1 decision: Approved', 'Record created']],
    ['KYC', ['KYC check run: PAN', 'KYC result set: Pass']],
    ['Files', ['Document uploaded: PAN Card', 'Attachment added', 'Files stored']],
    ['Comments', ['Comment added']],
    ['Data changes', ['Application created', 'Consent given']],
  ])('%s shows only its events, and the chip is on', (label, wanted) => {
    draw(VIJAY.applicationId);
    fireEvent.click(chip(label));
    expect(chip(label)).toHaveAttribute('aria-pressed', 'true');
    expect(chip('All')).toHaveAttribute('aria-pressed', 'false');
    const titles = entries().map((li) => li.querySelector('p')?.textContent);
    expect(titles).toHaveLength(countOf(label));
    for (const w of wanted) expect(titles).toContain(w);
    // nothing of another kind
    expect(titles.includes('Comment added')).toBe(label === 'Comments');
  });

  it('keep their counts while one is chosen, and All brings everything back', () => {
    draw(VIJAY.applicationId);
    const all = entries().length;
    const kyc = countOf('KYC');
    fireEvent.click(chip('KYC'));
    expect(entries()).toHaveLength(kyc);
    expect(countOf('All')).toBe(all);
    fireEvent.click(chip('All'));
    expect(entries()).toHaveLength(all);
  });

  it('drop the days that have nothing of the kind', () => {
    draw(VIJAY.applicationId);
    const all = headings().length;
    fireEvent.click(chip('Comments'));
    expect(headings().length).toBeGreaterThan(0);
    expect(headings().length).toBeLessThan(all);
  });

  it('say that there is nothing of a kind: a draft has no workflow events', () => {
    draw(PRAKASH.applicationId);
    expect(countOf('Workflow')).toBe(0);
    fireEvent.click(chip('Workflow'));
    expect(entries()).toHaveLength(0);
    expect(within(panel()).getByText('No workflow activity')).toBeInTheDocument();
    expect(within(panel()).getByText('Choose All to see everything.')).toBeInTheDocument();
    expect(within(panel()).getByRole('status')).toHaveTextContent('0 Workflow events');
  });
});

describe('each seed application has a history that makes sense', () => {
  it.each([
    [
      'an approved one (a second)',
      MEERA,
      ['Application created', 'Level 2 decision: Approved', 'Record created'],
    ],
    ['one in Level 2', SHOBHA, ['Application created', 'Level 1 decision: Approved']],
    ['a returned one', SAVITA, ['Application created', 'Returned for correction']],
    ['a rejected one', BASAVARAJ, ['Application created', 'Rejected']],
  ])('%s', (_name, app, wanted) => {
    draw(app.applicationId);
    const titles = entries().map((li) => li.querySelector('p')?.textContent);
    for (const w of wanted) expect(titles).toContain(w);
    expect(titles.at(-1)).toBe('Application created');
    expect(titles.length).toBeGreaterThan(10);
  });

  it('has, for an application in Level 2, no decision of Level 2 yet', () => {
    draw(SHOBHA.applicationId);
    const titles = entries().map((li) => li.querySelector('p')?.textContent);
    expect(titles.some((t) => t?.startsWith('Level 2 decision'))).toBe(false);
    expect(titles).not.toContain('Record created');
  });

  it('is told for a draft by what the application holds: created, its documents, the consent, the checks', () => {
    draw(PRAKASH.applicationId);
    const titles = entries().map((li) => li.querySelector('p')?.textContent);
    expect(titles.at(-1)).toBe('Application created');
    expect(titles).toContain('Document uploaded: PAN Card');
    expect(titles).toContain('Comment added');
    expect(titles).not.toContain('Submitted for approval');
    expect(countOf('Files')).toBeGreaterThan(0);
  });
});

describe('it follows what happens while it is open', () => {
  it('shows a comment that is added in the Comments panel, at once, under Today', () => {
    draw(VIJAY.applicationId);
    const before = countOf('Comments');
    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));
    fireEvent.change(within(panel()).getByRole('textbox'), {
      target: { value: 'Called the applicant' },
    });
    fireEvent.click(within(panel()).getByRole('button', { name: /^(Post|Add comment|Send)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
    expect(countOf('Comments')).toBe(before + 1);
    expect(headings()[0]).toMatch(/^Today, /);
    expect(entries()[0]).toHaveTextContent('Comment added');
    expect(entries()[0]).toHaveTextContent('Called the applicant');
    expect(entries()[0]).toHaveTextContent('Priya Kulkarni');
  });

  it('shows an attachment that is added in the Files and Attachments panel', () => {
    draw(VIJAY.applicationId);
    const before = countOf('Files');
    fireEvent.click(screen.getByRole('button', { name: /^Files and Attachments/ }));
    fireEvent.change(screen.getByTestId('record-attach-input'), {
      target: {
        files: [new File([new Uint8Array(100)], 'Late_Bill.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Attach file' })).getByRole('button', {
        name: 'Attach',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
    expect(countOf('Files')).toBe(before + 1);
    expect(entries()[0]).toHaveTextContent('Attachment added');
    expect(entries()[0]).toHaveTextContent('Late_Bill.pdf');
    expect(headings()[0]).toMatch(/^Today, /);
  });

  it('keeps the chosen chip when something new arrives', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(chip('Comments'));
    const before = entries().length;
    act(() => {
      state().addRecordComment(VIJAY.applicationId, 'One more');
    });
    expect(chip('Comments')).toHaveAttribute('aria-pressed', 'true');
    expect(entries()).toHaveLength(before + 1);
  });
});

describe('a change of a value', () => {
  const typeInto = (text: string, value: string) => {
    const el = within(sheet()).getByLabelText(new RegExp(`^${text}\\*?$`));
    fireEvent.change(el, { target: { value } });
    fireEvent.blur(el);
  };

  it('reads old → new, with who changed it; an edit by the administrator says so, with its reason', () => {
    draw(VIJAY.applicationId, 'admin');
    fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(sheet()).getByRole('tab', { name: /^Property/ }));
    typeInto('Estimated Cost', '3000000');
    fireEvent.click(within(header()).getByRole('button', { name: 'Save changes' }));
    const reason = screen.getByRole('dialog', { name: 'Reason for change' });
    fireEvent.change(within(reason).getByRole('textbox', { name: /^Reason for change/ }), {
      target: { value: 'Valuation was revised' },
    });
    fireEvent.click(within(reason).getByRole('button', { name: 'Save changes' }));

    const entry = entries().find((li) => li.textContent?.includes('Estimated Cost changed'))!;
    expect(entry).toBeDefined();
    expect(entry).toHaveTextContent('Estimated Cost changed by the administrator');
    expect(entry).toHaveTextContent('from');
    expect(entry).toHaveTextContent('28,00,000');
    expect(entry).toHaveTextContent('30,00,000');
    expect(entry).toHaveTextContent('Reason for change: Valuation was revised');
    expect(within(entry).getByText('Admin')).toBeInTheDocument();
    expect(headings()[0]).toMatch(/^Today, /);
    // and it is a data change
    fireEvent.click(chip('Data changes'));
    const titles = entries().map((li) => li.querySelector('p')?.textContent);
    expect(titles).toContain('Estimated Cost changed by the administrator');
    expect(titles).toContain('Eligible Amount changed by the administrator'); // the amount that follows from the cost
    expect(titles).not.toContain('Comment added');
  });

  it('is shown for a field that was edited by the officer, without the word administrator', () => {
    draw(SAVITA.applicationId); // returned: the officer who made it edits it
    fireEvent.click(within(header()).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(sheet()).getByRole('tab', { name: /^Applicant/ }));
    typeInto('Mobile', '9000000001');
    fireEvent.click(within(header()).getByRole('button', { name: 'Save changes' }));
    const entry = entries().find((li) => li.textContent?.includes('Mobile changed'))!;
    expect(entry).toBeDefined();
    expect(entry).not.toHaveTextContent('administrator');
    expect(entry).toHaveTextContent('9000000001');
    expect(within(entry).getByText('Priya Kulkarni')).toBeInTheDocument();
  });
});
