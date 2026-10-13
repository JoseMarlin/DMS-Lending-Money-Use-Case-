import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsMenu from '@/components/shell/NotificationsMenu';
import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import RecordSheet from './RecordSheet';
import { DEFAULT_SHEET_TAB, SHEET_TABS, type SheetTabId } from './recordSheetModel';

const state = () => useAppStore.getState();
const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ] = SEED_APPLICATIONS;

/** The sheet with its own tab, as the list page keeps it in the address. */
function Harness({
  applicationId,
  onClose = () => {},
  startTab = DEFAULT_SHEET_TAB,
}: {
  applicationId: string;
  onClose?: () => void;
  startTab?: SheetTabId;
}) {
  const [tab, setTab] = useState<SheetTabId>(startTab);
  return (
    <MemoryRouter>
      <button type="button">Behind the sheet</button>
      <RecordSheet applicationId={applicationId} tab={tab} onTabChange={setTab} onClose={onClose} />
    </MemoryRouter>
  );
}

const draw = (applicationId: string, extra: Partial<Parameters<typeof Harness>[0]> = {}) =>
  render(<Harness applicationId={applicationId} {...extra} />);

const sheet = () => screen.getByRole('dialog');
const header = () => within(sheet()).getByRole('banner');
const tab = (name: string) => within(sheet()).getByRole('tab', { name });
const value = (label: string) =>
  within(sheet()).getByText(label, { selector: 'dt' }).nextElementSibling!;
const actAs = (id: DemoUserId) => state().setCurrentUser(id);

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the sheet', () => {
  it('is a dialog named after the record', () => {
    draw(VIJAY.applicationId);
    expect(screen.getByRole('dialog', { name: 'Vijay Kulkarni, record' })).toBeInTheDocument();
    expect(sheet()).toHaveAttribute('aria-modal', 'true');
  });

  it('slides up from the bottom, 250ms, below the 56px top bar and over the sidebar', () => {
    draw(VIJAY.applicationId);
    expect(sheet().className).toContain('animate-sheet-up');
    expect(sheet().className).toContain('motion-reduce:animate-none');
    expect(sheet().className).toContain('fixed');
    expect(sheet().className).toContain('top-header');
    expect(sheet().className).toContain('inset-x-0');
    expect(sheet().className).toContain('bottom-0');
    // above the sidebar (static) but below the dropdowns of the top bar and the dialogs (10000)
    expect(sheet().className).toMatch(/z-\[9000\]/);
  });

  it('dims nothing: there is no backdrop', () => {
    draw(VIJAY.applicationId);
    expect(document.querySelector('.bg-header\\/60')).toBeNull();
  });
});

describe('the header', () => {
  it('has the applicant name, and the status chip of the master list beside it', () => {
    draw(VIJAY.applicationId);
    expect(within(header()).getByRole('heading', { name: 'Vijay Kulkarni' })).toBeInTheDocument();
    expect(within(header()).getByText('Approved')).toBeInTheDocument();
  });

  it.each([
    [MANJUNATH.applicationId, 'In-Progress'],
    [SHOBHA.applicationId, 'In-Progress'],
    [SAVITA.applicationId, 'Action Required'],
    [BASAVARAJ.applicationId, 'Rejected'],
  ])('shows the chip of %s as %s, as the list does', (id, chip) => {
    draw(id);
    expect(within(header()).getByText(chip)).toBeInTheDocument();
  });

  it('has a search box, and Edit, View workflow and Close on the right', () => {
    draw(VIJAY.applicationId);
    expect(
      within(header()).getByRole('textbox', { name: 'Search the fields of this tab' }),
    ).toHaveAttribute('placeholder', 'Search');
    expect(within(header()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(header()).getByText('View workflow')).toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: 'Close record' })).toBeInTheDocument();
  });

  it('has no Reject or Accept', () => {
    draw(VIJAY.applicationId);
    expect(within(sheet()).queryByRole('button', { name: /reject|accept|approve/i })).toBeNull();
  });

  it('has an Edit button that does nothing for a user who may not edit the record', () => {
    // Priya may not edit an approved record: only the administrator may
    draw(VIJAY.applicationId);
    const edit = within(header()).getByRole('button', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(edit);
    expect(within(header()).queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is named after the Application ID when the name is not entered yet', () => {
    state().updateDraft({ fullNameAsPerPan: '' });
    state().saveApplication(state().draft);
    draw(state().draft.applicationId);
    expect(within(header()).getByRole('heading')).toHaveTextContent(state().draft.applicationId);
  });
});

