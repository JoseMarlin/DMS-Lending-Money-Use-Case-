import { useState } from 'react';
import { documentId } from '@/data/application';
import { FIRST_VERSION, nextVersion } from '@/data/fileRecords';
import { useAppStore, useCurrentUser } from '@/data/store';
import type { ApplicationDocument } from '@/data/types';
import { allowedMimeType, UPLOAD_ERROR, validateUploadFile } from '../validation/upload';
import { fieldId, type FieldSchema } from './schema';

/**
 * Mocked uploads for the document rows. Nothing is sent anywhere: a chosen file is checked (PDF,
 * JPG or PNG up to 5 MB), then only its name, size, type and a local preview link are kept in the
 * draft. A rejected file leaves the row as it was and shows the error under it.
 */
export function useDocumentUploads() {
  const user = useCurrentUser();
  const draft = useAppStore((s) => s.draft);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const resetCount = useAppStore((s) => s.draftResetCount);

  // Errors belong to one draft: a scenario fill, new draft or reset starts them afresh
  const [state, setState] = useState<{ resetCount: number; errors: Record<string, string> }>({
    resetCount,
    errors: {},
  });
  const errors = state.resetCount === resetCount ? state.errors : {};

  const setError = (field: FieldSchema, message: string | null) => {
    const next = { ...errors };
    if (message) next[fieldId(field)] = message;
    else delete next[fieldId(field)];
    setState({ resetCount, errors: next });
  };

  const withoutDocType = (field: FieldSchema) =>
    draft.documents.filter((d) => d.docType !== field.docType);

  const selectFile = (field: FieldSchema, file: File) => {
    const error = validateUploadFile(file);
    const mimeType = allowedMimeType(file);
    if (error || !mimeType || !field.docType) {
      setError(field, error ?? UPLOAD_ERROR);
      return;
    }
    // the same DocType again is the same file with the next version, not a second file
    const replaced = draft.documents.find((d) => d.docType === field.docType);
    const document: ApplicationDocument = {
      id: documentId(draft.applicationId, field.docType),
      docType: field.docType,
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.name,
      version: replaced ? nextVersion(replaced.version) : FIRST_VERSION,
      previewUrl: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined,
    };
    setError(field, null);
    updateDraft({ documents: [...withoutDocType(field), document] });
  };

  const removeFile = (field: FieldSchema) => {
    setError(field, null);
    updateDraft({ documents: withoutDocType(field) });
  };

  return { uploadErrors: errors, selectFile, removeFile };
}
