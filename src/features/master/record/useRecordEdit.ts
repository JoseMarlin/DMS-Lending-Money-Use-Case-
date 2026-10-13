import { useState } from 'react';
import { useToast } from '@/components/ui';
import { maskAadhaarInText } from '@/data/aadhaar';
import { documentId, requiredDocTypes } from '@/data/application';
import { FIRST_VERSION, nextVersion } from '@/data/fileRecords';
import { documentChanges as changedDocuments, needsReason, type KycRerun } from '@/data/recordEdit';
import { useAppStore } from '@/data/store';
import type { ApplicationDocument, DemoUser, DocType, HomeLoanApplication } from '@/data/types';
import { fieldId, type FieldSchema } from '@/features/home-loan/form/schema';
import { allowedMimeType, validateUploadFile } from '@/features/home-loan/validation/upload';
import {
  applyFieldChange,
  changedFields,
  identityTouched,
  filesInError,
  tabsWithIssues,
  validateEdit,
  type EditIssue,
  type IssueTab,
} from './editModel';
import { SHEET_TABS } from './recordSheetModel';

/** Frees a local link to a file that is not kept. */
const revokePreview = (url: string) => {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function')
    URL.revokeObjectURL(url);
};

/** Where the person is in editing and saving. */
export type EditStep = 'editing' | 'discard' | 'kyc' | 'reason';

interface Session {
  /** The record as it is being edited: kept while the tabs are switched, until it is saved or cancelled */
  working: HomeLoanApplication;
  /** The fields that were left at least once (their errors show) */
  touched: string[];
  /** Save was pressed: every error shows */
  attempted: boolean;
  /** "Change Aadhaar" was pressed: the masked value gave way to an input */
  aadhaarChanging: boolean;
  /** An Aadhaar number was typed (the record only holds the masked one, so this is what says it changed) */
  aadhaarEntered: boolean;
  /** Why the checks that were run again blocked the save (a Fail), until the next try */
  kycFailure: string[] | null;
  /** A refusal of the store (the person may no longer edit, say) */
  saveError: string | null;
}

/** What pressing Save found: the first error, so that the sheet goes to its tab and its field. */
export interface SaveBlock {
  tab: IssueTab;
  field: FieldSchema;
}

/** A file chosen for a document of the form (a replacement, or the one that was missing). */
export interface ChosenDocument {
  name: string;
  size: number;
  type: string;
  /** A local link to the file, for the preview (it does not survive a reload) */
  previewUrl?: string;
}

/** What the text of the toast says about a save: the fields and the documents that were changed. */
function savedMessage(fields: number, documents: number): string {
  const parts = [
    fields > 0 ? `${fields} ${fields === 1 ? 'field' : 'fields'}` : '',
    documents > 0 ? `${documents} ${documents === 1 ? 'document' : 'documents'}` : '',
  ].filter(Boolean);
  return `Changes saved: ${parts.join(' and ')} updated`;
}

/**
 * The edit mode of the record sheet: a working copy, the errors, and the steps of saving (the
 * checks again when an identity field changed, the reason for the change of an approved record).
 * The store is only written when the save goes through.
 */
