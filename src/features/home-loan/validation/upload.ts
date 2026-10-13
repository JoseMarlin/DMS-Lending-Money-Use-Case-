import { ALLOWED_UPLOAD_MIME_TYPES, LIMITS } from '@/data/options';
import type { DocumentMimeType } from '@/data/types';

/** Section 7, "On upload": PDF, JPG or PNG, up to 5 MB each. */
export const UPLOAD_ERROR = 'Upload PDF, JPG or PNG up to 5 MB';

const MIME_BY_EXTENSION: Record<string, DocumentMimeType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

interface FileLike {
  name: string;
  size: number;
  type: string;
}

/** The allowed type of a file, or null. Falls back to the extension when the browser gives no type. */
export function allowedMimeType(file: FileLike): DocumentMimeType | null {
  if (file.type) {
    return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)
      ? (file.type as DocumentMimeType)
      : null;
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? null;
}

/** Returns the error text for a file that must be rejected, or null if it is fine. */
export function validateUploadFile(file: FileLike): string | null {
  if (!allowedMimeType(file)) return UPLOAD_ERROR;
  if (file.size > LIMITS.maxUploadBytes) return UPLOAD_ERROR;
  return null;
}
