import { applicationDocuments } from './attachments';
import {
  documentChanges,
  editAccess,
  needsReason,
  saveRecordEdit,
  type KycRerun,
} from './recordEdit';
import { SEED_APPLICATIONS } from './seed';
import { useAppStore } from './store';
import { ApplicationStatus, type DemoUser, type HomeLoanApplication } from './types';
import { DEMO_USERS } from './users';
import type { WorkflowData } from './workflow';

const [VIJAY, SHOBHA, MANJUNATH, SAVITA, BASAVARAJ] = SEED_APPLICATIONS;
const NOW = new Date('2026-10-12T10:00:00Z');
const FULL_AADHAAR = /\d{4}\s?\d{4}\s?\d{4}/;

const data = (): WorkflowData => {
  const s = useAppStore.getState();
  return {
    applications: s.applications,
    masterRecords: s.masterRecords,
    workflowInstances: s.workflowInstances,
    auditEvents: s.auditEvents,
    notifications: s.notifications,
  };
};

/** The seed records as they are in the store: the approved one also has its master record. */
const withMaster = (d: WorkflowData): WorkflowData => ({
  ...d,
  masterRecords: [d.applications.find((a) => a.applicationId === VIJAY.applicationId)!],
});

const as = (status: ApplicationStatus, over: Partial<HomeLoanApplication> = {}) =>
  ({ ...SAVITA, status, ...over }) as HomeLoanApplication;

beforeEach(() => {
  localStorage.clear();
  useAppStore.getState().resetDemo();
});

describe('editAccess', () => {
  const priya = DEMO_USERS.priya; // the loan officer who owns the seed records of Belagavi
  const otherOfficer: DemoUser = { ...priya, id: 'priya', name: 'Another Officer' };

  it('lets the owning loan officer and the administrator edit a Draft, a KYC Done draft and a Returned record', () => {
    for (const status of [
      ApplicationStatus.Draft,
      ApplicationStatus.KycDone,
      ApplicationStatus.Returned,
    ]) {
      expect(editAccess(as(status), priya)).toEqual({ allowed: true, reason: null });
      expect(editAccess(as(status), DEMO_USERS.admin)).toEqual({ allowed: true, reason: null });
    }
  });

  it('does not let another loan officer, or an approver, edit a Draft or a Returned record', () => {
    for (const status of [ApplicationStatus.Draft, ApplicationStatus.Returned]) {
      for (const who of [otherOfficer, DEMO_USERS.mahesh, DEMO_USERS.sunita]) {
        const access = editAccess(as(status), who);
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe(
          'Only the loan officer who owns this record, or the administrator, can edit it',
        );
      }
    }
  });

  it('lets only the administrator edit an approved record', () => {
    expect(editAccess(as(ApplicationStatus.Approved), DEMO_USERS.admin).allowed).toBe(true);
    for (const who of [priya, DEMO_USERS.mahesh, DEMO_USERS.sunita]) {
      expect(editAccess(as(ApplicationStatus.Approved), who)).toEqual({
        allowed: false,
        reason: 'Only the administrator can edit an approved record',
      });
    }
  });

  it('locks a record while it is in approval, for everybody, the administrator too', () => {
    for (const status of [
      ApplicationStatus.Submitted,
      ApplicationStatus.InLevel1,
      ApplicationStatus.InLevel2,
    ]) {
      for (const who of Object.values(DEMO_USERS)) {
        expect(editAccess(as(status), who)).toEqual({
          allowed: false,
          reason: 'Locked while in approval',
        });
      }
    }
  });

  it('does not let anybody edit a rejected record', () => {
    for (const who of Object.values(DEMO_USERS)) {
      expect(editAccess(as(ApplicationStatus.Rejected), who)).toEqual({
        allowed: false,
        reason: 'Rejected records cannot be edited',
      });
    }
  });

  it('covers every status', () => {
    for (const status of Object.values(ApplicationStatus)) {
      expect(typeof editAccess(as(status), DEMO_USERS.admin).allowed).toBe('boolean');
    }
  });

  it('needs a reason for an approved record only', () => {
    expect(needsReason({ status: ApplicationStatus.Approved })).toBe(true);
    for (const status of Object.values(ApplicationStatus).filter((s) => s !== 'Approved')) {
      expect(needsReason({ status })).toBe(false);
    }
  });
});

