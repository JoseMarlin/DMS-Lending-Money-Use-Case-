import {
  ATTACHMENT_ERROR,
  MAX_NOTE_LENGTH,
  addAttachment,
  applicationDocuments,
  attachmentMimeType,
  attachmentsOf,
  canRemoveAttachment,
  isAttachment,
  nextAttachmentId,
  removeAttachment,
  validateAttachmentFile,
} from './attachments';
import { SEED_APPLICATIONS } from './seed';
import { useAppStore } from './store';
import { SUPPORTING_DOCUMENT, type ApplicationDocument } from './types';
import { DEMO_USERS } from './users';
import type { WorkflowData } from './workflow';

const [VIJAY, SHOBHA] = SEED_APPLICATIONS;
const { priya, mahesh, admin } = DEMO_USERS;
const NOW = new Date('2026-10-12T10:00:00Z');
const PDF = { name: 'Salary_Slip_Sept.pdf', size: 200_000, type: 'application/pdf' };

const data = (): WorkflowData => {
  const s = useAppStore.getState();
  return {
    applications: structuredClone(s.applications),
    masterRecords: [],
    workflowInstances: s.workflowInstances,
    auditEvents: s.auditEvents,
    notifications: s.notifications,
  };
};

beforeEach(() => {
  localStorage.clear();
  useAppStore.getState().resetDemo();
});

describe('which files can be attached', () => {
  it.each([
    ['a.pdf', 'application/pdf'],
    ['a.jpg', 'image/jpeg'],
    ['a.png', 'image/png'],
    ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ])('takes %s as %s', (name, type) => {
    expect(attachmentMimeType({ name, type })).toBe(type);
    expect(validateAttachmentFile({ name, type, size: 1000 })).toBeNull();
  });

  it('goes by the extension when the browser gives no type', () => {
    expect(attachmentMimeType({ name: 'Scan.PDF', type: '' })).toBe('application/pdf');
    expect(attachmentMimeType({ name: 'Notes.docx', type: '' })).toContain('wordprocessingml');
    expect(attachmentMimeType({ name: 'noextension', type: '' })).toBeNull();
  });

  it.each(['a.exe', 'a.doc', 'a.xlsx', 'a.txt', 'a.zip'])('refuses %s', (name) => {
    expect(validateAttachmentFile({ name, type: '', size: 1000 })).toBe(ATTACHMENT_ERROR);
  });

  it('refuses a type that is not allowed even if the extension is', () => {
    expect(validateAttachmentFile({ name: 'a.pdf', type: 'application/zip', size: 10 })).toBe(
      ATTACHMENT_ERROR,
    );
  });

  it('takes a file of exactly 5 MB, and refuses one byte more, and an empty one', () => {
    const limit = 5 * 1024 * 1024;
    expect(validateAttachmentFile({ ...PDF, size: limit })).toBeNull();
    expect(validateAttachmentFile({ ...PDF, size: limit + 1 })).toBe(ATTACHMENT_ERROR);
    expect(validateAttachmentFile({ ...PDF, size: 0 })).toBe(ATTACHMENT_ERROR);
  });
});

describe('reading the attachments of an application', () => {
  it('tells an attachment from a document of the form', () => {
    const docs = VIJAY.documents;
    expect(docs.filter(isAttachment)).toHaveLength(2);
    expect(applicationDocuments(docs)).toHaveLength(12);
    expect(applicationDocuments(docs).every((d) => d.docType !== SUPPORTING_DOCUMENT)).toBe(true);
  });

  it('lists the attachments oldest first', () => {
    const names = attachmentsOf(VIJAY.documents).map((d) => d.fileName);
    expect(names).toEqual(['Salary_Slip_Aug.pdf', 'Electricity_Bill.pdf']);
    const reversed = [...VIJAY.documents].reverse();
    expect(attachmentsOf(reversed).map((d) => d.fileName)).toEqual(names);
  });

  it('numbers the next one from the largest in use', () => {
    expect(nextAttachmentId('HL-1', [])).toBe('HL-1-supporting-document-1');
    const docs = [
      { id: 'HL-1-supporting-document-3' },
      { id: 'HL-1-supporting-document-1' },
      { id: 'HL-1-pan-card' },
      { id: 'HL-2-supporting-document-9' },
    ] as ApplicationDocument[];
    expect(nextAttachmentId('HL-1', docs)).toBe('HL-1-supporting-document-4');
  });

  it('lets only whoever attached a file, and the administrator, remove it', () => {
    const doc = attachmentsOf(VIJAY.documents)[0]; // by Priya
    expect(canRemoveAttachment(doc, priya)).toBe(true);
    expect(canRemoveAttachment(doc, admin)).toBe(true);
    expect(canRemoveAttachment(doc, mahesh)).toBe(false);
  });
});

