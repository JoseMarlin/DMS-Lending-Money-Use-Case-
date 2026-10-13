import {
  ageOn,
  applyCalculatedFields,
  computeCoApplicantRequired,
  computeEligibleAmount,
  createBlankApplication,
  documentId,
  nextApplicationId,
  revokePreviewUrls,
  requiredDocTypes,
  isBlankDraft,
  sanitizeApplication,
  toApplicationDocuments,
  toISODate,
  withoutBlobPreviews,
} from './application';

describe('computeEligibleAmount', () => {
  it('is 75% of the estimated cost for Construction of house', () => {
    expect(computeEligibleAmount('Construction of house', 2_600_000)).toBe(1_950_000);
    expect(computeEligibleAmount('Construction of house', 1_650_000)).toBe(1_237_500);
    expect(computeEligibleAmount('Construction of house', 1_400_000)).toBe(1_050_000);
  });

  it('is capped at 30,00,000', () => {
    expect(computeEligibleAmount('Construction of house', 5_000_000)).toBe(3_000_000);
  });

  it('is just the 30,00,000 cap for any other purpose, whatever the cost', () => {
    expect(computeEligibleAmount('Purchase of flat', 2_600_000)).toBe(3_000_000);
    expect(computeEligibleAmount('Purchase of plot', null)).toBe(3_000_000);
    expect(computeEligibleAmount('Takeover of housing loan', 100_000)).toBe(3_000_000);
    expect(computeEligibleAmount('Property mortgage', 0)).toBe(3_000_000);
  });

  it('is null until a purpose is chosen, and for Construction without a usable cost', () => {
    expect(computeEligibleAmount('', 2_600_000)).toBeNull();
    expect(computeEligibleAmount('', null)).toBeNull();
    expect(computeEligibleAmount('Construction of house', null)).toBeNull();
    expect(computeEligibleAmount('Construction of house', 0)).toBeNull();
  });
});

describe('ageOn', () => {
  it('counts whole years', () => {
    expect(ageOn('1984-03-14', '2026-10-08')).toBe(42);
  });

  it('does not count the birthday before it has happened', () => {
    expect(ageOn('1984-03-14', '2026-03-13')).toBe(41);
    expect(ageOn('1984-03-14', '2026-03-14')).toBe(42);
  });

  it('returns null for missing or invalid dates', () => {
    expect(ageOn('', '2026-10-08')).toBeNull();
    expect(ageOn('14/03/1984', '2026-10-08')).toBeNull();
  });
});

describe('computeCoApplicantRequired', () => {
  it('is Yes only when the applicant is above 60', () => {
    expect(computeCoApplicantRequired('1960-01-01', '2026-10-08')).toBe('Yes');
    expect(computeCoApplicantRequired('1966-10-08', '2026-10-08')).toBe('No'); // exactly 60
    expect(computeCoApplicantRequired('1984-03-14', '2026-10-08')).toBe('No');
    expect(computeCoApplicantRequired('', '2026-10-08')).toBe('No');
  });
});

describe('applyCalculatedFields: consent time', () => {
  const blank = createBlankApplication({ applicationId: 'x', branch: 'b', createdBy: 'u' });
  const t1 = new Date('2026-10-08T12:00:00.000Z');
  const t2 = new Date('2026-10-08T13:30:00.000Z');

  it('stamps the time when consent is ticked', () => {
    expect(applyCalculatedFields({ ...blank, consentGiven: true }, t1).consentTime).toBe(
      t1.toISOString(),
    );
  });

  it('keeps the first time while consent stays ticked', () => {
    const ticked = applyCalculatedFields({ ...blank, consentGiven: true }, t1);
    expect(applyCalculatedFields({ ...ticked, fullNameAsPerPan: 'x' }, t2).consentTime).toBe(
      t1.toISOString(),
    );
  });

  it('clears the time when consent is unticked, and stamps a new one when ticked again', () => {
    const ticked = applyCalculatedFields({ ...blank, consentGiven: true }, t1);
    const unticked = applyCalculatedFields({ ...ticked, consentGiven: false }, t2);
    expect(unticked.consentTime).toBe('');
    expect(applyCalculatedFields({ ...unticked, consentGiven: true }, t2).consentTime).toBe(
      t2.toISOString(),
    );
  });

  it('has no time while consent was never given', () => {
    expect(applyCalculatedFields(blank, t1).consentTime).toBe('');
  });
});