describe('documentChanges', () => {
  const formDocs = applicationDocuments(SAVITA.documents);

  it('finds nothing when the documents are as they were', () => {
    expect(documentChanges(SAVITA.documents, structuredClone(SAVITA.documents))).toEqual([]);
  });

  it('finds a document uploaded where there was none, one replaced by another file or version, and one removed', () => {
    const [pan, aadhaar, ...rest] = formDocs;
    // before: no Aadhaar copy. now: a PAN Card at the next version, an Aadhaar copy, and one document gone
    const before = [pan, ...rest];
    const after = [{ ...pan, fileName: 'PAN_new.pdf', version: 'v1.1' }, aadhaar, ...rest.slice(1)];
    expect(documentChanges(before, after)).toEqual([
      {
        kind: 'replaced',
        docType: 'PAN Card',
        fileName: 'PAN_new.pdf',
        oldFileName: pan.fileName,
        version: 'v1.1',
      },
      {
        kind: 'uploaded',
        docType: aadhaar.docType,
        fileName: aadhaar.fileName,
        oldFileName: '',
        version: aadhaar.version ?? 'v1.0',
      },
      {
        kind: 'removed',
        docType: rest[0].docType,
        fileName: rest[0].fileName,
        oldFileName: '',
        version: rest[0].version ?? 'v1.0',
      },
    ]);
  });

  it('does not compare the attachments: they are added and removed on their own', () => {
    const withoutAttachment = applicationDocuments(SAVITA.documents);
    expect(documentChanges(SAVITA.documents, withoutAttachment)).toEqual([]);
    expect(documentChanges(withoutAttachment, SAVITA.documents)).toEqual([]);
  });
});

