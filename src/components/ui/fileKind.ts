import type { DocumentMimeType } from '@/data/types';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type FileKind = 'pdf' | 'image' | 'doc';

/** Which icon a file gets: a PDF, a Word document, or a picture (JPG or PNG). */
export function fileKindOf(mimeType: DocumentMimeType | string): FileKind {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === DOCX) return 'doc';
  return 'image';
}

/** "PDF", "JPG", "PNG": the short name drawn under a file's thumbnail. */
export function fileTypeShort(mimeType: DocumentMimeType | string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF';
    case 'image/jpeg':
      return 'JPG';
    case 'image/png':
      return 'PNG';
    case DOCX:
      return 'DOCX';
    default:
      return 'FILE';
  }
}

/** "PDF document", "JPEG image", "PNG image": what a person calls the type. */
export function fileTypeName(mimeType: DocumentMimeType | string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF document';
    case 'image/jpeg':
      return 'JPEG image';
    case 'image/png':
      return 'PNG image';
    case DOCX:
      return 'Word document';
    default:
      return 'File';
  }
}
