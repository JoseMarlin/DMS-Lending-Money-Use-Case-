/**
 * Editing a record from the record sheet, as plain functions (no React, no store): who may edit a
 * record in which status, and what saving an edit does to the data: the application is replaced, an
 * audit event is written for each field that changed, and the KYC events when the checks were run
 * again. The Aadhaar number never reaches an event: a changed Aadhaar is written as "changed".
 */
import { maskAadhaarInText } from './aadhaar';
import { applyCalculatedFields, sanitizeApplication } from './application';
import { applicationDocuments, attachmentsOf } from './attachments';
import { formatIndianNumber } from '@/lib/format';
import {
  ApplicationStatus,
  type ApplicationDocument,
  type DemoUser,
  type HomeLoanApplication,
} from './types';
import { withEventIds, type WorkflowData } from './workflow';

// ---------------------------------------------------------------------------
// Who may edit
// ---------------------------------------------------------------------------

export interface EditAccess {
  allowed: boolean;
  /** Why not (shown in the tip of the disabled Edit button); null when it is allowed */
  reason: string | null;
}

/**
 * Draft and Returned: the loan officer who owns the record, and the administrator. Approved: the
 * administrator only. While in approval, and when rejected: nobody.
 */
export function editAccess(application: HomeLoanApplication, user: DemoUser): EditAccess {
  const yes: EditAccess = { allowed: true, reason: null };
  const no = (reason: string): EditAccess => ({ allowed: false, reason });
  switch (application.status) {
    case ApplicationStatus.Submitted:
    case ApplicationStatus.InLevel1:
    case ApplicationStatus.InLevel2:
      return no('Locked while in approval');
    case ApplicationStatus.Rejected:
      return no('Rejected records cannot be edited');
    case ApplicationStatus.Approved:
      return user.role === 'admin' ? yes : no('Only the administrator can edit an approved record');
    case ApplicationStatus.Draft:
    case ApplicationStatus.KycDone:
    case ApplicationStatus.Returned:
      return user.role === 'admin' ||
        (user.role === 'loanOfficer' && user.name === application.createdBy)
        ? yes
        : no('Only the loan officer who owns this record, or the administrator, can edit it');
  }
}

/** True when saving an edit of this record needs a reason for the change (an approved record). */
export const needsReason = (application: Pick<HomeLoanApplication, 'status'>) =>
  application.status === ApplicationStatus.Approved;

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/** One field that was changed: its label and what it was and became, as text. */
export interface FieldChange {
  label: string;
  oldValue: string;
  newValue: string;
}

/** A document of the form that was uploaded, replaced or removed in the sheet: one event of the trail. */
export interface DocumentChange {
  kind: 'uploaded' | 'replaced' | 'removed';
  /** The DocType */
  docType: string;
  /** The file now (for a removal, the file that was removed) */
  fileName: string;
  /** For a replacement: the file it took the place of */
  oldFileName: string;
  /** The version now ('v1.1'), or the one that was removed */
  version: string;
}

/**
 * What differs between the documents of the record and those of the working copy, one change for
 * each DocType: uploaded (there was none), replaced (another file or a new version) or removed. The
 * attachments are not compared: they are added and removed on their own, at once.
 */
export function documentChanges(
  original: ApplicationDocument[],
  working: ApplicationDocument[],
): DocumentChange[] {
  const before = applicationDocuments(original);
  const after = applicationDocuments(working);
  const changes: DocumentChange[] = [];
  for (const doc of after) {
    const was = before.find((d) => d.docType === doc.docType);
    if (!was) {
      changes.push({
        kind: 'uploaded',
        docType: doc.docType,
        fileName: doc.fileName,
        oldFileName: '',
        version: doc.version ?? 'v1.0',
      });
    } else if (
      was.fileName !== doc.fileName ||
      (was.version ?? 'v1.0') !== (doc.version ?? 'v1.0')
    ) {
      changes.push({
        kind: 'replaced',
        docType: doc.docType,
        fileName: doc.fileName,
        oldFileName: was.fileName,
        version: doc.version ?? 'v1.0',
      });
    }
  }
  for (const was of before) {
    if (!after.some((d) => d.docType === was.docType)) {
      changes.push({
        kind: 'removed',
        docType: was.docType,
        fileName: was.fileName,
        oldFileName: '',
        version: was.version ?? 'v1.0',
      });
    }
  }
  return changes;
}

/** The checks run again for an identity change, as the record sheet's dialog gives them. */
export interface KycRerun {
  /** The KYC fields of section 6.7 */
  patch: Partial<HomeLoanApplication>;
  /** The result ('Pass' or 'Exception'; a 'Fail' cannot be saved) */
  result: string;
  /** The remark of an Exception */
  remark: string;
  /** The mock reference IDs of the checks, for the trail */
  references: { source: string; status: string; reference: string }[];
}

export interface SaveEditInput {
  applicationId: string;
  /** The record as edited (the working copy of the sheet) */
  edited: HomeLoanApplication;
  changes: FieldChange[];
  /** The documents uploaded, replaced or removed in the sheet (see documentChanges) */
  documentChanges?: DocumentChange[];
  kyc?: KycRerun;
  /** Required for an approved record */
  reason?: string;
  user: DemoUser;
  now?: Date;
}

export type SaveEditErrorCode =
  'not-found' | 'not-allowed' | 'reason-required' | 'kyc-blocked' | 'sanction-over-eligible';

export type SaveEditOutcome =
  | {
      ok: true;
      data: WorkflowData;
      application: HomeLoanApplication;
      changes: FieldChange[];
      documentChanges: DocumentChange[];
    }
  | { ok: false; code: SaveEditErrorCode; error: string };

const refuse = (code: SaveEditErrorCode, error: string): SaveEditOutcome => ({
  ok: false,
  code,
  error,
});

