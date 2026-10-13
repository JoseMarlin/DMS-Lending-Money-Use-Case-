import { SEED_COMMENTS } from './seedComments';
import { STORAGE_KEY, useAppStore } from './store';

const state = () => useAppStore.getState();

const FULL_AADHAAR = /\d{12}|\b\d{4}[ -]\d{4}[ -]\d{4}\b/;

const load = async (saved: unknown) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
  await useAppStore.persist.rehydrate();
};

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('the comments in the store', () => {
  it('start as the seed comments', () => {
    expect(state().recordComments).toEqual(SEED_COMMENTS);
    // a copy: changing one does not change the seed
    expect(state().recordComments).not.toBe(SEED_COMMENTS);
  });

  it('are added as the user who is acting, and the audit trail gets "Comment added"', () => {
    state().setCurrentUser('mahesh');
    const before = state().auditEvents.length;
    const out = state().addRecordComment('HL-2026-0003', 'Valuation report received.');
    expect(out.ok).toBe(true);
    const added = state().recordComments.at(-1)!;
    expect(added).toMatchObject({
      applicationId: 'HL-2026-0003',
      author: 'Mahesh Joshi',
      authorRole: 'Branch Manager',
      text: 'Valuation report received.',
    });
    expect(added.id).toBe(`CM-${String(SEED_COMMENTS.length + 1).padStart(5, '0')}`);
    expect(state().auditEvents).toHaveLength(before + 1);
    expect(state().auditEvents.at(-1)).toMatchObject({
      applicationId: 'HL-2026-0003',
      event: 'Comment added',
      user: 'Mahesh Joshi',
      comment: 'Valuation report received.',
    });
  });

  it('are refused when empty, and nothing changes', () => {
    const before = state().recordComments;
    const events = state().auditEvents;
    const out = state().addRecordComment('HL-2026-0001', '   ');
    expect(out).toMatchObject({ ok: false, code: 'empty' });
    expect(state().recordComments).toBe(before);
    expect(state().auditEvents).toBe(events);
  });

  it('can be put on the draft that is not submitted yet', () => {
    const id = state().draft.applicationId;
    state().saveApplication(state().draft);
    expect(state().addRecordComment(id, 'Waiting for the sale deed.').ok).toBe(true);
  });

  it('are deleted by their author only', () => {
    state().setCurrentUser('priya');
    const mine = state().recordComments.find((c) => c.author === 'Priya Kulkarni')!;
    const theirs = state().recordComments.find((c) => c.author === 'Mahesh Joshi')!;
    expect(state().deleteRecordComment(theirs.id)).toMatchObject({ ok: false, code: 'not-yours' });
    expect(state().recordComments).toContainEqual(theirs);
    expect(state().deleteRecordComment(mine.id).ok).toBe(true);
    expect(state().recordComments).not.toContainEqual(mine);
    expect(state().recordComments).toHaveLength(SEED_COMMENTS.length - 1);
  });

  it('are not found twice: deleting a comment that is gone says so', () => {
    const mine = state().recordComments.find((c) => c.author === 'Priya Kulkarni')!;
    state().deleteRecordComment(mine.id);
    expect(state().deleteRecordComment(mine.id)).toMatchObject({ ok: false, code: 'not-found' });
  });

  it('never keep a full Aadhaar number: a typed one is masked on its way in', () => {
    state().addRecordComment('HL-2026-0001', 'The Aadhaar is 2345 0007 4821, checked.');
    const text = state().recordComments.at(-1)!.text;
    expect(text).toContain('XXXX XXXX 4821');
    expect(text).not.toMatch(FULL_AADHAAR);
    expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(FULL_AADHAAR);
  });
});

describe('the comments, saved and read back', () => {
  it('are saved with the rest of the state', () => {
    state().addRecordComment('HL-2026-0002', 'Guarantee signed.');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state;
    expect(saved.recordComments).toHaveLength(SEED_COMMENTS.length + 1);
    expect(saved.recordComments.at(-1).text).toBe('Guarantee signed.');
  });

  it('come back after a reload', async () => {
    state().addRecordComment('HL-2026-0002', 'Guarantee signed.');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state;
    useAppStore.setState({ recordComments: [] });
    await load(saved);
    expect(state().recordComments.at(-1)?.text).toBe('Guarantee signed.');
  });

  it('drop the saved ones that are damaged, and keep the rest', async () => {
    const [first] = SEED_COMMENTS;
    await load({
      recordComments: [
        first,
        { ...first, id: 'bad id' },
        { ...first, id: 'CM-00090', text: 5 },
        { ...first, id: 'CM-00091', at: 'not a date' },
        null,
        'text',
        { ...first },
      ],
    });
    // the repeated id is kept once
    expect(state().recordComments).toEqual([first]);
  });

  it('are the seed ones when the saved copy has none (made before comments existed)', async () => {
    await load({ applications: state().applications });
    expect(state().recordComments).toEqual(SEED_COMMENTS);
  });

  it('are the seed ones when the saved value is not a list', async () => {
    await load({ recordComments: 'many' });
    expect(state().recordComments).toEqual(SEED_COMMENTS);
  });

  it('are empty when the saved list is empty (everything was deleted)', async () => {
    await load({ recordComments: [] });
    expect(state().recordComments).toEqual([]);
  });
});

describe('Reset demo', () => {
  it('brings back the seed comments, and takes away the ones that were added', () => {
    state().addRecordComment('HL-2026-0001', 'A new note.');
    const mine = state().recordComments.find((c) => c.author === 'Priya Kulkarni')!;
    state().setCurrentUser('priya');
    state().deleteRecordComment(mine.id);
    state().resetDemo();
    expect(state().recordComments).toEqual(SEED_COMMENTS);
  });
});