describe('document helpers', () => {
  const doc = (previewUrl?: string) => ({
    id: 'd',
    docType: 'PAN Card' as const,
    fileName: 'a.pdf',
    mimeType: 'application/pdf' as const,
    sizeBytes: 1,
    uploadedAt: '',
    uploadedBy: '',
    previewUrl,
  });

  it('documentId is stable for an application and DocType', () => {
    expect(documentId('HL-2026-0006', 'Aadhaar (Masked Copy)')).toBe(
      'HL-2026-0006-aadhaar-masked-copy',
    );
  });

  it('withoutBlobPreviews leaves out blob: links only', () => {
    const app = { documents: [doc('blob:abc'), doc('https://example.test/a.pdf'), doc()] };
    const saved = withoutBlobPreviews(app);
    expect(saved.documents[0]).not.toHaveProperty('previewUrl');
    expect(saved.documents[1].previewUrl).toBe('https://example.test/a.pdf');
    expect(saved.documents[2].previewUrl).toBeUndefined();
  });

  it('withoutBlobPreviews returns the same object when there is nothing to remove', () => {
    const app = { documents: [doc()] };
    expect(withoutBlobPreviews(app)).toBe(app);
  });

  it('revokePreviewUrls frees blob links that are not kept', () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: revoke }));
    revokePreviewUrls(
      [doc('blob:a'), doc('blob:b'), doc('https://x.test/a.pdf'), doc()],
      [doc('blob:b')],
    );
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:a');
    vi.unstubAllGlobals();
  });
});

describe('applyCalculatedFields: co-applicant toggle', () => {
  const blank = createBlankApplication({ applicationId: 'x', branch: 'b', createdBy: 'u' });

  it('forces the toggle on when the applicant is above 60', () => {
    const result = applyCalculatedFields({ ...blank, dateOfBirth: '1950-01-01' });
    expect(result.coApplicantRequired).toBe('Yes');
    expect(result.addCoApplicant).toBe(true);
  });

  it('leaves the toggle as the user set it otherwise', () => {
    expect(applyCalculatedFields({ ...blank, dateOfBirth: '1984-03-14' }).addCoApplicant).toBe(
      false,
    );
    expect(
      applyCalculatedFields({ ...blank, dateOfBirth: '1984-03-14', addCoApplicant: true })
        .addCoApplicant,
    ).toBe(true);
  });

  it('copes with a draft saved before the toggle existed', () => {
    const old = { ...blank } as Partial<typeof blank>;
    delete old.addCoApplicant;
    expect(applyCalculatedFields(old as typeof blank).addCoApplicant).toBe(false);
  });
});

describe('applyCalculatedFields', () => {
  it('recomputes eligible amount and co-applicant requirement', () => {
    const blank = createBlankApplication({
      applicationId: 'HL-2026-0001',
      branch: 'Belagavi Main Branch (demo)',
      createdBy: 'Priya Kulkarni',
    });
    const updated = applyCalculatedFields({
      ...blank,
      loanPurpose: 'Construction of house',
      estimatedCost: 2_600_000,
    });
    expect(updated.eligibleAmount).toBe(1_950_000);
    expect(updated.coApplicantRequired).toBe('No');
  });
});

describe('requiredDocTypes', () => {
  it('asks for the GST certificate only from Business and Professional applicants', () => {
    expect(requiredDocTypes('Business')).toHaveLength(13);
    expect(requiredDocTypes('Professional')).toHaveLength(13);
    expect(requiredDocTypes('Salaried')).toHaveLength(12);
    expect(requiredDocTypes('Salaried')).not.toContain('GST Certificate or Business Licence');
    expect(requiredDocTypes('')).not.toContain('GST Certificate or Business Licence');
  });
});

describe('nextApplicationId', () => {
  const now = new Date(2026, 9, 8);

  it('starts at 0001', () => {
    expect(nextApplicationId([], now)).toBe('HL-2026-0001');
  });

  it('adds one to the highest number in use', () => {
    expect(nextApplicationId(['HL-2026-0001', 'HL-2026-0005', 'HL-2026-0003'], now)).toBe(
      'HL-2026-0006',
    );
  });

  it('ignores ids that are not in the HL format', () => {
    expect(nextApplicationId(['draft', 'HL-2026-0002'], now)).toBe('HL-2026-0003');
  });
});

describe('createBlankApplication', () => {
  const now = new Date(2026, 9, 8, 14, 30);
  const blank = createBlankApplication({
    applicationId: 'HL-2026-0006',
    branch: 'Belagavi Main Branch (demo)',
    createdBy: 'Priya Kulkarni',
    now,
  });

  it('sets the auto fields', () => {
    expect(blank.applicationId).toBe('HL-2026-0006');
    expect(blank.applicationDate).toBe(toISODate(now));
    expect(blank.applicationDate).toBe('2026-10-08');
    expect(blank.loanProduct).toBe('Home Loan');
    expect(blank.status).toBe('Draft');
    expect(blank.consentGiven).toBe(false);
    expect(blank.consentTime).toBe('');
  });

  it('starts with the KYC checks pending and no result', () => {
    expect(blank.panStatus).toBe('Pending');
    expect(blank.aadhaarStatus).toBe('Pending');
    expect(blank.gstStatus).toBe('Pending');
    expect(blank.kycOverallResult).toBe('');
    expect(blank.retryCount).toBe(0);
  });

  it('has no documents and no Aadhaar', () => {
    expect(blank.documents).toEqual([]);
    expect(blank.aadhaar).toBe('');
  });
});