describe('saveRecordEdit', () => {
  const change = (label: string, oldValue: string, newValue: string) => ({
    label,
    oldValue,
    newValue,
  });

  it('replaces the record, and writes an event for each field that changed', () => {
    const d = data();
    const edited = { ...SAVITA, mobile: '9000000001', email: 'savita.new@example.com' };
    const outcome = saveRecordEdit(d, {
      applicationId: SAVITA.applicationId,
      edited,
      changes: [
        change('Mobile', SAVITA.mobile, '9000000001'),
        change('Email', SAVITA.email, 'savita.new@example.com'),
      ],
      user: DEMO_USERS.priya,
      now: NOW,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    const saved = outcome.data.applications.find((a) => a.applicationId === SAVITA.applicationId)!;
    expect(saved.mobile).toBe('9000000001');
    expect(saved.updatedAt).toBe(NOW.toISOString());
    const added = outcome.data.auditEvents.slice(d.auditEvents.length);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({
      applicationId: SAVITA.applicationId,
      event: 'Field changed',
      user: 'Priya Kulkarni',
      at: NOW.toISOString(),
      field: 'Mobile',
      oldValue: SAVITA.mobile,
      newValue: '9000000001',
      comment: '',
    });
    expect(added[1]).toMatchObject({ field: 'Email', newValue: 'savita.new@example.com' });
    expect(new Set(added.map((e) => e.id)).size).toBe(2);
  });

  it('changes no other application', () => {
    const d = data();
    const outcome = saveRecordEdit(d, {
      applicationId: SAVITA.applicationId,
      edited: { ...SAVITA, mobile: '9000000001' },
      changes: [change('Mobile', 'x', 'y')],
      user: DEMO_USERS.priya,
      now: NOW,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    for (const other of d.applications.filter((a) => a.applicationId !== SAVITA.applicationId)) {
      expect(
        outcome.data.applications.find((a) => a.applicationId === other.applicationId),
      ).toEqual(other);
    }
    expect(outcome.data.workflowInstances).toEqual(d.workflowInstances);
  });

  it('keeps what the sheet never edits: the ID, the date, the creator, the approvals, the status', () => {
    const d = data();
    const tampered = {
      ...SAVITA,
      applicationId: 'HL-2026-9999',
      applicationDate: '2000-01-01',
      createdBy: 'Somebody Else',
      level1Decision: 'Approved' as const,
      level1Approver: 'Nobody',
      sanctionedAmount: 5,
      status: ApplicationStatus.Approved,
      mobile: '9000000001',
    };
    const outcome = saveRecordEdit(d, {
      applicationId: SAVITA.applicationId,
      edited: tampered,
      changes: [change('Mobile', 'x', 'y')],
      user: DEMO_USERS.priya,
      now: NOW,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    const saved = outcome.application;
    expect(saved).toMatchObject({
      applicationId: SAVITA.applicationId,
      applicationDate: SAVITA.applicationDate,
      createdBy: SAVITA.createdBy,
      createdAt: SAVITA.createdAt,
      level1Decision: SAVITA.level1Decision,
      level1Approver: SAVITA.level1Approver,
      level1Remarks: SAVITA.level1Remarks,
      sanctionedAmount: SAVITA.sanctionedAmount,
      status: ApplicationStatus.Returned,
    });
    // the working copy had the documents as they were: the 12 of the form and the 1 attachment
    expect(saved.documents).toEqual(SAVITA.documents);
  });

  describe('the documents of the sheet', () => {
    const formDocs = applicationDocuments(SAVITA.documents);
    const attachments = SAVITA.documents.filter((d) => d.docType === 'Supporting Document');
    const [pan, , photograph] = formDocs;
    // the working copy: the PAN Card replaced by its next version, the Photograph removed, and an
    // attachment that was never in the store (the sheet adds attachments on their own, so it is not kept)
    const working = (): HomeLoanApplication => ({
      ...SAVITA,
      documents: [
        { ...pan, fileName: 'PAN_new.pdf', version: 'v1.1' },
        ...formDocs.filter((d) => d !== pan && d !== photograph),
        { ...attachments[0], id: 'HL-2026-0004-supporting-document-9', fileName: 'Stray.pdf' },
      ],
    });

    it('takes the documents of the form from the working copy, and the attachments from the store', () => {
      const outcome = saveRecordEdit(data(), {
        applicationId: SAVITA.applicationId,
        edited: working(),
        changes: [],
        documentChanges: documentChanges(SAVITA.documents, working().documents),
        user: DEMO_USERS.priya,
        now: NOW,
      });
      if (!outcome.ok) throw new Error(outcome.error);
      const saved = outcome.application.documents;
      expect(applicationDocuments(saved)).toEqual(applicationDocuments(working().documents));
      expect(applicationDocuments(saved)).toHaveLength(formDocs.length - 1);
      expect(saved.filter((d) => d.docType === 'Supporting Document')).toEqual(attachments);
      expect(saved.at(-1)?.fileName).toBe(attachments[0].fileName);
    });

    it('writes an event for a document replaced and one removed, with the file names and the version', () => {
      const d = data();
      const outcome = saveRecordEdit(d, {
        applicationId: SAVITA.applicationId,
        edited: working(),
        changes: [],
        documentChanges: documentChanges(SAVITA.documents, working().documents),
        user: DEMO_USERS.priya,
        now: NOW,
      });
      if (!outcome.ok) throw new Error(outcome.error);
      const added = outcome.data.auditEvents.slice(d.auditEvents.length);
      expect(added.map((e) => e.event)).toEqual(['Document replaced', 'Document removed']);
      expect(added[0]).toMatchObject({
        applicationId: SAVITA.applicationId,
        user: 'Priya Kulkarni',
        field: 'PAN Card',
        oldValue: pan.fileName,
        newValue: 'PAN_new.pdf (v1.1)',
      });
      expect(added[1]).toMatchObject({
        field: 'Photograph',
        oldValue: photograph.fileName,
        newValue: '',
      });
      expect(outcome.documentChanges).toHaveLength(2);
    });
  });

  it('works out the Eligible Amount and the other calculated fields again', () => {
    const d = data();
    const outcome = saveRecordEdit(d, {
      applicationId: SAVITA.applicationId,
      edited: { ...SAVITA, estimatedCost: 2_000_000, eligibleAmount: 1 },
      changes: [change('Estimated Cost', 'a', 'b')],
      user: DEMO_USERS.priya,
      now: NOW,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.application.eligibleAmount).toBe(1_500_000); // 75% of 20,00,000
  });

  it('writes no event when nothing changed, and still saves', () => {
    const d = data();
    const outcome = saveRecordEdit(d, {
      applicationId: SAVITA.applicationId,
      edited: SAVITA,
      changes: [],
      user: DEMO_USERS.priya,
      now: NOW,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.data.auditEvents).toEqual(d.auditEvents);
  });

  it('says "changed" for an Aadhaar and never writes a number, whatever was given', () => {
    const d = data();
    const outcome = saveRecordEdit(d, {
      applicationId: SAVITA.applicationId,
      edited: { ...SAVITA, aadhaar: 'XXXX XXXX 1234' },
      changes: [
        change('Aadhaar', '', 'changed'),
        // even a number that got into a text field is masked on its way into the trail
        change('Address', 'Plot 2345 6789 0123', 'Plot 2345 6789 0124'),
      ],
      reason: 'Corrected: 2345 6789 0125',
      user: DEMO_USERS.priya,
      now: NOW,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    const added = outcome.data.auditEvents.slice(d.auditEvents.length);
    expect(added[0]).toMatchObject({ field: 'Aadhaar', oldValue: '', newValue: 'changed' });
    expect(JSON.stringify(added)).not.toMatch(FULL_AADHAAR);
    expect(added[1].oldValue).toBe('Plot XXXX XXXX 0123');
    expect(added[1].comment).toBe('Corrected: XXXX XXXX 0125');
  });

  describe('an approved record', () => {
    it('needs a reason, and the administrator', () => {
      const d = withMaster(data());
      const base = {
        applicationId: VIJAY.applicationId,
        edited: { ...VIJAY, mobile: '9000000001' },
        changes: [change('Mobile', 'x', 'y')],
        now: NOW,
      };
      expect(saveRecordEdit(d, { ...base, user: DEMO_USERS.admin })).toMatchObject({
        ok: false,
        code: 'reason-required',
      });
      expect(saveRecordEdit(d, { ...base, reason: '   ', user: DEMO_USERS.admin })).toMatchObject({
        ok: false,
        code: 'reason-required',
      });
      expect(saveRecordEdit(d, { ...base, reason: 'Fix', user: DEMO_USERS.priya })).toMatchObject({
        ok: false,
        code: 'not-allowed',
      });
    });

    describe('and the sanctioned amount', () => {
      // Vijay: cost 28,00,000 (Eligible Amount 21,00,000) and a sanction of 20,00,000
      const edit = (estimatedCost: number, loanAmountRequested = VIJAY.loanAmountRequested) =>
        saveRecordEdit(withMaster(data()), {
          applicationId: VIJAY.applicationId,
          edited: { ...VIJAY, estimatedCost, loanAmountRequested },
          changes: [change('Estimated Cost', 'x', 'y')],
          reason: 'Valuation was revised',
          user: DEMO_USERS.admin,
          now: NOW,
        });

      it('is above the new Eligible Amount after the cost is lowered: refused, with both amounts in the message', () => {
        const outcome = edit(2_000_000, 1_500_000); // Eligible Amount 15,00,000
        expect(outcome).toMatchObject({ ok: false, code: 'sanction-over-eligible' });
        if (outcome.ok) return;
        expect(outcome.error).toContain('20,00,000');
        expect(outcome.error).toContain('15,00,000');
      });

      it('is within it after the cost is raised, or lowered a little: saved', () => {
        expect(edit(3_000_000).ok).toBe(true);
        // 75% of 26,70,000 is 20,02,500, just above the sanction
        expect(edit(2_670_000).ok).toBe(true);
      });

      it('is exactly the Eligible Amount: saved', () => {
        // 75% of 26,66,667 rounds to 20,00,000 or just above: use the amount that gives it exactly
        const cost = Math.ceil(VIJAY.sanctionedAmount! / 0.75);
        expect(edit(cost).ok).toBe(true);
      });

      it('leaves the data alone when it refuses', () => {
        const d = withMaster(data());
        const copy = structuredClone(d);
        edit(2_000_000, 1_500_000);
        expect(d).toEqual(copy);
      });

      it('does not matter for a record that has no sanction (a Returned one)', () => {
        const outcome = saveRecordEdit(data(), {
          applicationId: SAVITA.applicationId,
          edited: { ...SAVITA, estimatedCost: 1_000_000 },
          changes: [change('Estimated Cost', 'x', 'y')],
          user: DEMO_USERS.priya,
          now: NOW,
        });
        expect(outcome.ok).toBe(true);
      });
    });

    it('replaces the master record too, and writes the reason with each change', () => {
      const d = withMaster(data());
      const outcome = saveRecordEdit(d, {
        applicationId: VIJAY.applicationId,
        edited: { ...VIJAY, mobile: '9000000001' },
        changes: [change('Mobile', VIJAY.mobile, '9000000001')],
        reason: '  Number was wrong on the form  ',
        user: DEMO_USERS.admin,
        now: NOW,
      });
      if (!outcome.ok) throw new Error(outcome.error);
      expect(outcome.data.masterRecords).toHaveLength(1);
      expect(outcome.data.masterRecords[0].mobile).toBe('9000000001');
      expect(
        outcome.data.applications.find((a) => a.applicationId === VIJAY.applicationId)?.mobile,
      ).toBe('9000000001');
      const added = outcome.data.auditEvents.slice(d.auditEvents.length);
      expect(added[0]).toMatchObject({ user: 'Admin', comment: 'Number was wrong on the form' });
      // the approval, the sanction and the filing stay as they were
      expect(outcome.application).toMatchObject({
        status: ApplicationStatus.Approved,
        sanctionedAmount: VIJAY.sanctionedAmount,
        level2Decision: 'Approved',
      });
      expect(outcome.application.documents).toEqual(VIJAY.documents);
    });
  });

  describe('who may save', () => {
    it("refuses a record that is in approval, rejected, or not the user's own", () => {
      const d = data();
      const base = { edited: SHOBHA, changes: [], now: NOW };
      expect(
        saveRecordEdit(d, { ...base, applicationId: SHOBHA.applicationId, user: DEMO_USERS.admin }),
      ).toMatchObject({ ok: false, code: 'not-allowed', error: 'Locked while in approval' });
      expect(
        saveRecordEdit(d, {
          ...base,
          applicationId: BASAVARAJ.applicationId,
          edited: BASAVARAJ,
          user: DEMO_USERS.admin,
        }),
      ).toMatchObject({ ok: false, error: 'Rejected records cannot be edited' });
      expect(
        saveRecordEdit(d, {
          ...base,
          applicationId: SAVITA.applicationId,
          edited: SAVITA,
          user: DEMO_USERS.mahesh,
        }),
      ).toMatchObject({ ok: false, code: 'not-allowed' });
      expect(
        saveRecordEdit(d, {
          ...base,
          applicationId: MANJUNATH.applicationId,
          edited: MANJUNATH,
          user: DEMO_USERS.priya,
        }),
      ).toMatchObject({ ok: false, code: 'not-allowed' });
    });

    it('refuses an application that is not there', () => {
      expect(
        saveRecordEdit(data(), {
          applicationId: 'HL-2026-0099',
          edited: SAVITA,
          changes: [],
          user: DEMO_USERS.admin,
          now: NOW,
        }),
      ).toMatchObject({ ok: false, code: 'not-found' });
    });
  });

  describe('when the KYC checks were run again', () => {
    const rerun = (over: Partial<KycRerun> = {}): KycRerun => ({
      patch: {
        panStatus: 'Verified',
        panNameAsPerSource: 'SAVITA PATIL',
        aadhaarStatus: 'Verified',
        aadhaarReference: 'MOCK-AAD-00001',
        gstStatus: 'Not applicable',
        nameMatchPercent: 100,
        dateOfBirthMatch: 'Exact',
        kycOverallResult: 'Pass',
        kycCheckedOn: '2026-10-12',
      },
      result: 'Pass',
      remark: '',
      references: [
        { source: 'PAN', status: 'Verified', reference: 'MOCK-PAN-00004' },
        { source: 'Aadhaar', status: 'Verified', reference: 'MOCK-AAD-00001' },
      ],
      ...over,
    });
    const save = (
      kyc: KycRerun,
      status: ApplicationStatus = ApplicationStatus.Returned,
      user = DEMO_USERS.priya,
    ) => {
      const d = data();
      const source = as(status);
      const base: WorkflowData = {
        ...d,
        applications: d.applications.map((a) =>
          a.applicationId === SAVITA.applicationId ? source : a,
        ),
      };
      return {
        base,
        outcome: saveRecordEdit(base, {
          applicationId: SAVITA.applicationId,
          edited: { ...source, pan: 'ABCPT5505R' },
          changes: [change('PAN', source.pan, 'ABCPT5505R')],
          kyc,
          user,
          now: NOW,
        }),
      };
    };

    it('writes the new result on the record and the KYC events in the trail', () => {
      const { base, outcome } = save(rerun());
      if (!outcome.ok) throw new Error(outcome.error);
      expect(outcome.application).toMatchObject({
        kycOverallResult: 'Pass',
        panNameAsPerSource: 'SAVITA PATIL',
        kycCheckedOn: '2026-10-12',
      });
      const added = outcome.data.auditEvents.slice(base.auditEvents.length);
      expect(added.map((e) => `${e.event}:${e.field}`)).toEqual([
        'Field changed:PAN',
        'KYC check run:PAN',
        'KYC check run:Aadhaar',
        'KYC result set:KYC Overall Result',
      ]);
      expect(added[1]).toMatchObject({
        user: 'System',
        newValue: 'Verified',
        reference: 'MOCK-PAN-00004',
      });
      expect(added[3]).toMatchObject({ newValue: 'Pass', user: 'System' });
    });

    it('refuses a Fail', () => {
      const { outcome } = save(rerun({ result: 'Fail' }));
      expect(outcome).toMatchObject({ ok: false, code: 'kyc-blocked' });
    });

    it('refuses an Exception with no remark, and writes the remark when there is one', () => {
      expect(save(rerun({ result: 'Exception', remark: '  ' })).outcome).toMatchObject({
        ok: false,
        code: 'kyc-blocked',
      });
      const { base, outcome } = save(
        rerun({
          result: 'Exception',
          remark: 'The middle initial is missing',
          patch: { kycOverallResult: 'Exception', nameMatchPercent: 86 },
        }),
      );
      if (!outcome.ok) throw new Error(outcome.error);
      expect(outcome.application.kycExceptionRemark).toBe('The middle initial is missing');
      const result = outcome.data.auditEvents.slice(base.auditEvents.length).at(-1);
      expect(result).toMatchObject({
        event: 'KYC result set',
        newValue: 'Exception',
        comment: 'The middle initial is missing',
      });
    });

    it('masks an Aadhaar number typed into the remark, in the record and in the trail', () => {
      const { base, outcome } = save(
        rerun({
          result: 'Exception',
          remark: 'Verified by Aadhaar 2345 6789 0123 in person',
          patch: { kycOverallResult: 'Exception', nameMatchPercent: 86 },
        }),
      );
      if (!outcome.ok) throw new Error(outcome.error);
      expect(outcome.application.kycExceptionRemark).toBe(
        'Verified by Aadhaar XXXX XXXX 0123 in person',
      );
      const added = outcome.data.auditEvents.slice(base.auditEvents.length);
      expect(added.at(-1)?.comment).toBe('Verified by Aadhaar XXXX XXXX 0123 in person');
      expect(JSON.stringify(added)).not.toMatch(FULL_AADHAAR);
    });

    it('makes a draft that has passed the checks "KYC Done", and leaves any other status as it is', () => {
      expect(save(rerun(), ApplicationStatus.Draft).outcome).toMatchObject({
        ok: true,
        application: { status: ApplicationStatus.KycDone },
      });
      expect(save(rerun(), ApplicationStatus.KycDone).outcome).toMatchObject({
        ok: true,
        application: { status: ApplicationStatus.KycDone },
      });
      expect(save(rerun(), ApplicationStatus.Returned).outcome).toMatchObject({
        ok: true,
        application: { status: ApplicationStatus.Returned },
      });
    });
  });

  it('adds the application to the working list if it is only a master record', () => {
    const d = data();
    const onlyMaster: WorkflowData = {
      ...d,
      applications: d.applications.filter((a) => a.applicationId !== VIJAY.applicationId),
      masterRecords: [VIJAY],
    };
    const outcome = saveRecordEdit(onlyMaster, {
      applicationId: VIJAY.applicationId,
      edited: { ...VIJAY, mobile: '9000000001' },
      changes: [change('Mobile', 'x', 'y')],
      reason: 'Fix',
      user: DEMO_USERS.admin,
      now: NOW,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.data.applications.some((a) => a.applicationId === VIJAY.applicationId)).toBe(
      true,
    );
    expect(outcome.data.masterRecords[0].mobile).toBe('9000000001');
  });

  it('changes nothing in the data it was given', () => {
    const d = withMaster(data());
    const snapshot = JSON.stringify(d);
    saveRecordEdit(d, {
      applicationId: VIJAY.applicationId,
      edited: { ...VIJAY, mobile: '9000000001' },
      changes: [change('Mobile', 'x', 'y')],
      reason: 'Fix',
      user: DEMO_USERS.admin,
      now: NOW,
    });
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});

describe('the store action saveRecordEdit', () => {
  it('writes the record and the trail, and persists them', () => {
    const state = useAppStore.getState();
    const outcome = state.saveRecordEdit({
      applicationId: SAVITA.applicationId,
      edited: { ...SAVITA, mobile: '9000000001' },
      changes: [{ label: 'Mobile', oldValue: SAVITA.mobile, newValue: '9000000001' }],
      user: DEMO_USERS.priya,
    });
    expect(outcome.ok).toBe(true);
    expect(
      useAppStore.getState().applications.find((a) => a.applicationId === SAVITA.applicationId)
        ?.mobile,
    ).toBe('9000000001');
    const saved = JSON.parse(localStorage.getItem('dms-home-loan-demo')!).state;
    expect(
      saved.applications.find((a: HomeLoanApplication) => a.applicationId === SAVITA.applicationId)
        .mobile,
    ).toBe('9000000001');
    expect(saved.auditEvents.at(-1)).toMatchObject({ event: 'Field changed', field: 'Mobile' });
  });

  it('writes nothing when it refuses', () => {
    const before = JSON.stringify(useAppStore.getState().applications);
    const outcome = useAppStore.getState().saveRecordEdit({
      applicationId: SHOBHA.applicationId,
      edited: { ...SHOBHA, mobile: '9000000001' },
      changes: [{ label: 'Mobile', oldValue: 'a', newValue: 'b' }],
      user: DEMO_USERS.admin,
    });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(useAppStore.getState().applications)).toBe(before);
  });

  it('follows into the form when the record that was edited is the one in the form', () => {
    const state = useAppStore.getState();
    state.updateDraft({ fullNameAsPerPan: 'Ramesh Patil', mobile: '9000000000' });
    state.saveApplication({ ...useAppStore.getState().draft, status: ApplicationStatus.Draft });
    const draft = useAppStore.getState().draft;
    const before = useAppStore.getState().draftResetCount;
    const outcome = useAppStore.getState().saveRecordEdit({
      applicationId: draft.applicationId,
      edited: { ...draft, mobile: '9000000002' },
      changes: [{ label: 'Mobile', oldValue: '9000000000', newValue: '9000000002' }],
      user: DEMO_USERS.priya,
    });
    expect(outcome.ok).toBe(true);
    expect(useAppStore.getState().draft.mobile).toBe('9000000002');
    // the form loads its inputs again
    expect(useAppStore.getState().draftResetCount).toBe(before + 1);
  });

  it('leaves the form alone when another record was edited', () => {
    const before = useAppStore.getState().draftResetCount;
    useAppStore.getState().saveRecordEdit({
      applicationId: SAVITA.applicationId,
      edited: { ...SAVITA, mobile: '9000000001' },
      changes: [{ label: 'Mobile', oldValue: 'a', newValue: 'b' }],
      user: DEMO_USERS.priya,
    });
    expect(useAppStore.getState().draftResetCount).toBe(before);
  });
});
