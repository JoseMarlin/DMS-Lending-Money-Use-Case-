import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import RecordSheet from '../RecordSheet';
import { DEFAULT_SHEET_TAB, type SheetTabId } from '../recordSheetModel';

const state = () => useAppStore.getState();
const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ] = SEED_APPLICATIONS;

function Harness({ applicationId }: { applicationId: string }) {
  const [tab, setTab] = useState<SheetTabId>(DEFAULT_SHEET_TAB);
  return (
    <MemoryRouter>
      <RecordSheet
        applicationId={applicationId}
        tab={tab}
        onTabChange={setTab}
        onClose={() => {}}
      />
    </MemoryRouter>
  );
}

const draw = (applicationId: string) => render(<Harness applicationId={applicationId} />);

const sheet = () => screen.getByRole('dialog');
const rail = () => within(sheet()).getByRole('toolbar', { name: 'Record panels' });
const icon = (name: string) => within(rail()).getByRole('button', { name });
const panel = () => screen.getByTestId('record-side-panel');
const panelTitle = () => within(panel()).getByRole('heading', { level: 3 });
const actAs = (id: DemoUserId) => act(() => state().setCurrentUser(id));

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the rail', () => {
  it('has the icons KYC Checks, Comments, Files and Attachments and Audit Log, from the top', () => {
    draw(VIJAY.applicationId);
    expect(
      within(rail())
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['KYC Checks', 'Comments', 'Files and Attachments', 'Audit Log']);
  });

  it('is 40px wide, at the far right, after the panel', () => {
    draw(VIJAY.applicationId);
    expect(rail()).toHaveClass('w-10');
    expect(panel().compareDocumentPosition(rail()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('fills the rail: the icons are as wide as it is inside its hairline, and are not cut at the edge', () => {
    draw(VIJAY.applicationId);
    within(rail())
      .getAllByRole('button')
      .forEach((b) => {
        expect(b).toHaveClass('w-full');
        expect(b.parentElement).toHaveClass('w-full');
      });
  });

  it('shows the icon that is on in high contrast too, not only by its colour', () => {
    draw(VIJAY.applicationId);
    expect(icon('Comments')).toHaveClass(
      'forced-colors:bg-[Highlight]',
      'forced-colors:text-[HighlightText]',
    );
  });

  it('starts under the row of the tabs, with the icon that is on in light lavender', () => {
    draw(VIJAY.applicationId);
    expect(icon('Comments')).toHaveAttribute('aria-pressed', 'true');
    expect(icon('Comments')).toHaveClass('bg-view-toggle-on');
    expect(icon('KYC Checks')).toHaveAttribute('aria-pressed', 'false');
    expect(icon('KYC Checks')).not.toHaveClass('bg-view-toggle-on');
  });

  it('has a tip with the name of each icon, shown only while the pointer is on it', () => {
    draw(VIJAY.applicationId);
    const tips = within(rail()).getAllByRole('tooltip');
    expect(tips.map((t) => t.textContent)).toEqual([
      'KYC Checks',
      'Comments',
      'Files and Attachments',
      'Audit Log',
    ]);
    tips.forEach((tip) => expect(tip).toHaveClass('hidden'));
    fireEvent.pointerEnter(icon('Audit Log').parentElement!);
    expect(tips[3]).toHaveClass('block');
    expect(tips[0]).toHaveClass('hidden');
  });
});

describe('the panel that is open first', () => {
  it.each([
    ['an approved record', VIJAY, 'Comments'],
    ['a rejected record', BASAVARAJ, 'Comments'],
    ['a returned record', SAVITA, 'Comments'],
    ['a record waiting at Level 1', MANJUNATH, 'KYC Checks'],
    ['a record waiting at Level 2', SHOBHA, 'KYC Checks'],
  ])('is the one of %s: %s', (_, app, title) => {
    draw(app.applicationId);
    expect(panelTitle()).toHaveTextContent(title);
    expect(icon(title)).toHaveAttribute('aria-pressed', 'true');
  });

  it('is the KYC checks for a draft', () => {
    state().fillScenario('A');
    state().saveApplication(state().draft);
    draw(state().draft.applicationId);
    expect(panelTitle()).toHaveTextContent('KYC Checks');
  });

  it('is the title bar of the panel, named by it', () => {
    draw(VIJAY.applicationId);
    expect(within(sheet()).getByRole('region', { name: 'Comments' })).toBe(panel());
    expect(panelTitle()).toHaveClass('font-bold');
  });
});

describe('switching and collapsing', () => {
  it('shows the panel of the icon that is pressed, and its title follows', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(icon('KYC Checks'));
    expect(panelTitle()).toHaveTextContent('KYC Checks');
    expect(icon('KYC Checks')).toHaveAttribute('aria-pressed', 'true');
    expect(icon('Comments')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(icon('Files and Attachments'));
    expect(panelTitle()).toHaveTextContent('Files and Attachments');
    fireEvent.click(icon('Audit Log'));
    expect(panelTitle()).toHaveTextContent('Audit Log');
  });

  it('collapses when the icon that is on is pressed, and the rail stays', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(icon('Comments'));
    expect(screen.queryByTestId('record-side-panel')).toBeNull();
    expect(rail()).toBeInTheDocument();
    within(rail())
      .getAllByRole('button')
      .forEach((b) => expect(b).toHaveAttribute('aria-pressed', 'false'));
    expect(icon('Comments')).not.toHaveClass('bg-view-toggle-on');
  });

  it('opens again with any icon, and with the same one', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(icon('Comments'));
    fireEvent.click(icon('Comments'));
    expect(panelTitle()).toHaveTextContent('Comments');
    fireEvent.click(icon('Comments'));
    fireEvent.click(icon('Audit Log'));
    expect(panelTitle()).toHaveTextContent('Audit Log');
  });

  it('leaves the fields as they are when the panel goes: the form has the whole width', () => {
    draw(VIJAY.applicationId);
    const fields = within(sheet()).getByRole('tabpanel');
    fireEvent.click(icon('Comments'));
    expect(fields).toBeInTheDocument();
    expect(fields.parentElement).toHaveClass('flex-1');
    expect(within(fields).getByText('Application ID')).toBeInTheDocument();
  });

  it('keeps the cursor on the icon that was pressed', () => {
    draw(VIJAY.applicationId);
    icon('Comments').focus();
    fireEvent.click(icon('Comments'));
    expect(icon('Comments')).toHaveFocus();
  });

  it('points the icon that is on at its panel, and no icon at a panel that is not there', () => {
    draw(VIJAY.applicationId);
    expect(icon('Comments')).toHaveAttribute('aria-controls', panel().id);
    fireEvent.click(icon('Comments'));
    expect(icon('Comments')).not.toHaveAttribute('aria-controls');
  });

  it('has a start for each record: another record opens on its own panel, not the last one used', () => {
    // the same sheet, given another record (a link of the bell while it is open)
    const view = draw(VIJAY.applicationId);
    fireEvent.click(icon('Audit Log'));
    view.rerender(<Harness applicationId={MANJUNATH.applicationId} />);
    expect(panelTitle()).toHaveTextContent('KYC Checks');
  });
});