describe('addAttachment', () => {
  it('adds a Supporting Document with the note, the person and the time, after the others', () => {
    const out = addAttachment(data(), {
      applicationId: SHOBHA.applicationId,
      file: PDF,
      note: '  September slip  ',
      user: mahesh,
      now: NOW,
    });
    if (!out.ok) throw new Error(out.error);
    expect(out.document).toEqual({
      id: 'HL-2026-0002-supporting-document-3',
      docType: 'Supporting Document',
      fileName: 'Salary_Slip_Sept.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 200_000,
      uploadedAt: NOW.toISOString(),
      uploadedBy: 'Mahesh Joshi',
      version: 'v1.0',
      note: 'September slip',
    });
    const saved = out.data.applications.find((a) => a.applicationId === 'HL-2026-0002')!;
    expect(saved.documents.at(-1)).toBe(out.document);
    expect(saved.documents).toHaveLength(SHOBHA.documents.length + 1);
    expect(saved.updatedAt).toBe(NOW.toISOString());
  });

  it('has no note key when there is none, and keeps the preview link when given', () => {
    const out = addAttachment(data(), {
      applicationId: SHOBHA.applicationId,
      file: { ...PDF, previewUrl: 'blob:x' },
      user: priya,
      now: NOW,
    });
    if (!out.ok) throw new Error(out.error);
    expect('note' in out.document).toBe(false);
    expect(out.document.previewUrl).toBe('blob:x');
  });

  it('writes the event "Attachment added" with who, when, the file and the note', () => {
    const before = data();
    const out = addAttachment(before, {
      applicationId: SHOBHA.applicationId,
      file: PDF,
      note: 'September slip',
      user: priya,
      now: NOW,
    });
    if (!out.ok) throw new Error(out.error);
    expect(out.data.auditEvents).toHaveLength(before.auditEvents.length + 1);
    expect(out.data.auditEvents.at(-1)).toMatchObject({
      applicationId: 'HL-2026-0002',
      event: 'Attachment added',
      user: 'Priya Kulkarni',
      at: NOW.toISOString(),
      field: 'Supporting Document',
      newValue: 'Salary_Slip_Sept.pdf',
      comment: 'September slip',
    });
  });

  it('masks an Aadhaar number in the file name and the note, in the record and in the trail', () => {
    const out = addAttachment(data(), {
      applicationId: SHOBHA.applicationId,
      file: { ...PDF, name: 'aadhaar_234500074821.pdf' },
      note: 'Number is 2345 0007 4821',
      user: priya,
      now: NOW,
    });
    if (!out.ok) throw new Error(out.error);
    expect(out.document.fileName).toBe('aadhaar_XXXX XXXX 4821.pdf');
    expect(out.document.note).toBe('Number is XXXX XXXX 4821');
    expect(JSON.stringify(out.data)).not.toMatch(/2345\s?0007|234500074821/);
  });

  it('also puts it in the master record, when the application has one', () => {
    const base = data();
    const withMaster = { ...base, masterRecords: [base.applications[0]] };
    const out = addAttachment(withMaster, {
      applicationId: VIJAY.applicationId,
      file: PDF,
      user: admin,
      now: NOW,
    });
    if (!out.ok) throw new Error(out.error);
    expect(out.data.masterRecords[0].documents).toHaveLength(VIJAY.documents.length + 1);
  });

  it.each([
    ['a type that is not allowed', { name: 'a.exe', size: 10, type: '' }, 'invalid-file'],
    ['a file over 5 MB', { ...PDF, size: 6 * 1024 * 1024 }, 'invalid-file'],
  ])('refuses %s', (_name, file, code) => {
    const out = addAttachment(data(), { applicationId: 'HL-2026-0002', file, user: priya });
    expect(out).toMatchObject({ ok: false, code });
  });

  it('refuses a note over 200 characters, and takes one of exactly 200', () => {
    const long = addAttachment(data(), {
      applicationId: 'HL-2026-0002',
      file: PDF,
      note: 'x'.repeat(MAX_NOTE_LENGTH + 1),
      user: priya,
    });
    expect(long).toMatchObject({ ok: false, code: 'note-too-long' });
    const exact = addAttachment(data(), {
      applicationId: 'HL-2026-0002',
      file: PDF,
      note: 'x'.repeat(MAX_NOTE_LENGTH),
      user: priya,
    });
    expect(exact.ok).toBe(true);
  });

  it('refuses an application that is not there', () => {
    expect(
      addAttachment(data(), { applicationId: 'HL-9999', file: PDF, user: priya }),
    ).toMatchObject({
      ok: false,
      code: 'not-found',
    });
  });

  it('does not change the data it was given', () => {
    const before = data();
    const copy = structuredClone(before);
    addAttachment(before, {
      applicationId: 'HL-2026-0002',
      file: PDF,
      note: 'x',
      user: priya,
      now: NOW,
    });
    expect(before).toEqual(copy);
  });
});

