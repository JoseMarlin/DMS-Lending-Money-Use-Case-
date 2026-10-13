import { SEED_APPLICATIONS } from '@/data/seed';
import { ApplicationStatus, type HomeLoanApplication } from '@/data/types';
import { DEMO_USERS } from '@/data/users';
import {
  attachmentRows,
  documentControlId,
  documentCounts,
  documentRows,
  downloadMock,
  downloadPlaceholder,
  placeOf,
  previewOfDocument,
} from './filesPanelModel';

const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ, , PRAKASH] = SEED_APPLICATIONS;

describe('the rows of the documents of the form', () => {
  it('has one row for each DocType that the application asks for, in the order of the form', () => {
    const rows = documentRows(VIJAY); // salaried: no GST certificate
    expect(rows.map((r) => r.docType)).toEqual([
      'PAN Card',
      'Aadhaar (Masked Copy)',
      'Photograph',
      'Address Proof',
      'Income Proof',
      'Surety Documents',
      'Sale or Gift Deed',
      'Records of Rights',
      'Encumbrance Certificate',
      'Building Permission',
      'Valuation Certificate',
      'Tax Paid Receipt',
    ]);
    expect(rows.every((r) => r.required)).toBe(true);
  });

  it('has the GST certificate too for a business applicant', () => {
    const rows = documentRows(SHOBHA);
    expect(rows).toHaveLength(13);
    expect(rows.map((r) => r.docType)).toContain('GST Certificate or Business Licence');
  });

  it('gives each uploaded document its file, its status and its place, and the attachments are not here', () => {
    const rows = documentRows(VIJAY);
    expect(rows.every((r) => r.doc && r.status === 'Filed' && r.place)).toBe(true);
    expect(rows.every((r) => r.doc?.docType !== 'Supporting Document')).toBe(true);
    expect(rows[0].place).toEqual({
      folderId: 'Loans/Home Loan/Belagavi Main Branch (demo)/HL-2026-0001 Vijay Kulkarni/01 KYC',
      folderPath:
        'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 01 KYC',
      folderLabel: '... / 01 KYC',
    });
  });

  it('has a row that says nothing is uploaded for a document that is missing, with no status or place', () => {
    const rows = documentRows(PRAKASH); // a draft with three documents
    const uploaded = rows.filter((r) => r.doc);
    const missing = rows.filter((r) => !r.doc);
    expect(uploaded.map((r) => r.docType)).toEqual([
      'PAN Card',
      'Aadhaar (Masked Copy)',
      'Photograph',
    ]);
    expect(missing).toHaveLength(9);
    expect(missing.every((r) => r.required && r.status === null && r.place === null)).toBe(true);
  });

  it('puts the files of each status where the status puts them', () => {
    expect(documentRows(SHOBHA)[0]).toMatchObject({ status: 'Pending approval' });
    expect(documentRows(MANJUNATH)[0].place?.folderPath).toContain('/ Pending Approval /');
    expect(documentRows(SAVITA)[0]).toMatchObject({ status: 'Returned' });
    expect(documentRows(BASAVARAJ)[0]).toMatchObject({ status: 'Rejected' });
    expect(documentRows(PRAKASH)[0]).toMatchObject({ status: 'Draft' });
    expect(documentRows(PRAKASH)[0].place?.folderPath).toContain('/ Drafts /');
  });

  it('keeps a document that is not asked for (the GST certificate of an applicant who is no longer a business) after the others', () => {
    const changed: HomeLoanApplication = {
      ...SHOBHA,
      occupation: 'Salaried',
    };
    const rows = documentRows(changed);
    expect(rows.at(-1)).toMatchObject({
      docType: 'GST Certificate or Business Licence',
      required: false,
    });
    expect(rows.slice(0, -1).every((r) => r.required)).toBe(true);
  });

  it('counts the uploaded documents against the ones that are asked for', () => {
    expect(documentCounts(documentRows(VIJAY))).toEqual({ uploaded: 12, total: 12 });
    expect(documentCounts(documentRows(PRAKASH))).toEqual({ uploaded: 3, total: 12 });
    expect(documentCounts(documentRows(SHOBHA))).toEqual({ uploaded: 13, total: 13 });
  });
});