describe('sanitizeApplication', () => {
  const blank = createBlankApplication({ applicationId: 'x', branch: 'b', createdBy: 'u' });

  it('masks a full Aadhaar number', () => {
    expect(sanitizeApplication({ ...blank, aadhaar: '234500074821' }).aadhaar).toBe(
      'XXXX XXXX 4821',
    );
  });

  it('hides a full number typed into a free-text field or a file name', () => {
    const doc = {
      id: 'd1',
      docType: 'PAN Card',
      fileName: 'aadhaar_234500074821.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      uploadedAt: '',
      uploadedBy: '',
    } as const;
    const clean = sanitizeApplication({
      ...blank,
      address: 'Plot 21, aadhaar 2345 0007 4821, Belagavi',
      kycExceptionRemark: 'number is 234500074821',
      documents: [doc, { ...doc, id: 'd2', fileName: 'PAN_Card.pdf' }],
    });
    expect(clean.address).toBe('Plot 21, aadhaar XXXX XXXX 4821, Belagavi');
    expect(clean.kycExceptionRemark).toBe('number is XXXX XXXX 4821');
    expect(clean.documents[0].fileName).toBe('aadhaar_XXXX XXXX 4821.pdf');
    expect(clean.documents[1].fileName).toBe('PAN_Card.pdf');
    expect(JSON.stringify(clean)).not.toMatch(/\d{12}|\d{4} \d{4} \d{4}/);
  });

  it('hides a full number typed into the email, the contact numbers and the identity fields too', () => {
    const clean = sanitizeApplication({
      ...blank,
      email: '234500074821@example.com',
      mobile: '2345 0007 4821',
      pinCode: '234500074821',
      pan: '234500074821',
      gstin: '234500074821',
      surety1Mobile: '234500074821',
      surety1Pan: '2345 0007 4821',
      surety2Mobile: '234500074821',
      surety2Pan: '234500074821',
    });
    expect(JSON.stringify(clean)).not.toMatch(/\d{12}|\d{4} \d{4} \d{4}/);
    expect(clean.email).toBe('XXXX XXXX 4821@example.com');
  });

  it('leaves a real mobile number, PIN code and PAN alone', () => {
    const plain = { ...blank, mobile: '9000000001', pinCode: '590001', pan: 'ABCPK2101L' };
    expect(sanitizeApplication(plain)).toBe(plain);
  });

  it('returns the same object when the free text has nothing to hide', () => {
    const plain = { ...blank, address: 'Plot 21, Shivaji Nagar, PIN 590001' };
    expect(sanitizeApplication(plain)).toBe(plain);
  });

  it('leaves a masked or empty value alone and returns the same object', () => {
    const masked = { ...blank, aadhaar: 'XXXX XXXX 4821' };
    expect(sanitizeApplication(masked)).toBe(masked);
    expect(sanitizeApplication(blank)).toBe(blank);
  });
});

describe('toApplicationDocuments', () => {
  it('tags each file with its DocType and gives it a stable id', () => {
    const docs = toApplicationDocuments(
      'HL-2026-0006',
      [
        {
          docType: 'PAN Card',
          fileName: 'pan-card.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
        },
      ],
      'Priya Kulkarni',
      '2026-10-08T10:00:00.000Z',
    );
    expect(docs).toEqual([
      {
        id: 'HL-2026-0006-pan-card',
        docType: 'PAN Card',
        fileName: 'pan-card.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        uploadedBy: 'Priya Kulkarni',
        uploadedAt: '2026-10-08T10:00:00.000Z',
      },
    ]);
  });
});

describe('isBlankDraft', () => {
  const blank = createBlankApplication({ applicationId: 'x', branch: 'b', createdBy: 'u' });

  it('is true for a new application', () => {
    expect(isBlankDraft(blank)).toBe(true);
  });

  it('is not moved by what the system sets', () => {
    expect(isBlankDraft({ ...blank, applicationId: 'HL-2026-0099', status: 'KYC Done' })).toBe(
      true,
    );
  });

  it.each([
    ['a name', { fullNameAsPerPan: 'A' }],
    ['a mobile', { mobile: '9' }],
    ['a loan amount', { loanAmountRequested: 100 }],
    ['a purpose', { loanPurpose: 'Purchase of flat' as const }],
    ['a surety', { surety2Pan: 'X' }],
    ['the co-applicant switch', { addCoApplicant: true }],
    ['the consent', { consentGiven: true }],
  ])('is false once %s is entered', (_label, patch) => {
    expect(isBlankDraft({ ...blank, ...patch })).toBe(false);
  });

  it('is false once a document is attached', () => {
    const doc = {
      id: 'd',
      docType: 'PAN Card' as const,
      fileName: 'a.pdf',
      mimeType: 'application/pdf' as const,
      sizeBytes: 1,
      uploadedAt: '',
      uploadedBy: '',
    };
    expect(isBlankDraft({ ...blank, documents: [doc] })).toBe(false);
  });
});