export function useRecordEdit({
  application,
  user,
  onSaved,
}: {
  /** The record as it is in the store */
  application: HomeLoanApplication;
  user: DemoUser;
  /** Called after a save, with the number of fields that changed */
  onSaved: (changed: number) => void;
}) {
  const applications = useAppStore((state) => state.applications);
  const saveRecordEdit = useAppStore((state) => state.saveRecordEdit);
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<EditStep>('editing');
  const [kyc, setKyc] = useState<KycRerun | null>(null);

  const active = session !== null;
  const working = session?.working ?? application;
  const changes = session
    ? changedFields(application, session.working, session.aadhaarEntered)
    : [];
  const documentChanges = session
    ? changedDocuments(application.documents, session.working.documents)
    : [];
  const dirty = changes.length > 0 || documentChanges.length > 0;
  const issues: EditIssue[] = session
    ? validateEdit(session.working, applications, session.attempted)
    : [];
  const errors: Record<string, string> = {};
  if (session) {
    for (const issue of issues) {
      if (session.attempted || session.touched.includes(issue.fieldId)) {
        errors[issue.fieldId] = issue.message;
      }
    }
  }
  const tabsInError = session?.attempted ? tabsWithIssues(issues) : [];
  const filesNeedAttention = session?.attempted ? filesInError(issues) : false;
  const needsKyc = session
    ? identityTouched(application, session.working, session.aadhaarEntered)
    : false;

  const update = (change: (s: Session) => Session) =>
    setSession((current) => (current ? change(current) : current));

  const exit = (saved = false) => {
    // the local links of files chosen in this session that were not saved are freed
    if (!saved && session) {
      for (const doc of session.working.documents) {
        const kept = application.documents.some((d) => d.previewUrl === doc.previewUrl);
        if (doc.previewUrl && !kept) revokePreview(doc.previewUrl);
      }
    }
    setSession(null);
    setStep('editing');
    setKyc(null);
  };

  const start = () => {
    setSession({
      working: application,
      touched: [],
      attempted: false,
      // a record with no Aadhaar, or one that was kept as not valid, has nothing to show masked: it opens
      // on the input, which says what is wrong
      aadhaarChanging: !/^XXXX XXXX \d{4}$/.test(application.aadhaar),
      aadhaarEntered: false,
      kycFailure: null,
      saveError: null,
    });
    setStep('editing');
    setKyc(null);
  };

  /** The write to the store, after the checks and the reason: the end of a save. */
  const commit = (rerun: KycRerun | null, reason: string) => {
    if (!session) return;
    const outcome = saveRecordEdit({
      applicationId: application.applicationId,
      edited: session.working,
      changes,
      documentChanges,
      kyc: rerun ?? undefined,
      reason,
      user,
    });
    if (!outcome.ok) {
      update((s) => ({ ...s, saveError: outcome.error }));
      setStep('editing');
      return;
    }
    const fields = outcome.changes.length;
    const documents = outcome.documentChanges.length;
    exit(true);
    toast.show(fields + documents === 0 ? 'No changes to save' : savedMessage(fields, documents));
    onSaved(fields + documents);
  };

  return {
    active,
    step,
    working,
    dirty,
    changes,
    /** The documents uploaded, replaced or removed in this session, not saved yet */
    documentChanges,
    errors,
    issues,
    tabsInError,
    /** A required document is missing and Save was pressed */
    filesNeedAttention,
    needsKyc,
    kycFailure: session?.kycFailure ?? null,
    saveError: session?.saveError ?? null,
    aadhaarChanging: session?.aadhaarChanging ?? false,
    /** The checks that were run again, once the dialog has given them */
    kyc,

    start,

    change: (field: FieldSchema, raw: string) =>
      update((s) => ({
        ...s,
        working: applyFieldChange(s.working, field, raw),
        aadhaarEntered: s.aadhaarEntered || (field.mask === 'aadhaar' && raw !== ''),
        kycFailure: null,
        saveError: null,
      })),

    /** The person left a field: its error shows from now on */
    blur: (field: FieldSchema) =>
      update((s) => {
        const id = fieldId(field);
        return s.touched.includes(id) ? s : { ...s, touched: [...s.touched, id] };
      }),

    /** "Change Aadhaar": the masked value gives way to an empty input with the form's behaviour */
    changeAadhaar: () =>
      update((s) => ({
        ...s,
        aadhaarChanging: true,
        working: { ...s.working, aadhaar: '' },
      })),

    /**
     * A file chosen for a document of the form: it takes the place of the one there is (the next
     * version, v1.0 to v1.1) or is the one that was missing. Gives the error text, or null.
     */
    replaceDocument: (docType: DocType, file: ChosenDocument): string | null => {
      const error = validateUploadFile(file);
      const mimeType = allowedMimeType(file);
      if (error || !mimeType) return error ?? 'Upload PDF, JPG or PNG up to 5 MB';
      const now = new Date().toISOString();
      update((s) => {
        const there = s.working.documents.find((d) => d.docType === docType);
        const stored = application.documents.find((d) => d.docType === docType);
        // the version counts from the saved file, so choosing again before Save does not skip one
        const doc: ApplicationDocument = {
          id: documentId(application.applicationId, docType),
          docType,
          fileName: maskAadhaarInText(file.name.trim()),
          mimeType,
          sizeBytes: file.size,
          uploadedAt: now,
          uploadedBy: user.name,
          version: stored ? nextVersion(stored.version) : FIRST_VERSION,
          ...(file.previewUrl ? { previewUrl: file.previewUrl } : {}),
          ...(stored?.filing ? { filing: { ...stored.filing, storedAt: now } } : {}),
        };
        if (there?.previewUrl && there.previewUrl !== stored?.previewUrl)
          revokePreview(there.previewUrl);
        return {
          ...s,
          working: {
            ...s.working,
            documents: [...s.working.documents.filter((d) => d.docType !== docType), doc],
          },
          saveError: null,
        };
      });
      return null;
    },

    /** Takes a document of the form out of the working copy, unless the form asks for it. Gives the reason it cannot, or null. */
    removeDocument: (docType: DocType): string | null => {
      if (!session) return null;
      if (requiredDocTypes(session.working.occupation).includes(docType)) {
        return 'This document is required';
      }
      update((s) => {
        // a file chosen in this session and then removed: its local link is freed now
        const there = s.working.documents.find((d) => d.docType === docType);
        const stored = application.documents.find((d) => d.docType === docType);
        if (there?.previewUrl && there.previewUrl !== stored?.previewUrl) {
          revokePreview(there.previewUrl);
        }
        return {
          ...s,
          working: {
            ...s.working,
            documents: s.working.documents.filter((d) => d.docType !== docType),
          },
          saveError: null,
        };
      });
      return null;
    },

    /** Cancel: with changes it asks first */
    requestCancel: () => {
      if (!session) return;
      if (dirty) setStep('discard');
      else exit();
    },
    keepEditing: () => setStep('editing'),
    discard: () => exit(),

    /**
     * Save. When something is wrong the first error is given back (to go to its tab and field),
     * else the next step starts: the checks, the reason, or the save itself.
     */
    save: (): SaveBlock | null => {
      if (!session) return null;
      const found = validateEdit(session.working, applications, true);
      update((s) => ({ ...s, attempted: true, kycFailure: null, saveError: null }));
      setKyc(null); // the result of an earlier try is not the result of this one
      if (found.length > 0) {
        // the first tab that has an error, and in it the first field (the sort keeps the order of the form);
        // a missing document, which is in the Files and Attachments panel, comes after the tabs
        const order: IssueTab[] = [...SHEET_TABS.map((t) => t.id), 'files'];
        const [first] = [...found].sort((a, b) => order.indexOf(a.tab) - order.indexOf(b.tab));
        return { tab: first.tab, field: first.field };
      }
      if (!dirty) {
        // nothing changed: there is nothing to check, to give a reason for or to write
        exit(true);
        toast.show('No changes to save');
        onSaved(0);
        return null;
      }
      if (needsKyc) setStep('kyc');
      else if (needsReason(application)) setStep('reason');
      else commit(null, '');
      return null;
    },

    /** The checks are over and the person went on (a Pass, or an Exception with its remark) */
    kycDone: (rerun: KycRerun) => {
      setKyc(rerun);
      if (needsReason(application)) setStep('reason');
      else commit(rerun, '');
    },
    /** The checks ended in Fail: back to editing, with the reasons */
    kycFailed: (reasons: string[]) => {
      update((s) => ({ ...s, kycFailure: reasons }));
      setKyc(null);
      setStep('editing');
    },
    /** The checks were stopped (or the dialog closed): back to editing */
    kycStopped: () => {
      setKyc(null);
      setStep('editing');
    },

    /** The reason for the change was written */
    reasonDone: (reason: string) => commit(needsKyc ? kyc : null, reason),
    reasonCancelled: () => {
      setKyc(null);
      setStep('editing');
    },
  };
}

export type RecordEdit = ReturnType<typeof useRecordEdit>;