describe('the tabs', () => {
  it('are Application, Applicant, Identity, Property, Sureties, KYC and Approval, the first selected', () => {
    draw(VIJAY.applicationId);
    const tabs = within(sheet()).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(SHEET_TABS.map((t) => t.label));
    expect(tab('Application')).toHaveAttribute('aria-selected', 'true');
    expect(within(sheet()).getByRole('tablist', { name: 'Record sections' })).toBeInTheDocument();
  });

  it.each(SHEET_TABS)('$label shows the heading "$heading"', ({ label, heading }) => {
    draw(VIJAY.applicationId);
    fireEvent.click(tab(label));
    expect(within(sheet()).getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
    expect(tab(label)).toHaveAttribute('aria-selected', 'true');
  });

  it('move with the arrow keys', () => {
    draw(VIJAY.applicationId);
    tab('Application').focus();
    fireEvent.keyDown(tab('Application'), { key: 'ArrowRight' });
    expect(tab('Applicant')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Applicant')).toHaveFocus();
  });

  it('start on the tab the page asks for', () => {
    draw(VIJAY.applicationId, { startTab: 'kyc' });
    expect(tab('KYC')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('the fields', () => {
  it('are a muted label over a bold value, in a four-column grid', () => {
    draw(VIJAY.applicationId);
    const grid = within(sheet()).getByText('Application ID', { selector: 'dt' }).closest('dl')!;
    expect(grid.className).toContain('min-[1200px]:grid-cols-4');
    expect(within(sheet()).getByText('Application ID', { selector: 'dt' })).toHaveClass(
      'text-subtle',
    );
    expect(value('Application ID')).toHaveClass('font-semibold');
    expect(value('Application ID')).toHaveTextContent(VIJAY.applicationId);
  });

  it('write amounts the Indian way and dates as DD MMM YYYY', () => {
    draw(VIJAY.applicationId);
    expect(value('Loan Amount Requested')).toHaveTextContent('₹ 20,00,000');
    expect(value('Application Date')).toHaveTextContent('18 Aug 2026');
  });

  it('give the addresses two columns', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(tab('Applicant'));
    expect(value('Address').parentElement).toHaveClass('col-span-2');
    expect(value('Mobile').parentElement).not.toHaveClass('col-span-2');
    fireEvent.click(tab('Property'));
    expect(value('Property Address').parentElement).toHaveClass('col-span-2');
  });

  it('show a dash for an empty value, and say so to a screen reader', () => {
    draw(MANJUNATH.applicationId);
    fireEvent.click(tab('Approval'));
    expect(value('Level 2 Approver')).toHaveTextContent('-');
    expect(within(value('Level 2 Approver') as HTMLElement).getByText('Not provided')).toHaveClass(
      'sr-only',
    );
  });

  it('show the Aadhaar masked and no full number anywhere in the sheet', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(tab('Identity'));
    expect(value('Aadhaar')).toHaveTextContent('XXXX XXXX 3345');
    for (const { label } of SHEET_TABS) {
      fireEvent.click(tab(label));
      expect(sheet().textContent).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
    }
  });

  it('show the GSTIN only for a Business or Professional applicant', () => {
    const { unmount } = draw(VIJAY.applicationId);
    fireEvent.click(tab('Identity'));
    expect(within(sheet()).queryByText('GSTIN', { selector: 'dt' })).toBeNull();
    unmount();
    draw(SHOBHA.applicationId);
    fireEvent.click(tab('Identity'));
    expect(value('GSTIN')).toHaveTextContent('29ABCPM3302N1Z3');
  });

  it('show the KYC result as a badge', () => {
    draw(BASAVARAJ.applicationId);
    fireEvent.click(tab('KYC'));
    expect(
      within(value('KYC Overall Result') as HTMLElement).getByText(
        /Pass|Exception|Fail|Not checked/,
      ),
    ).toBeInTheDocument();
    expect(value('KYC Exception Remark')).toHaveTextContent('Middle initial missing');
  });

  it('give the remarks of an approval a row of their own, so that a level starts on a new row', () => {
    draw(BASAVARAJ.applicationId);
    fireEvent.click(tab('Approval'));
    expect(value('Level 1 Remarks').parentElement).toHaveClass('col-span-full');
    expect(value('Level 2 Remarks').parentElement).toHaveClass('col-span-full');
    expect(value('Level 2 Approver').parentElement).not.toHaveClass('col-span-full');
  });

  it('show the approvals of a rejected application', () => {
    draw(BASAVARAJ.applicationId);
    fireEvent.click(tab('Approval'));
    expect(value('Level 1 Approver')).toHaveTextContent('Mahesh Joshi');
    expect(value('Level 2 Decision')).toHaveTextContent('Rejected');
    expect(value('Level 2 Remarks')).toHaveTextContent('Repayment capacity is not enough');
  });

  it('show the sanction of an approved application', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(tab('Approval'));
    expect(value('Sanctioned Amount')).toHaveTextContent('₹ 20,00,000');
    expect(value('Sanction Date')).toHaveTextContent('26 Aug 2026');
  });

  it('start a new tab at the top', () => {
    draw(VIJAY.applicationId);
    const panel = within(sheet()).getByRole('tabpanel');
    panel.scrollTop = 120;
    fireEvent.click(tab('Applicant'));
    expect(within(sheet()).getByRole('tabpanel').scrollTop).toBe(0);
  });
});

describe('the search box', () => {
  const type = (text: string) =>
    fireEvent.change(
      within(header()).getByRole('textbox', { name: 'Search the fields of this tab' }),
      {
        target: { value: text },
      },
    );

  it('keeps the fields of the current tab whose label has the text', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(tab('Applicant'));
    type('mobile');
    expect(
      within(sheet())
        .getAllByRole('term')
        .map((t) => t.textContent),
    ).toEqual(['Mobile']);
  });

  it('keeps the fields whose value has the text', () => {
    draw(VIJAY.applicationId);
    type('Belagavi');
    expect(
      within(sheet())
        .getAllByRole('term')
        .map((t) => t.textContent),
    ).toEqual(['Branch']);
  });

  it('says so when no field has it, and brings them all back when it is cleared', () => {
    draw(VIJAY.applicationId);
    type('zzzz');
    expect(within(sheet()).queryAllByRole('term')).toHaveLength(0);
    expect(
      within(within(sheet()).getByRole('tabpanel')).getByText(/No field of this tab has “zzzz”/),
    ).toBeVisible();
    type('');
    expect(within(sheet()).getAllByRole('term').length).toBe(7);
  });

  it('searches the tab that is open', () => {
    draw(VIJAY.applicationId);
    type('PAN');
    fireEvent.click(tab('Identity'));
    expect(
      within(sheet())
        .getAllByRole('term')
        .map((t) => t.textContent),
    ).toEqual(['PAN']);
  });
});

describe('what a screen reader is told about the search', () => {
  const live = () => sheet().querySelector('[aria-live=polite]') as HTMLElement;
  const type = (text: string) =>
    fireEvent.change(
      within(header()).getByRole('textbox', { name: 'Search the fields of this tab' }),
      {
        target: { value: text },
      },
    );

  it('has a polite region that is empty until something is searched for', () => {
    draw(VIJAY.applicationId);
    expect(live()).toBeEmptyDOMElement();
  });

  it('says how many fields the search leaves, and when there are none', () => {
    draw(VIJAY.applicationId);
    type('Branch');
    expect(live()).toHaveTextContent('1 of 7 fields shown');
    type('zzzz');
    expect(live()).toHaveTextContent('No field of this tab has “zzzz” in its label or value');
    type('');
    expect(live()).toBeEmptyDOMElement();
  });

  it('is the same element when the tab changes, so that a change is announced and a tab is not', () => {
    draw(VIJAY.applicationId);
    const before = live();
    fireEvent.click(tab('Applicant'));
    expect(live()).toBe(before);
  });

  it('has a no-match message that breaks a long word instead of running off the side', () => {
    draw(VIJAY.applicationId);
    type('x'.repeat(150));
    expect(
      within(within(sheet()).getByRole('tabpanel')).getByText(/No field of this tab has/),
    ).toHaveClass('[overflow-wrap:anywhere]');
  });
});

describe('the banner under the tabs', () => {
  it('has none for an approved record', () => {
    draw(VIJAY.applicationId);
    expect(within(sheet()).queryByRole('status')).toBeNull();
    expect(within(sheet()).queryByRole('alert')).toBeNull();
  });

  it('says where an application in progress is waiting', () => {
    const { unmount } = draw(MANJUNATH.applicationId);
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Pending approval at Level 1');
    unmount();
    draw(SHOBHA.applicationId);
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Pending approval at Level 2');
  });

  it("gives the reviewer's comment for a returned application", () => {
    draw(SAVITA.applicationId);
    const banner = within(sheet()).getByRole('status');
    expect(banner).toHaveTextContent('Returned for correction by Mahesh Joshi (Level 1)');
    expect(banner).toHaveTextContent(
      'Income Proof is not readable. Upload a clear copy and resubmit.',
    );
  });

  it('gives the reason for a rejected one', () => {
    draw(BASAVARAJ.applicationId);
    const banner = within(sheet()).getByRole('alert');
    expect(banner).toHaveTextContent('Rejected by Sunita Hegde (Level 2)');
    expect(banner).toHaveTextContent('Repayment capacity is not enough for the requested amount.');
  });

  it('says a draft is not submitted yet', () => {
    state().saveApplication(state().draft);
    draw(state().draft.applicationId);
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Not submitted yet');
  });

  it('stays where it is when the tab changes, so that it is read out once and not at every tab', () => {
    draw(BASAVARAJ.applicationId);
    const banner = within(sheet()).getByRole('alert');
    fireEvent.click(tab('KYC'));
    fireEvent.click(tab('Approval'));
    expect(within(sheet()).getByRole('alert')).toBe(banner);
  });

  it('is on every tab', () => {
    draw(SAVITA.applicationId);
    fireEvent.click(tab('KYC'));
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Returned for correction');
  });
});

describe('View workflow', () => {
  it('is a link to the review screen for the user who is on the workflow', () => {
    actAs('priya');
    draw(SAVITA.applicationId);
    const link = within(header()).getByRole('link', { name: 'View workflow' });
    expect(link.getAttribute('href')).toMatch(/^\/workflow\/review\/WI-/);
  });

  it('is off, with the reason in a tip, for a user who is not on the workflow', () => {
    actAs('priya');
    draw(MANJUNATH.applicationId);
    expect(within(header()).queryByRole('link', { name: 'View workflow' })).toBeNull();
    const button = within(header()).getByRole('button', { name: 'View workflow' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(header()).getByText(
        'Only the people on this workflow, and the administrator, can open it.',
      ),
    ).toBeInTheDocument();
  });

  it('is off for an application that was never submitted', () => {
    state().saveApplication(state().draft);
    draw(state().draft.applicationId);
    expect(within(header()).getByRole('button', { name: 'View workflow' })).toHaveAttribute(
      'aria-disabled',
    );
    expect(within(header()).getByText(/has not been submitted/)).toBeInTheDocument();
  });

  it('is on for the administrator and for the approver whose step it is', () => {
    actAs('admin');
    const { unmount } = draw(MANJUNATH.applicationId);
    expect(within(header()).getByRole('link', { name: 'View workflow' })).toBeInTheDocument();
    unmount();
    actAs('mahesh');
    draw(MANJUNATH.applicationId);
    expect(within(header()).getByRole('link', { name: 'View workflow' })).toBeInTheDocument();
  });

  it('follows the user who is acting, with no reload', () => {
    actAs('priya');
    draw(MANJUNATH.applicationId);
    expect(within(header()).queryByRole('link', { name: 'View workflow' })).toBeNull();
    actAsAdminNow();
    expect(within(header()).getByRole('link', { name: 'View workflow' })).toBeInTheDocument();
  });
});

function actAsAdminNow() {
  // switching the user re-renders the sheet through the store
  act(() => useAppStore.getState().setCurrentUser('admin'));
}

describe('the header', () => {
  it('has three columns, so that the search box is in the middle of the sheet whatever the name is', () => {
    draw(VIJAY.applicationId);
    expect(header().className).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)]');
    // a grid from 1024px up (below it the header wraps: see the next test)
    expect(header().className.split(/\s+/)).not.toContain('flex');
  });

  it('never squeezes the status chip: the name is cut, the chip is not', () => {
    draw(VIJAY.applicationId);
    expect(within(header()).getByText('Approved').closest('span.shrink-0')).not.toBeNull();
    expect(within(header()).getByRole('heading')).toHaveClass('truncate');
  });
});

describe('the side panel and its rail', () => {
  it('has a 360px panel and a 40px rail at the right, after the fields', () => {
    draw(VIJAY.applicationId);
    const panel = screen.getByTestId('record-side-panel');
    const rail = screen.getByTestId('record-side-rail');
    expect(panel).toHaveClass('w-[360px]');
    expect(rail).toHaveClass('w-10');
    // the panel comes after the fields and before the rail, at the right edge
    expect(
      within(sheet()).getByRole('tabpanel').compareDocumentPosition(panel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(panel.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is not drawn below 1024px, where there is no room for it', () => {
    draw(VIJAY.applicationId);
    expect(screen.getByTestId('record-side')).toHaveClass('hidden', 'lg:flex');
  });
});

describe('closing', () => {
  it('closes with the close button', () => {
    const onClose = vi.fn();
    draw(VIJAY.applicationId, { onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close record' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    draw(VIJAY.applicationId, { onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the keyboard', () => {
  it('puts the cursor on the sheet when it opens, so its name is read first', () => {
    draw(VIJAY.applicationId);
    expect(sheet()).toHaveFocus();
  });

  it('keeps the cursor inside: Tab from the last control goes to the first, Shift+Tab the other way', () => {
    draw(VIJAY.applicationId);
    // the first stop is the search box in the header, the last is the icon of the side panel that is on
    const first = within(header()).getByRole('textbox', { name: 'Search the fields of this tab' });
    const last = within(sheet()).getByRole('button', { name: 'Comments' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('does not let Tab out to the page behind', () => {
    draw(VIJAY.applicationId);
    screen.getByRole('button', { name: 'Behind the sheet' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(sheet().contains(document.activeElement)).toBe(true);
  });

  it('gives the cursor back to where it was when the sheet goes', () => {
    const behind = document.createElement('button');
    document.body.append(behind);
    behind.focus();
    const { unmount } = draw(VIJAY.applicationId);
    expect(sheet()).toHaveFocus();
    unmount();
    expect(behind).toHaveFocus();
    behind.remove();
  });
});

describe('Escape and Tab with a dropdown of the top bar open over the sheet', () => {
  const drawWithBell = (onClose = () => {}) => {
    actAs('mahesh');
    render(
      <MemoryRouter>
        <NotificationsMenu />
        <button type="button">Behind the sheet</button>
        <RecordSheet
          applicationId={MANJUNATH.applicationId}
          tab="application"
          onTabChange={() => {}}
          onClose={onClose}
        />
      </MemoryRouter>,
    );
  };
  const bell = () => screen.getByRole('button', { name: /^Notifications/ });
  const dropdown = () => screen.queryByRole('region', { name: 'Pending approvals' });

  it('closes the dropdown first and the sheet with the next Escape', () => {
    const onClose = vi.fn();
    drawWithBell(onClose);
    fireEvent.click(bell());
    expect(dropdown()).toBeInTheDocument();
    fireEvent.keyDown(bell(), { key: 'Escape' });
    expect(dropdown()).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(bell(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets Tab move inside the dropdown instead of pulling the cursor into the sheet', () => {
    drawWithBell();
    fireEvent.click(bell());
    const heading = within(dropdown()!).getByRole('heading', { name: 'Pending approvals' });
    expect(heading).toHaveFocus();
    // true: nothing called preventDefault, the browser moves the cursor on its own
    expect(fireEvent.keyDown(heading, { key: 'Tab' })).toBe(true);
    expect(dropdown()).toBeInTheDocument();
  });

  it('brings the cursor back from the page when Shift+Tab is pressed, as it does for Tab', () => {
    drawWithBell();
    screen.getByRole('button', { name: 'Behind the sheet' }).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(sheet().contains(document.activeElement)).toBe(true);
  });
});

describe('a record that is not there', () => {
  it('says so, and can still be closed', () => {
    const onClose = vi.fn();
    draw('HL-2026-0099', { onClose });
    expect(screen.getByRole('dialog', { name: 'Record not found' })).toBeInTheDocument();
    expect(screen.getByText(/no application with the ID HL-2026-0099/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close record' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no tabs, no search and no buttons for a record', () => {
    draw('HL-2026-0099');
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('closes with Escape too', () => {
    const onClose = vi.fn();
    draw('HL-2026-0099', { onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('where the record is read from', () => {
  it('prefers the master record, which an approval makes, over the application', () => {
    useAppStore.setState({
      masterRecords: [{ ...VIJAY, fullNameAsPerPan: 'Vijay K Kulkarni (master)' }],
    });
    draw(VIJAY.applicationId);
    expect(within(header()).getByRole('heading')).toHaveTextContent('Vijay K Kulkarni (master)');
  });

  it('shows a change made in the store while it is open', () => {
    draw(MANJUNATH.applicationId);
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Pending approval at Level 1');
    act(() =>
      useAppStore.setState({
        applications: state().applications.map((a) =>
          a.applicationId === MANJUNATH.applicationId ? { ...a, status: 'In Level 2' as const } : a,
        ),
      }),
    );
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Pending approval at Level 2');
  });
});
