/**
 * The trail of a draft: told from what the application holds, with what the record sheet logged while it was a
 * draft told once (not drawn a second time), and the KYC checks after the draft existed.
 */
import { SEED_APPLICATIONS } from '@/data/seed';
import type { AuditEvent, HomeLoanApplication } from '@/data/types';
import { draftKycTime, formAuditEvents, withoutLoggedEvents } from '@/data/workflow';
import { auditTimeline, itemOf } from './auditLogModel';

const PRAKASH = SEED_APPLICATIONS[6];
const ID = PRAKASH.applicationId;

const logged = (over: Partial<AuditEvent>): AuditEvent => ({
  id: 'AE-90001',
  applicationId: ID,
  event: 'Document uploaded',
  user: 'Priya Kulkarni',
  at: '2026-10-13T15:30:00+05:30',
  comment: '',
  field: '',
  oldValue: '',
  newValue: '',
  reference: '',
  ...over,
});

const drawn = (app: HomeLoanApplication = PRAKASH) => formAuditEvents(app, draftKycTime(app));
const titles = (events: AuditEvent[], app: HomeLoanApplication = PRAKASH) =>
  auditTimeline(app, events).map((i) => i.title);

describe('a document that was uploaded in the record sheet', () => {
  it('is told once: the drawn upload of the same DocType is left out', () => {
    const app: HomeLoanApplication = {
      ...PRAKASH,
      documents: [
        ...PRAKASH.documents,
        {
          ...PRAKASH.documents[0],
          id: 'new-1',
          docType: 'Address Proof',
          fileName: 'Bill.pdf',
          uploadedAt: '2026-10-13T15:30:00+05:30',
        },
      ],
    };
    const events = [
      logged({ field: 'Address Proof', newValue: 'Bill.pdf (v1.0)', event: 'Document uploaded' }),
    ];
    const list = titles(events, app);
    expect(list.filter((t) => t === 'Document uploaded: Address Proof')).toHaveLength(1);
    // the others of the draft are still told by the draft itself, once
    expect(list.filter((t) => t === 'Document uploaded: PAN Card')).toHaveLength(1);
    expect(list.filter((t) => t.startsWith('Document uploaded'))).toHaveLength(4);
  });

  it('has no first upload drawn for it: it was missing before', () => {
    const events = [logged({ field: 'Address Proof', newValue: 'Bill.pdf (v1.0)' })];
    const out = withoutLoggedEvents(drawn(), events);
    expect(out.filter((e) => e.field === 'Address Proof')).toHaveLength(0);
  });
});

describe('a document that was replaced in the record sheet', () => {
  const replaced = logged({
    event: 'Document replaced',
    field: 'PAN Card',
    oldValue: 'PAN_Card_Prakash_Naik.pdf',
    newValue: 'PAN_Card_New.pdf (v1.1)',
    at: '2026-10-13T15:30:00+05:30',
  });
  const app: HomeLoanApplication = {
    ...PRAKASH,
    documents: PRAKASH.documents.map((d) =>
      d.docType === 'PAN Card'
        ? { ...d, fileName: 'PAN_Card_New.pdf', uploadedAt: '2026-10-13T15:30:00+05:30' }
        : d,
    ),
  };

  it('keeps the first upload of the old file, drawn a minute after the draft was created, and drops the drawn upload of the new one', () => {
    const items = auditTimeline(app, [replaced]);
    const uploads = items.filter((i) => i.title === 'Document uploaded: PAN Card');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].details).toEqual(['PAN_Card_Prakash_Naik.pdf']);
    expect(Date.parse(uploads[0].at)).toBe(Date.parse(PRAKASH.createdAt) + 60_000);
    const order = items.map((i) => i.title);
    // newest first: the replacement is above the upload of the file it replaced
    expect(order.indexOf('Document replaced: PAN Card')).toBeLessThan(
      order.indexOf('Document uploaded: PAN Card'),
    );
  });

  it('has the old file in the replaced line as old → new', () => {
    const item = auditTimeline(app, [replaced]).find(
      (i) => i.title === 'Document replaced: PAN Card',
    )!;
    expect(item.change).toEqual({
      from: 'PAN_Card_Prakash_Naik.pdf',
      to: 'PAN_Card_New.pdf (v1.1)',
    });
  });

  it('does not draw an upload that would be after the replacement', () => {
    const early = {
      ...replaced,
      at: new Date(Date.parse(PRAKASH.createdAt) + 5_000).toISOString(),
    };
    const out = withoutLoggedEvents(drawn(), [early]);
    const upload = out.find((e) => e.event === 'Document uploaded' && e.field === 'PAN Card')!;
    expect(Date.parse(upload.at)).toBeLessThan(Date.parse(early.at));
  });
});