describe('the keyboard', () => {
  it('has one stop in the rail: the icon that is on', () => {
    draw(VIJAY.applicationId);
    expect(icon('Comments')).toHaveAttribute('tabindex', '0');
    expect(icon('KYC Checks')).toHaveAttribute('tabindex', '-1');
    expect(icon('Audit Log')).toHaveAttribute('tabindex', '-1');
  });

  it('moves the cursor with Up and Down, round the ends, without pressing', () => {
    draw(VIJAY.applicationId);
    icon('Comments').focus();
    fireEvent.keyDown(icon('Comments'), { key: 'ArrowDown' });
    expect(icon('Files and Attachments')).toHaveFocus();
    expect(panelTitle()).toHaveTextContent('Comments');
    fireEvent.keyDown(icon('Files and Attachments'), { key: 'ArrowDown' });
    fireEvent.keyDown(icon('Audit Log'), { key: 'ArrowDown' });
    expect(icon('KYC Checks')).toHaveFocus();
    fireEvent.keyDown(icon('KYC Checks'), { key: 'ArrowUp' });
    expect(icon('Audit Log')).toHaveFocus();
    fireEvent.keyDown(icon('Audit Log'), { key: 'Home' });
    expect(icon('KYC Checks')).toHaveFocus();
    fireEvent.keyDown(icon('KYC Checks'), { key: 'End' });
    expect(icon('Audit Log')).toHaveFocus();
  });

  it('has Tab reach the icon that has the cursor, so that Tab goes on from it and not back into the rail', () => {
    draw(VIJAY.applicationId);
    icon('Comments').focus();
    fireEvent.keyDown(icon('Comments'), { key: 'ArrowDown' });
    expect(icon('Files and Attachments')).toHaveFocus();
    expect(icon('Files and Attachments')).toHaveAttribute('tabindex', '0');
    expect(icon('Comments')).toHaveAttribute('tabindex', '-1');
    // the sheet's own Tab stops are those with a tabindex of 0 or none: the last of them is the one with the cursor
    const stops = Array.from(
      sheet().querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex]'),
    )
      .filter((el) => el.getAttribute('tabindex') !== '-1')
      // in page order (a list of selectors does not give that in every DOM)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    expect(stops.at(-1)).toBe(icon('Files and Attachments'));
  });

  it('is pressed with the keys of a button, and the cursor stays', () => {
    draw(VIJAY.applicationId);
    icon('Comments').focus();
    fireEvent.keyDown(icon('Comments'), { key: 'ArrowUp' });
    expect(icon('KYC Checks')).toHaveFocus();
    fireEvent.click(icon('KYC Checks'));
    expect(panelTitle()).toHaveTextContent('KYC Checks');
    expect(icon('KYC Checks')).toHaveFocus();
  });
});

