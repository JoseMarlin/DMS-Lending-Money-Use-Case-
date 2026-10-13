import { allowedMimeType, UPLOAD_ERROR, validateUploadFile } from './upload';

const MB = 1024 * 1024;
const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('validateUploadFile', () => {
  it('uses the error text from the overview', () => {
    expect(UPLOAD_ERROR).toBe('Upload PDF, JPG or PNG up to 5 MB');
  });

  it.each([
    ['scan.pdf', 'application/pdf'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['scan.png', 'image/png'],
  ])('accepts %s', (name, type) => {
    expect(validateUploadFile(file(name, type))).toBeNull();
  });

  it('accepts a file of exactly 5 MB and rejects one byte more', () => {
    expect(validateUploadFile(file('a.pdf', 'application/pdf', 5 * MB))).toBeNull();
    expect(validateUploadFile(file('a.pdf', 'application/pdf', 5 * MB + 1))).toBe(UPLOAD_ERROR);
  });

  it.each([
    ['notes.txt', 'text/plain'],
    ['sheet.xlsx', 'application/vnd.ms-excel'],
    ['clip.gif', 'image/gif'],
    ['scan.tiff', 'image/tiff'],
    ['doc.docx', 'application/msword'],
  ])('rejects %s', (name, type) => {
    expect(validateUploadFile(file(name, type))).toBe(UPLOAD_ERROR);
  });

  it('trusts the file type over a misleading extension', () => {
    expect(validateUploadFile(file('scan.pdf', 'text/plain'))).toBe(UPLOAD_ERROR);
  });

  it('falls back to the extension when the browser gives no type', () => {
    expect(validateUploadFile(file('scan.PDF', ''))).toBeNull();
    expect(validateUploadFile(file('photo.PNG', ''))).toBeNull();
    expect(validateUploadFile(file('notes.txt', ''))).toBe(UPLOAD_ERROR);
    expect(validateUploadFile(file('noextension', ''))).toBe(UPLOAD_ERROR);
  });
});

describe('allowedMimeType', () => {
  it('returns the type to keep in the record', () => {
    expect(allowedMimeType(file('a.jpg', 'image/jpeg'))).toBe('image/jpeg');
    expect(allowedMimeType(file('a.jpeg', ''))).toBe('image/jpeg');
    expect(allowedMimeType(file('a.gif', 'image/gif'))).toBeNull();
  });
});