describe('removeAttachment', () => {
  const first = attachmentsOf(SHOBHA.documents)[0];

  it('removes it, and writes "Attachment removed" with the file name', () => {
    const before = data();
    const out = removeAttachment(before, {
      applicationId: 'HL-2026-0002',
      documentId: first.id,
      user: priya,
      now: NOW,
    });
    if (!out.ok) throw new Error(out.error);
    const saved = out.data.applications.find((a) => a.applicationId === 'HL-2026-0002')!;
    expect(saved.documents.some((d) => d.id === first.id)).toBe(false);
    expect(saved.documents).toHaveLength(SHOBHA.documents.length - 1);
    expect(out.data.auditEvents.at(-1)).toMatchObject({
      event: 'Attachment removed',
      user: 'Priya Kulkarni',
      field: 'Supporting Document',
      oldValue: first.fileName,
    });
  });

  it('lets the administrator remove what somebody else attached', () => {
    const out = removeAttachment(data(), {
      applicationId: 'HL-2026-0002',
      documentId: first.id,
      user: admin,
    });
    expect(out.ok).toBe(true);
  });

  it('refuses a person who did not attach it', () => {
    const out = removeAttachment(data(), {
      applicationId: 'HL-2026-0002',
      documentId: first.id,
      user: mahesh,
    });
    expect(out).toMatchObject({ ok: false, code: 'not-allowed' });
  });

  it('refuses a document of the form: only an attachment can be removed this way', () => {
    const pan = SHOBHA.documents.find((d) => d.docType === 'PAN Card')!;
    const out = removeAttachment(data(), {
      applicationId: 'HL-2026-0002',
      documentId: pan.id,
      user: admin,
    });
    expect(out).toMatchObject({ ok: false, code: 'no-such-attachment' });
  });

  it('says so for an attachment that is gone, and an application that is not there', () => {
    expect(
      removeAttachment(data(), { applicationId: 'HL-2026-0002', documentId: 'nope', user: admin }),
    ).toMatchObject({ ok: false, code: 'no-such-attachment' });
    expect(
      removeAttachment(data(), { applicationId: 'HL-9999', documentId: first.id, user: admin }),
    ).toMatchObject({ ok: false, code: 'not-found' });
  });
});

describe('the store actions', () => {
  const state = () => useAppStore.getState();

  it('add an attachment as the user who is acting, and the trail follows', () => {
    state().setCurrentUser('mahesh');
    const before = state().auditEvents.length;
    const out = state().addAttachment('HL-2026-0003', PDF, 'Received by mail');
    expect(out.ok).toBe(true);
    const app = state().applications.find((a) => a.applicationId === 'HL-2026-0003')!;
    expect(app.documents.at(-1)).toMatchObject({
      uploadedBy: 'Mahesh Joshi',
      note: 'Received by mail',
    });
    expect(state().auditEvents).toHaveLength(before + 1);
  });

  it('follow the form when the application is the one in the form', () => {
    state().fillScenario('A');
    state().saveApplication(state().draft);
    const id = state().draft.applicationId;
    state().addAttachment(id, PDF);
    expect(state().draft.documents.some(isAttachment)).toBe(true);
  });

  it('remove an attachment, and take its star away', () => {
    const doc = attachmentsOf(SHOBHA.documents)[0];
    state().toggleFavouriteFile(doc.id);
    expect(state().favouriteFileIds).toContain(doc.id);
    const out = state().removeAttachment('HL-2026-0002', doc.id);
    expect(out.ok).toBe(true);
    expect(state().favouriteFileIds).not.toContain(doc.id);
  });

  it('are refused for somebody who may not remove', () => {
    state().setCurrentUser('sunita');
    const doc = attachmentsOf(SHOBHA.documents)[0];
    expect(state().removeAttachment('HL-2026-0002', doc.id)).toMatchObject({
      ok: false,
      code: 'not-allowed',
    });
    expect(
      state().applications.find((a) => a.applicationId === 'HL-2026-0002')!.documents,
    ).toContainEqual(expect.objectContaining({ id: doc.id }));
  });

  it('keep an attachment through a reload (saved with the application) and a Reset demo brings the seed back', () => {
    state().addAttachment('HL-2026-0003', PDF, 'x');
    const saved = JSON.parse(localStorage.getItem('dms-home-loan-demo')!).state;
    expect(
      saved.applications.find((a: { applicationId: string }) => a.applicationId === 'HL-2026-0003')
        .documents,
    ).toContainEqual(
      expect.objectContaining({ fileName: 'Salary_Slip_Sept.pdf', docType: 'Supporting Document' }),
    );
    state().resetDemo();
    expect(
      state()
        .applications.find((a) => a.applicationId === 'HL-2026-0003')!
        .documents.filter(isAttachment),
    ).toHaveLength(1);
  });
});