describe('the KYC Checks panel', () => {
  const open = (app = MANJUNATH) => {
    draw(app.applicationId);
    return within(screen.getByRole('list', { name: 'KYC checks' }));
  };

  it('has the checks of an application with no GSTIN, each with its name and a Passed chip', () => {
    const list = open();
    const rows = list.getAllByRole('listitem');
    expect(rows.map((r) => within(r).getByRole('button').textContent)).toEqual([
      expect.stringContaining('PAN format'),
      expect.stringContaining('PAN active'),
      expect.stringContaining('Aadhaar valid'),
      expect.stringContaining('Aadhaar authentication'),
      expect.stringContaining('Name match percent'),
      expect.stringContaining('Date of birth match'),
      expect.stringContaining('PAN and Aadhaar link'),
    ]);
    rows.forEach((r) => expect(within(r).getByText('Passed')).toBeInTheDocument());
  });

  it('has the GST check as well for a business application', () => {
    draw(SHOBHA.applicationId);
    expect(within(panel()).getByRole('button', { name: /GST active/ })).toBeInTheDocument();
  });

  it('says the result at the top, with the date', () => {
    open();
    expect(
      within(panel()).getByText(/KYC result: Pass, checked on 5 Oct 2026\./),
    ).toBeInTheDocument();
  });

  it('has an Exception with the remark of the person who went on with it', () => {
    draw(BASAVARAJ.applicationId);
    fireEvent.click(icon('KYC Checks'));
    expect(
      within(panel()).getByRole('button', { name: /Name match percent.*Exception/ }),
    ).toBeInTheDocument();
    expect(
      within(panel()).getByText(/Middle initial missing in the application/),
    ).toBeInTheDocument();
  });

  it('opens a row to what was entered and what the source says, and closes it again', () => {
    open();
    const row = within(panel()).getByRole('button', { name: /^Name match percent/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel()).queryByText('Name entered')).toBeNull();
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(row).toHaveAttribute('aria-controls');
    expect(within(panel()).getByText('Name entered')).toBeInTheDocument();
    expect(within(panel()).getByText('As per source')).toBeInTheDocument();
    expect(within(panel()).getByText('100%')).toBeInTheDocument();
    fireEvent.click(row);
    expect(within(panel()).queryByText('Name entered')).toBeNull();
  });

  it('opens each row by itself', () => {
    open();
    fireEvent.click(within(panel()).getByRole('button', { name: /^PAN active/ }));
    fireEvent.click(within(panel()).getByRole('button', { name: /^Date of birth match/ }));
    expect(within(panel()).getByText('Date of birth entered')).toBeInTheDocument();
    expect(within(panel()).getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('shows only the masked Aadhaar, wherever it is shown', () => {
    open();
    fireEvent.click(within(panel()).getByRole('button', { name: /^Aadhaar authentication/ }));
    fireEvent.click(within(panel()).getByRole('button', { name: /^PAN and Aadhaar link/ }));
    expect(panel().textContent).toContain('XXXX XXXX 6620');
    expect(panel().textContent).not.toMatch(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/);
  });

  it('says Not checked for the checks of a draft that has not been through KYC', () => {
    state().fillScenario('A');
    state().saveApplication(state().draft);
    draw(state().draft.applicationId);
    const row = within(panel()).getByRole('button', { name: /^PAN active/ });
    expect(within(row).getByText('Not checked')).toBeInTheDocument();
    expect(
      within(panel()).getByText(/have not been run for this application yet/),
    ).toBeInTheDocument();
  });
});

describe('the Comments panel', () => {
  const thread = () => within(within(panel()).getByRole('list', { name: /^Comments/ }));
  const box = () => within(panel()).getByRole('textbox', { name: 'Add a comment' });
  const send = () => within(panel()).getByRole('button', { name: 'Send' });
  const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

  it('has the comments of the record, oldest first, with the decisions among them', () => {
    draw(VIJAY.applicationId);
    const items = thread().getAllByRole('listitem');
    // four notes, the decision of Level 1 and the one of Level 2
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('Priya Kulkarni');
    expect(items[0]).toHaveTextContent('Documents verified with the applicant');
    expect(items.at(-1)).toHaveTextContent('Sanction letter handed over');
    const times = items.map((i) => Date.parse(i.querySelector('time')!.getAttribute('datetime')!));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('shows each one with round initials, the name, the role and the time that has passed', () => {
    draw(VIJAY.applicationId);
    const first = thread().getAllByRole('listitem')[0];
    expect(first).toHaveTextContent('PK');
    expect(within(first).getByText('Priya Kulkarni')).toBeInTheDocument();
    expect(within(first).getByText('Loan officer')).toBeInTheDocument();
    const time = first.querySelector('time')!;
    expect(time.textContent).toMatch(/ago$/);
    expect(time).toHaveAttribute('datetime', '2026-08-18T11:20:00+05:30');
    expect(time).toHaveAttribute('title', '18/08/2026, 11:20 AM');
    expect(first.querySelector('.rounded-full')).toHaveClass('h-8', 'w-8');
  });

  it('shows the decisions with a chip "Level 1 decision" or "Level 2 decision" and what was decided', () => {
    draw(VIJAY.applicationId);
    const items = thread().getAllByRole('listitem');
    const one = items.find((i) => within(i).queryByText('Level 1 decision'))!;
    expect(one).toHaveTextContent('Mahesh Joshi');
    expect(one).toHaveTextContent('Branch Manager');
    expect(one).toHaveTextContent('Documents are in order.');
    expect(within(one).getByText('Approved')).toBeInTheDocument();
    const two = items.find((i) => within(i).queryByText('Level 2 decision'))!;
    expect(two).toHaveTextContent('Sunita Hegde');
    expect(two).toHaveTextContent('Credit approver');
    expect(two).toHaveTextContent('Sanctioned as requested.');
  });

  it('shows the decision of a returned record, and of a rejected one, with their outcome', () => {
    draw(SAVITA.applicationId);
    const item = thread()
      .getAllByRole('listitem')
      .find((i) => within(i).queryByText('Level 1 decision'))!;
    expect(within(item).getByText('Returned')).toBeInTheDocument();
    expect(item).toHaveTextContent('Income Proof is not readable');
  });

  it('shows a decision made while the sheet is open, at once', () => {
    draw(MANJUNATH.applicationId);
    fireEvent.click(icon('Comments'));
    expect(screen.queryByText('Level 1 decision')).toBeNull();
    const instance = state().workflowInstances.find(
      (i) => i.applicationId === MANJUNATH.applicationId,
    )!;
    act(() => {
      state().approve(instance.id, DEMO_USERS.mahesh, 'Valuation is fine.');
    });
    expect(within(panel()).getByText('Level 1 decision')).toBeInTheDocument();
    expect(within(panel()).getByText('Valuation is fine.')).toBeInTheDocument();
  });

  it('has the box "Add a comment" pinned under the thread, and Send, which is off while it is empty', () => {
    draw(VIJAY.applicationId);
    expect(box()).toHaveAttribute('placeholder', 'Add a comment');
    expect(send()).toBeDisabled();
    type('   ');
    expect(send()).toBeDisabled();
    type('Hello');
    expect(send()).toBeEnabled();
    expect(
      thread().getAllByRole('listitem')[0].compareDocumentPosition(box()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('adds a comment at once, as the user who is acting, at the end, and empties the box', () => {
    draw(VIJAY.applicationId);
    type('Disbursement planned for Friday.');
    fireEvent.click(send());
    const items = thread().getAllByRole('listitem');
    expect(items).toHaveLength(7);
    const last = items.at(-1)!;
    expect(last).toHaveTextContent('Priya Kulkarni');
    expect(last).toHaveTextContent('Loan officer');
    expect(last).toHaveTextContent('Disbursement planned for Friday.');
    expect(within(last).getByText('Just now')).toBeInTheDocument();
    expect(box()).toHaveValue('');
    expect(send()).toBeDisabled();
    expect(box()).toHaveFocus();
  });

  it('writes the audit event "Comment added"', () => {
    draw(VIJAY.applicationId);
    const before = state().auditEvents.length;
    type('Disbursement planned for Friday.');
    fireEvent.click(send());
    expect(state().auditEvents).toHaveLength(before + 1);
    expect(state().auditEvents.at(-1)).toMatchObject({
      applicationId: VIJAY.applicationId,
      event: 'Comment added',
      user: 'Priya Kulkarni',
      comment: 'Disbursement planned for Friday.',
    });
  });

  it('sends with Ctrl+Enter, and Enter alone is a new line', () => {
    draw(VIJAY.applicationId);
    type('One');
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(state().recordComments.at(-1)?.text).not.toBe('One');
    fireEvent.keyDown(box(), { key: 'Enter', ctrlKey: true });
    expect(state().recordComments.at(-1)?.text).toBe('One');
    type('Two');
    fireEvent.keyDown(box(), { key: 'Enter', metaKey: true });
    expect(state().recordComments.at(-1)?.text).toBe('Two');
  });

  it('says it to a screen reader when a comment is added', () => {
    draw(VIJAY.applicationId);
    type('Noted');
    fireEvent.click(send());
    expect(within(panel()).getByText('Comment added by Priya Kulkarni')).toBeInTheDocument();
  });

  it('is written as the user who is acting now: Mahesh, then the administrator', () => {
    draw(VIJAY.applicationId);
    actAs('mahesh');
    type('Second look done.');
    fireEvent.click(send());
    expect(thread().getAllByRole('listitem').at(-1)).toHaveTextContent('Mahesh Joshi');
    expect(thread().getAllByRole('listitem').at(-1)).toHaveTextContent('Branch Manager');
    actAs('admin');
    type('Archived.');
    fireEvent.click(send());
    expect(thread().getAllByRole('listitem').at(-1)).toHaveTextContent('Administrator');
  });

  it('says every comment that is added, also two with the same words, one after the other', () => {
    draw(VIJAY.applicationId);
    const live = () => within(panel()).getByText(/^Comment added by/);
    type('One');
    fireEvent.click(send());
    const first = live();
    type('Two');
    fireEvent.click(send());
    // a new node each time: a screen reader reads it again
    expect(live()).not.toBe(first);
    expect(live()).toHaveTextContent('Comment added by Priya Kulkarni');
  });

  it('has the thread as a named region that the keyboard can scroll, and none when there is nothing to scroll', () => {
    draw(VIJAY.applicationId);
    const region = within(panel()).getByRole('region', { name: 'Comment thread' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toContainElement(thread().getAllByRole('listitem')[0]);
  });

  it('has no focus stop for the thread when it is empty', () => {
    state().fillScenario('A');
    state().saveApplication(state().draft);
    draw(state().draft.applicationId);
    fireEvent.click(icon('Comments'));
    expect(within(panel()).queryByRole('region', { name: 'Comment thread' })).toBeNull();
  });

  it('keeps what was typed while another panel is looked at', () => {
    draw(VIJAY.applicationId);
    type('Half a thought');
    fireEvent.click(icon('KYC Checks'));
    fireEvent.click(icon('Comments'));
    expect(box()).toHaveValue('Half a thought');
  });

  it('masks an Aadhaar number that is typed, in the thread and in the trail', () => {
    draw(VIJAY.applicationId);
    type('Customer quoted 2345 0007 4821 on the phone.');
    fireEvent.click(send());
    expect(panel().textContent).toContain('XXXX XXXX 4821');
    expect(document.body.textContent).not.toMatch(/2345\s?0007/);
    expect(JSON.stringify(state().auditEvents)).not.toMatch(/2345\s?0007/);
    expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(/2345\s?0007/);
  });

  it('stops at 1000 characters', () => {
    draw(VIJAY.applicationId);
    expect(box()).toHaveAttribute('maxlength', '1000');
  });

  it('shows "No comments yet" for a record with none, and the box is still there', () => {
    state().fillScenario('A');
    state().saveApplication(state().draft);
    draw(state().draft.applicationId);
    fireEvent.click(icon('Comments'));
    expect(within(panel()).getByText('No comments yet')).toBeInTheDocument();
    expect(box()).toBeInTheDocument();
    type('First note');
    fireEvent.click(send());
    expect(within(panel()).queryByText('No comments yet')).toBeNull();
    expect(thread().getAllByRole('listitem')).toHaveLength(1);
  });

  describe('deleting', () => {
    const deleteButtons = () =>
      within(panel()).queryAllByRole('button', { name: /^Delete your comment/ });

    it('is offered on the comments of the user who is acting, and on no other', () => {
      draw(VIJAY.applicationId);
      // Priya wrote two of the four notes
      expect(deleteButtons()).toHaveLength(2);
      actAs('mahesh');
      expect(deleteButtons()).toHaveLength(1);
      actAs('sunita');
      expect(deleteButtons()).toHaveLength(1);
      actAs('admin');
      expect(deleteButtons()).toHaveLength(0);
    });

    it('is not offered on a decision, even one by the user who is acting', () => {
      draw(VIJAY.applicationId);
      actAs('mahesh');
      const level1 = thread()
        .getAllByRole('listitem')
        .find((i) => within(i).queryByText('Level 1 decision'))!;
      expect(within(level1).queryByRole('button')).toBeNull();
    });

    it('asks first, and keeps the comment when the answer is Keep comment', () => {
      draw(VIJAY.applicationId);
      fireEvent.click(deleteButtons()[0]);
      const dialog = screen.getByRole('dialog', { name: 'Delete this comment?' });
      expect(dialog).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep comment' }));
      expect(screen.queryByRole('dialog', { name: 'Delete this comment?' })).toBeNull();
      expect(thread().getAllByRole('listitem')).toHaveLength(6);
    });

    it('removes the comment when the answer is Delete comment', () => {
      draw(VIJAY.applicationId);
      const before = state().recordComments.length;
      fireEvent.click(deleteButtons()[0]);
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete this comment?' })).getByRole('button', {
          name: 'Delete comment',
        }),
      );
      expect(thread().getAllByRole('listitem')).toHaveLength(5);
      expect(state().recordComments).toHaveLength(before - 1);
      expect(within(panel()).getByText('Comment deleted')).toBeInTheDocument();
    });

    it('puts the cursor in the comment box after a delete, not on nothing', () => {
      draw(VIJAY.applicationId);
      const trash = deleteButtons()[0];
      trash.focus(); // as a click or the keys of a button do
      fireEvent.click(trash);
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete this comment?' })).getByRole('button', {
          name: 'Delete comment',
        }),
      );
      expect(box()).toHaveFocus();
    });

    it('closes the question with Escape without closing the sheet, and deletes nothing', () => {
      draw(VIJAY.applicationId);
      fireEvent.click(deleteButtons()[0]);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Delete this comment?' })).toBeNull();
      expect(sheet()).toBeInTheDocument();
      expect(thread().getAllByRole('listitem')).toHaveLength(6);
    });

    it('shows "No comments yet" again when the last of them is deleted', () => {
      state().fillScenario('A');
      state().saveApplication(state().draft);
      draw(state().draft.applicationId);
      fireEvent.click(icon('Comments'));
      type('Only note');
      fireEvent.click(send());
      fireEvent.click(deleteButtons()[0]);
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete this comment?' })).getByRole('button', {
          name: 'Delete comment',
        }),
      );
      expect(within(panel()).getByText('No comments yet')).toBeInTheDocument();
    });
  });
});

// the panels themselves are tested in FilesPanel.test.tsx and auditLogModel.test.ts; here it is
// only checked that the rail opens them, and that they are the real panels
describe('the Files and Attachments panel and the Audit Log panel', () => {
  it('opens Files and Attachments with its two groups, not a placeholder', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(icon('Files and Attachments'));
    expect(panelTitle()).toHaveTextContent('Files and Attachments');
    expect(icon('Files and Attachments')).toHaveAttribute('aria-pressed', 'true');
    expect(icon('Comments')).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(panel()).getByRole('heading', { level: 4, name: /^Application documents/ }),
    ).toBeInTheDocument();
    expect(
      within(panel()).getByRole('heading', { level: 4, name: /^Other attachments/ }),
    ).toBeInTheDocument();
    expect(within(panel()).queryByText('This panel is not ready yet.')).toBeNull();
  });

  it('lists the documents of the form and the seed attachments of the approved record', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(icon('Files and Attachments'));
    const documents = within(panel()).getByRole('list', { name: 'Documents of the application' });
    expect(within(documents).getAllByRole('listitem')).toHaveLength(
      VIJAY.documents.filter((d) => d.docType !== 'Supporting Document').length,
    );
    const attachments = within(panel()).getByRole('list', { name: 'Attachments' });
    expect(within(attachments).getAllByRole('listitem')).toHaveLength(
      VIJAY.documents.filter((d) => d.docType === 'Supporting Document').length,
    );
    expect(within(attachments).getByText('Salary_Slip_Aug.pdf')).toBeInTheDocument();
  });

  it('opens Audit Log with its filter chips and the timeline of the approved record', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(icon('Audit Log'));
    expect(panelTitle()).toHaveTextContent('Audit Log');
    expect(icon('Audit Log')).toHaveAttribute('aria-pressed', 'true');
    const chips = within(panel()).getByRole('group', { name: 'Filter the activity' });
    expect(
      within(chips)
        .getAllByRole('button')
        .map((b) => b.textContent?.replace(/\s*\d+$/, '')),
    ).toEqual(['All', 'Data changes', 'Workflow', 'KYC', 'Files', 'Comments']);
    expect(within(chips).getByRole('button', { name: /^All \d+$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // newest first: the record was made on approval, and the form was filled in before that
    const titles = within(panel())
      .getAllByRole('listitem')
      .map((li) => li.querySelector('p')?.textContent);
    expect(titles).toEqual(expect.arrayContaining(['Application created', 'Record created']));
    expect(titles.indexOf('Record created')).toBeLessThan(titles.indexOf('Application created'));
    expect(within(panel()).queryByText('This panel is not ready yet.')).toBeNull();
  });

  it('narrows the Audit Log to one kind of event with a chip', () => {
    draw(VIJAY.applicationId);
    fireEvent.click(icon('Audit Log'));
    fireEvent.click(within(panel()).getByRole('button', { name: /^Comments \d+$/ }));
    const titles = within(panel())
      .getAllByRole('listitem')
      .map((li) => li.querySelector('p')?.textContent);
    expect(titles.length).toBeGreaterThan(0);
    expect(new Set(titles)).toEqual(new Set(['Comment added']));
  });
});

describe('with the record being edited', () => {
  it('keeps the panel and its rail', () => {
    draw(SAVITA.applicationId);
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Edit' }));
    expect(panel()).toBeInTheDocument();
    expect(rail()).toBeInTheDocument();
    expect(panelTitle()).toHaveTextContent('Comments');
  });
});