const replaceIn = (list: HomeLoanApplication[], next: HomeLoanApplication) =>
  list.map((a) => (a.applicationId === next.applicationId ? next : a));

/**
 * Saves an edited record. The record in the working list is replaced, and so is its master record
 * if it has one (an approved record). Refused when the user may not edit it, when an approved
 * record has no reason, when the checks that were run again ended in Fail (or in an Exception
 * with no remark), or when an edit of the cost or the purpose would leave the sanctioned amount of an
 * approved record above the new Eligible Amount (section 6.8: the sanction cannot exceed it).
 */
export function saveRecordEdit(data: WorkflowData, input: SaveEditInput): SaveEditOutcome {
  const { applicationId, edited, changes, kyc, user, now = new Date() } = input;
  const docChanges = input.documentChanges ?? [];
  const original =
    data.masterRecords.find((r) => r.applicationId === applicationId) ??
    data.applications.find((a) => a.applicationId === applicationId);
  if (!original) return refuse('not-found', `There is no application ${applicationId}`);

  const access = editAccess(original, user);
  if (!access.allowed) return refuse('not-allowed', access.reason ?? 'You cannot edit this record');

  const reason = maskAadhaarInText((input.reason ?? '').trim());
  if (needsReason(original) && reason === '') {
    return refuse('reason-required', 'Enter the reason for the change');
  }
  // an Aadhaar number typed into the remark is masked here, once, for the record and for the trail
  const remark = kyc ? maskAadhaarInText(kyc.remark.trim()) : '';
  if (kyc) {
    if (kyc.result === 'Fail') {
      return refuse('kyc-blocked', 'The KYC result is Fail: the record cannot be saved');
    }
    if (kyc.result === 'Exception' && remark === '') {
      return refuse('kyc-blocked', 'Enter a remark for the KYC exception');
    }
  }

  const at = now.toISOString();
  // A draft that has passed the checks again is "KYC Done", as in the form; any other status stays
  const status =
    kyc &&
    (original.status === ApplicationStatus.Draft || original.status === ApplicationStatus.KycDone)
      ? ApplicationStatus.KycDone
      : original.status;
  const saved = sanitizeApplication(
    applyCalculatedFields({
      ...edited,
      ...(kyc ? { ...kyc.patch, kycExceptionRemark: remark } : {}),
      // what the sheet never edits stays as it was in the store
      applicationId: original.applicationId,
      applicationDate: original.applicationDate,
      createdBy: original.createdBy,
      createdAt: original.createdAt,
      // the documents of the working copy, and the attachments as they are in the store (they are added on their own)
      documents: [...applicationDocuments(edited.documents), ...attachmentsOf(original.documents)],
      status,
      updatedAt: at,
      level1Approver: original.level1Approver,
      level1Decision: original.level1Decision,
      level1Remarks: original.level1Remarks,
      level1Time: original.level1Time,
      level2Approver: original.level2Approver,
      level2Decision: original.level2Decision,
      level2Remarks: original.level2Remarks,
      level2Time: original.level2Time,
      sanctionedAmount: original.sanctionedAmount,
      sanctionDate: original.sanctionDate,
    }),
  );

  if (
    saved.sanctionedAmount !== null &&
    (saved.eligibleAmount === null || saved.sanctionedAmount > saved.eligibleAmount)
  ) {
    return refuse(
      'sanction-over-eligible',
      saved.eligibleAmount === null
        ? 'Choose a Loan Purpose: the sanctioned amount needs an Eligible Amount'
        : `The sanctioned amount, ${formatIndianNumber(saved.sanctionedAmount)}, is above the new Eligible Amount, ${formatIndianNumber(saved.eligibleAmount)}. Change the Estimated Cost or the Loan Purpose back`,
    );
  }

  const later = (seconds: number) => new Date(now.getTime() + seconds * 1000).toISOString();
  const events = withEventIds(data.auditEvents, [
    ...changes.map((change) => ({
      applicationId,
      event: 'Field changed' as const,
      user: user.name,
      at,
      comment: reason,
      field: change.label,
      oldValue: maskAadhaarInText(change.oldValue),
      newValue: maskAadhaarInText(change.newValue),
    })),
    ...docChanges.map((change) => ({
      applicationId,
      event:
        change.kind === 'replaced'
          ? ('Document replaced' as const)
          : change.kind === 'removed'
            ? ('Document removed' as const)
            : ('Document uploaded' as const),
      user: user.name,
      at,
      comment: reason,
      field: change.docType,
      oldValue:
        change.kind === 'replaced'
          ? change.oldFileName
          : change.kind === 'removed'
            ? change.fileName
            : '',
      newValue: change.kind === 'removed' ? '' : `${change.fileName} (${change.version})`,
    })),
    ...(kyc
      ? [
          ...kyc.references.map((check) => ({
            applicationId,
            event: 'KYC check run' as const,
            user: 'System',
            at: later(1),
            field: check.source,
            newValue: check.status,
            reference: check.reference,
          })),
          {
            applicationId,
            event: 'KYC result set' as const,
            user: 'System',
            at: later(1),
            field: 'KYC Overall Result',
            newValue: kyc.result,
            comment: remark,
          },
        ]
      : []),
  ]);

  const inMasters = data.masterRecords.some((r) => r.applicationId === applicationId);
  return {
    ok: true,
    data: {
      ...data,
      applications: data.applications.some((a) => a.applicationId === applicationId)
        ? replaceIn(data.applications, saved)
        : [...data.applications, saved],
      masterRecords: inMasters ? replaceIn(data.masterRecords, saved) : data.masterRecords,
      auditEvents: [...data.auditEvents, ...events],
    },
    application: saved,
    changes,
    documentChanges: docChanges,
  };
}
