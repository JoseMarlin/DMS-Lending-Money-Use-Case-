/** What the final review found in the data layer: each is a case that went wrong and is now covered. */
import { MAX_NOTE_LENGTH } from './attachments';
import { MAX_COMMENT_LENGTH } from './recordComments';
import { documentChanges } from './recordEdit';
import { SEED_APPLICATIONS } from './seed';
import { useAppStore } from './store';
import { ApplicationStatus } from './types';
import { DEMO_USERS } from './users';

const state = () => useAppStore.getState();
const SAVITA = SEED_APPLICATIONS[3];
const PDF = { name: 'Bill.pdf', size: 1000, type: 'application/pdf' };

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('attaching to an application that is also in the form', () => {
  const saveDraftInTheForm = () => {
    state().fillScenario('A');
    state().saveApplication({ ...state().draft, status: ApplicationStatus.Draft });
    return state().draft.applicationId;
  };

  it('keeps what was typed in the form since it was saved: only the file is added to the form copy', () => {
    const id = saveDraftInTheForm();
    state().updateDraft({ loanAmountRequested: 1_000_000 }); // typed, not saved
    const out = state().addAttachment(id, PDF, 'A bill');
    expect(out.ok).toBe(true);
    expect(state().draft.loanAmountRequested).toBe(1_000_000);
    expect(state().draft.documents.some((d) => d.fileName === 'Bill.pdf')).toBe(true);
    // the saved copy has it too, and none of what was typed
    const saved = state().applications.find((a) => a.applicationId === id)!;
    expect(saved.documents.some((d) => d.fileName === 'Bill.pdf')).toBe(true);
    expect(saved.loanAmountRequested).not.toBe(1_000_000);
  });

  it('keeps it when the attachment is removed again', () => {
    const id = saveDraftInTheForm();
    state().addAttachment(id, PDF);
    state().updateDraft({ loanAmountRequested: 1_100_000 });
    const added = state().draft.documents.find((d) => d.fileName === 'Bill.pdf')!;
    const out = state().removeAttachment(id, added.id);
    expect(out.ok).toBe(true);
    expect(state().draft.loanAmountRequested).toBe(1_100_000);
    expect(state().draft.documents.some((d) => d.fileName === 'Bill.pdf')).toBe(false);
  });

  it('still shows the form copy as the live one: it is not older than the saved copy', () => {
    const id = saveDraftInTheForm();
    state().updateDraft({ loanAmountRequested: 1_200_000 });
    state().addAttachment(id, PDF);
    expect(Date.parse(state().draft.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(state().applications.find((a) => a.applicationId === id)!.updatedAt),
    );
  });

  it('takes the saved copy when the form copy is older (the record was edited in the sheet since)', () => {
    const id = saveDraftInTheForm();
    const saved = state().applications.find((a) => a.applicationId === id)!;
    // the form copy is older than the saved one
    useAppStore.setState({
      draft: { ...state().draft, updatedAt: '2000-01-01T00:00:00.000Z', loanAmountRequested: 5 },
      applications: state().applications.map((a) =>
        a.applicationId === id ? { ...saved, loanAmountRequested: 1_300_000 } : a,
      ),
    });
    state().addAttachment(id, PDF);
    expect(state().draft.loanAmountRequested).toBe(1_300_000);
  });
});

describe('the star of a document that was removed in the record sheet', () => {
  it('goes with the file, so that a later upload of the same DocType does not inherit it', () => {
    const gst = {
      id: 'HL-2026-0004-gst-certificate',
      docType: 'GST Certificate or Business Licence' as const,
      fileName: 'GST.pdf',
      mimeType: 'application/pdf' as const,
      sizeBytes: 1000,
      uploadedAt: SAVITA.createdAt,
      uploadedBy: 'Priya Kulkarni',
    };
    const withGst = { ...SAVITA, documents: [...SAVITA.documents, gst] };
    state().saveApplication(withGst);
    state().toggleFavouriteFile(gst.id);
    expect(state().favouriteFileIds).toContain(gst.id);
    const edited = { ...withGst, documents: SAVITA.documents };
    const out = state().saveRecordEdit({
      applicationId: SAVITA.applicationId,
      edited,
      changes: [],
      documentChanges: documentChanges(withGst.documents, edited.documents),
      user: DEMO_USERS.priya,
    });
    expect(out.ok).toBe(true);
    expect(state().favouriteFileIds).not.toContain(gst.id);
  });
});

describe('the limit of a note and of a comment is that of what was typed', () => {
  // 12 digits become "XXXX XXXX 1234": two characters more once masked
  it('takes a note of 200 characters that ends in an unspaced Aadhaar number', () => {
    const note = `${'a'.repeat(MAX_NOTE_LENGTH - 12)}234500074821`;
    expect(note).toHaveLength(MAX_NOTE_LENGTH);
    const out = state().addAttachment('HL-2026-0001', PDF, note);
    expect(out.ok).toBe(true);
    expect(JSON.stringify(state().applications)).not.toMatch(/2345\s?0007/);
  });

  it('refuses a note of 201 characters', () => {
    const out = state().addAttachment('HL-2026-0001', PDF, 'a'.repeat(MAX_NOTE_LENGTH + 1));
    expect(out.ok).toBe(false);
  });

  it('takes a comment of 1000 characters that ends in an unspaced Aadhaar number', () => {
    const text = `${'a'.repeat(MAX_COMMENT_LENGTH - 12)}234500074821`;
    expect(text).toHaveLength(MAX_COMMENT_LENGTH);
    const out = state().addRecordComment('HL-2026-0001', text);
    expect(out.ok).toBe(true);
    expect(JSON.stringify(state().recordComments)).not.toMatch(/2345\s?0007/);
  });

  it('refuses a comment of 1001 characters', () => {
    const out = state().addRecordComment('HL-2026-0001', 'a'.repeat(MAX_COMMENT_LENGTH + 1));
    expect(out.ok).toBe(false);
  });
});