describe('the rows of the attachments', () => {
  it('have the attachments only, oldest first, with the person, the time, the status and the place', () => {
    const rows = attachmentRows(VIJAY, DEMO_USERS.priya);
    expect(rows.map((r) => r.doc.fileName)).toEqual([
      'Salary_Slip_Aug.pdf',
      'Electricity_Bill.pdf',
    ]);
    expect(rows[0].subline).toBe('Priya Kulkarni · 19 Aug 2026, 11:00 AM');
    expect(rows[0].status).toBe('Filed');
    expect(rows[0].place.folderLabel).toBe('... / 05 Other');
    expect(rows[0].place.folderPath).toBe(
      'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 05 Other',
    );
  });

  it('say who can remove: the person who attached, and the administrator', () => {
    expect(attachmentRows(VIJAY, DEMO_USERS.priya).every((r) => r.canRemove)).toBe(true);
    expect(attachmentRows(VIJAY, DEMO_USERS.admin).every((r) => r.canRemove)).toBe(true);
    expect(attachmentRows(VIJAY, DEMO_USERS.mahesh).some((r) => r.canRemove)).toBe(false);
    // the Gokak officer attached the one of Manjunath's application
    expect(attachmentRows(MANJUNATH, DEMO_USERS.priya)[0].canRemove).toBe(false);
  });

  it('are none for an application without attachments', () => {
    expect(
      attachmentRows(
        { ...VIJAY, documents: VIJAY.documents.filter((d) => d.docType !== 'Supporting Document') },
        DEMO_USERS.priya,
      ),
    ).toEqual([]);
  });

  it('follow the status: a rejected application has its attachments in Rejected', () => {
    expect(attachmentRows(BASAVARAJ, DEMO_USERS.admin)[0]).toMatchObject({ status: 'Rejected' });
    expect(attachmentRows(BASAVARAJ, DEMO_USERS.admin)[0].place.folderPath).toContain(
      '/ Rejected /',
    );
  });
});

describe('the place of a file', () => {
  it('is the folder of its DocType, 05 Other for an attachment', () => {
    expect(placeOf(VIJAY, 'Sale or Gift Deed').folderLabel).toBe('... / 03 Property');
    expect(placeOf(VIJAY, 'Supporting Document').folderLabel).toBe('... / 05 Other');
    expect(placeOf({ ...VIJAY, status: ApplicationStatus.Draft }, 'PAN Card').folderPath).toContain(
      '/ Drafts /',
    );
  });
});

describe('the preview', () => {
  it('has what the preview needs, with the status and the note', () => {
    const doc = VIJAY.documents.find((d) => d.docType === 'Supporting Document')!;
    expect(previewOfDocument(VIJAY, doc)).toMatchObject({
      fileName: 'Salary_Slip_Aug.pdf',
      docType: 'Supporting Document',
      uploadedBy: 'Priya Kulkarni',
      status: 'Filed',
      applicationId: 'HL-2026-0001',
      applicantName: 'Vijay Kulkarni',
      note: 'Latest salary slip, added after the first upload',
    });
    expect(previewOfDocument(VIJAY, doc).folderPath).toContain('/ 05 Other');
  });
});

describe('the download', () => {
  it('is a placeholder that names the file and says it is a demo', () => {
    const text = downloadPlaceholder({ fileName: 'PAN.pdf', docType: 'PAN Card' });
    expect(text).toContain('Placeholder for PAN.pdf');
    expect(text).toContain('DocType: PAN Card');
    expect(text).toContain('demo');
  });

  it('does nothing where the page cannot make a link to a file (a test)', () => {
    const original = URL.createObjectURL;
    // @ts-expect-error a browser without it
    URL.createObjectURL = undefined;
    expect(downloadMock({ fileName: 'a.pdf', docType: 'PAN Card' })).toBe(false);
    URL.createObjectURL = original;
  });

  it('gives a text file named after the document, and frees the link', () => {
    const create = vi.fn(() => 'blob:mock-download');
    const revoke = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    try {
      expect(downloadMock({ fileName: 'PAN.pdf', docType: 'PAN Card' })).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith('blob:mock-download');
      expect(document.querySelector('a[download]')).toBeNull(); // the link is not left in the page
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      click.mockRestore();
    }
  });
});

describe('the id of a row control', () => {
  it('is made from the DocType', () => {
    expect(documentControlId('Aadhaar (Masked Copy)')).toBe('record-doc-aadhaar-masked-copy-');
    expect(documentControlId('PAN Card')).toBe('record-doc-pan-card');
  });
});