describe('a document that was removed in the record sheet', () => {
  it('keeps its first upload, so the trail says it was there and then removed', () => {
    const app: HomeLoanApplication = {
      ...PRAKASH,
      documents: PRAKASH.documents.filter((d) => d.docType !== 'Photograph'),
    };
    const events = [
      logged({
        event: 'Document removed',
        field: 'Photograph',
        oldValue: 'Passport_Photo_Prakash_Naik.jpg',
      }),
    ];
    const list = auditTimeline(app, events);
    const upload = list.find((i) => i.title === 'Document uploaded: Photograph')!;
    expect(upload.details).toEqual(['Passport_Photo_Prakash_Naik.jpg']);
    expect(list.map((i) => i.title)).toContain('Document removed: Photograph');
  });
});

describe('a document that was removed and then uploaded again', () => {
  it('has its first upload, the removal and the new upload, each once', () => {
    const app: HomeLoanApplication = {
      ...PRAKASH,
      documents: PRAKASH.documents.map((d) =>
        d.docType === 'Photograph' ? { ...d, fileName: 'Again.jpg' } : d,
      ),
    };
    const events = [
      logged({
        event: 'Document removed',
        field: 'Photograph',
        oldValue: 'Passport_Photo_Prakash_Naik.jpg',
        at: '2026-10-13T15:30:00+05:30',
      }),
      logged({
        id: 'AE-90002',
        event: 'Document uploaded',
        field: 'Photograph',
        newValue: 'Again.jpg (v1.0)',
        at: '2026-10-13T15:31:00+05:30',
      }),
    ];
    const list = titles(events, app).filter((t) => /Photograph/.test(t));
    expect(list.sort()).toEqual(
      [
        'Document removed: Photograph',
        'Document uploaded: Photograph',
        'Document uploaded: Photograph',
      ].sort(),
    );
  });
});

describe('the consent ticked in the record sheet', () => {
  const app: HomeLoanApplication = {
    ...PRAKASH,
    consentGiven: true,
    consentTime: '2026-10-13T15:35:00+05:30',
  };
  const events = [
    logged({ event: 'Field changed', field: 'Consent', oldValue: 'No', newValue: 'Yes' }),
  ];

  it('is told once, as Consent given', () => {
    const list = titles(events, app);
    expect(list.filter((t) => t === 'Consent given')).toHaveLength(1);
    expect(list).not.toContain('Consent changed');
  });

  it('is told by the draft itself when nothing was logged', () => {
    expect(titles([], app).filter((t) => t === 'Consent given')).toHaveLength(1);
  });
});

describe('the checks of a draft', () => {
  const made: HomeLoanApplication = {
    ...PRAKASH,
    createdAt: '2026-10-13T15:20:00+05:30',
    consentGiven: true,
    consentTime: '2026-10-13T15:25:00+05:30',
    kycOverallResult: 'Pass',
    kycCheckedOn: '2026-10-13',
    documents: PRAKASH.documents.map((d) => ({ ...d, uploadedAt: '2026-10-13T15:22:00+05:30' })),
  };

  it('are never drawn before the draft was created, its files uploaded or the consent given', () => {
    expect(Date.parse(draftKycTime(made))).toBeGreaterThan(Date.parse(made.consentTime));
    const items = auditTimeline(made, []);
    const created = items.find((i) => i.title === 'Application created')!;
    const kyc = items.filter((i) => i.category === 'kyc');
    expect(kyc.length).toBeGreaterThan(0);
    for (const item of kyc) expect(Date.parse(item.at)).toBeGreaterThan(Date.parse(created.at));
  });

  it('keep their day and time (10:40) when the draft is older than that', () => {
    const old: HomeLoanApplication = {
      ...made,
      createdAt: '2026-10-10T09:00:00+05:30',
      consentTime: '2026-10-10T09:10:00+05:30',
      kycCheckedOn: '2026-10-10',
      documents: made.documents.map((d) => ({ ...d, uploadedAt: '2026-10-10T09:05:00+05:30' })),
    };
    expect(draftKycTime(old)).toBe(new Date('2026-10-10T10:40:00+05:30').toISOString());
  });
});

describe('a changed Aadhaar in the trail', () => {
  it('has no old → new line (the trail never holds the number) and says so', () => {
    const item = itemOf(
      logged({ event: 'Field changed', field: 'Aadhaar', oldValue: '', newValue: 'changed' }),
    );
    expect(item.title).toBe('Aadhaar changed');
    expect(item.change).toBeUndefined();
    expect(item.details).toEqual(['The number is kept masked and is not shown']);
  });

  it('is still called a change by the administrator, with its reason', () => {
    const item = itemOf(
      logged({
        event: 'Field changed',
        user: 'Admin',
        field: 'Aadhaar',
        newValue: 'changed',
        comment: 'Corrected after the applicant brought the card',
      }),
    );
    expect(item.title).toBe('Aadhaar changed by the administrator');
    expect(item.reason).toBe('Corrected after the applicant brought the card');
  });
});
