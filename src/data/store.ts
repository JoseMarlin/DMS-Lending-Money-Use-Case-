/**
 * The one shared store. Every screen reads and writes through it.
 * State is kept in memory and saved to localStorage so a refresh does not lose the demo.
 *
 * Aadhaar: the store only ever holds the masked value ('XXXX XXXX 4821'). Writes are masked on the
 * way in, on the way to localStorage and again when read back, so the full number can only exist
 * in the form's own input state. (Every text field of an application is scanned for a typed number.)
 *
 * Single tab: there is no cross-tab sync. Use one browser window for the demo.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  applyCalculatedFields,
  createBlankApplication,
  hasKycResult,
  identityChanged,
  nextApplicationId,
  resetKyc,
  revokePreviewUrls,
  sanitizeApplication,
  toApplicationDocuments,
  withoutBlobPreviews,
} from './application';
import {
  addAttachment,
  removeAttachment,
  type AddAttachmentInput,
  type AttachmentOutcome,
} from './attachments';
import { liveApplications, movedFolderIds, pruneMovedFolders } from './fileRecords';
import { BRANCHES } from './options';
import {
  addComment,
  deleteComment,
  type AddCommentOutcome,
  type DeleteCommentOutcome,
} from './recordComments';
import { saveRecordEdit as saveEdit, type SaveEditInput, type SaveEditOutcome } from './recordEdit';
import {
  isAuditEvent,
  isNotification,
  isRecordComment,
  isWorkflowInstance,
  uniqueById,
} from './savedData';
import { SEED_COMMENTS } from './seedComments';
import { DEFAULT_USER_ID, DEMO_USERS, SCENARIOS, SEED_APPLICATIONS } from './seed';
import { addMissingWorkflow, buildSeedWorkflow } from './seedWorkflow';
import type {
  AppNotification,
  ApprovalTask,
  AuditEvent,
  DemoUser,
  DemoUserId,
  FormStep,
  HomeLoanApplication,
  KycOutage,
  RecordComment,
  ScenarioKey,
  WorkflowInstance,
} from './types';
import {
  approve as approveStep,
  markNotificationsRead,
  pendingTasksFor,
  reject as rejectStep,
  resubmit as resubmitStep,
  returnForCorrection as returnStep,
  submitToWorkflow,
  unreadCount,
  type ApproveExtra,
  type WorkflowData,
  type WorkflowOutcome,
} from './workflow';

export const STORAGE_KEY = 'dms-home-loan-demo';

interface AppData {
  /** Who the demo is acting as (section 5) */
  currentUserId: DemoUserId;
  /** The application being filled in the master form */
  draft: HomeLoanApplication;
  /** Saved applications, newest data wins (used by the list screen later) */
  applications: HomeLoanApplication[];
  /** 1 is the application, 2 is KYC validation, 3 is review and submit */
  currentStep: FormStep;
  /** Demo setting: make a government source unavailable during KYC */
  kycOutage: KycOutage;
  /** The scenario last filled, if any. The mock KYC reads this to pick its source data. */
  activeScenario: ScenarioKey | null;
  /**
   * Goes up whenever the draft is replaced as a whole (scenario fill, new draft, reset). Form
   * components watch it to reload their local input state, including the Aadhaar input.
   */
  draftResetCount: number;
  /**
   * The master records, one for each application that got its final approval (a copy of the
   * application with status Approved and the approval fields of section 6.8). The workflow step
   * creates them; until then the list is empty, and so is the "All Records" tab of the master.
   */
  masterRecords: HomeLoanApplication[];
  /** One instance of the workflow "Home Loan Approval" for each submitted application */
  workflowInstances: WorkflowInstance[];
  /** The audit trail of every application (section 11), oldest first. Aadhaar is never in it. */
  auditEvents: AuditEvent[];
  /** Messages for users, shown in the bell (the loan officer is told of a decision) */
  notifications: AppNotification[];
  /** The app shell's sidebar is shown as a narrow icon rail. A display setting, kept on Reset demo. */
  sidebarCollapsed: boolean;
  /** The ids of the files starred on the Files & Folders screen (a file card's star). */
  favouriteFileIds: string[];
  /** The comments written in the side panel of the record sheet (the decisions' comments are in the trail) */
  recordComments: RecordComment[];
  /**
   * The ids of the folders of Files & Folders that files were moved into (by a submit, an approval, a
   * rejection...) and that nobody has opened since: they carry a "Moved" mark. A folder id is its path.
   */
  movedFolders: string[];
}

interface AppActions {
  setCurrentUser: (id: DemoUserId) => void;
  toggleSidebar: () => void;
  /** Stars a file on the Files & Folders screen, or takes the star away. */
  toggleFavouriteFile: (fileId: string) => void;
  /** A folder was opened: its "Moved" mark goes. */
  clearMovedFolder: (folderId: string) => void;
  /** Merges fields into the draft. Calculated fields are recomputed and Aadhaar is masked. */
  updateDraft: (patch: Partial<HomeLoanApplication>) => void;
  setStep: (step: FormStep) => void;
  setKycOutage: (outage: KycOutage) => void;
  /** Clears the KYC result so the checks run again (the "Re-run" link) */
  resetKycResult: () => void;
  /** Replaces the draft with a scenario from section 13 and goes back to step 1. */
  fillScenario: (key: ScenarioKey) => void;
  /** Replaces the draft with a blank application for the current user. */
  startNewDraft: () => void;
  /** Adds the application, or replaces the one with the same Application ID. */
  saveApplication: (application: HomeLoanApplication) => void;
  /**
   * Submits the draft as the user who is acting: the workflow instance is made, the application is
   * "In Level 1" and the first approval task is waiting. Gives the outcome (or why not).
   */
  submitApplication: () => WorkflowOutcome;
  /** An approver's decisions (see workflow.ts for the rules). Each gives the outcome, or why not. */
  approve: (
    instanceId: string,
    user: DemoUser,
    comment: string,
    extra?: ApproveExtra,
  ) => WorkflowOutcome;
  reject: (instanceId: string, user: DemoUser, comment: string) => WorkflowOutcome;
  /**
   * Saves a record edited in the record sheet: the record is replaced (and its master record), and the
   * trail gets an event for each field that changed. Gives the outcome, or why not.
   */
  saveRecordEdit: (input: Omit<SaveEditInput, 'now'>) => SaveEditOutcome;
  /** Adds a comment to an application as the user who is acting. Gives the outcome (or why not). */
  addRecordComment: (applicationId: string, text: string) => AddCommentOutcome;
  /** Deletes a comment, if the user who is acting wrote it. */
  deleteRecordComment: (commentId: string) => DeleteCommentOutcome;
  /** Attaches a supporting file to an application as the user who is acting (see attachments.ts). */
  addAttachment: (
    applicationId: string,
    file: AddAttachmentInput['file'],
    note?: string,
  ) => AttachmentOutcome;
  /** Removes an attachment: whoever attached it, or the administrator. */
  removeAttachment: (applicationId: string, documentId: string) => AttachmentOutcome;
  /** A returned application goes back to Level 1 in the same instance (see workflow.ts). */
  resubmit: (instanceId: string, user: DemoUser) => WorkflowOutcome;
  returnForCorrection: (instanceId: string, user: DemoUser, comment: string) => WorkflowOutcome;
  /** The user has opened the bell: their messages count as read. */
  markNotificationsRead: (userId: DemoUserId) => void;
  /** Back to the seeded demo state, for the user "Priya Kulkarni". */
  resetDemo: () => void;
}

export type AppState = AppData & AppActions;

function defaultBranchFor(user: DemoUser): string {
  return (BRANCHES as readonly string[]).includes(user.branch) ? user.branch : BRANCHES[0];
}

function blankDraftFor(user: DemoUser, applications: HomeLoanApplication[]): HomeLoanApplication {
  return createBlankApplication({
    applicationId: nextApplicationId(applications.map((a) => a.applicationId)),
    branch: defaultBranchFor(user),
    createdBy: user.name,
  });
}

function createInitialData(): AppData {
  const applications = structuredClone(SEED_APPLICATIONS);
  const workflow = buildSeedWorkflow(applications);
  return {
    currentUserId: DEFAULT_USER_ID,
    draft: blankDraftFor(DEMO_USERS[DEFAULT_USER_ID], applications),
    applications,
    currentStep: 1,
    kycOutage: 'none',
    activeScenario: null,
    draftResetCount: 0,
    masterRecords: [],
    ...workflow,
    sidebarCollapsed: false,
    favouriteFileIds: [],
    recordComments: structuredClone(SEED_COMMENTS),
    movedFolders: [],
  };
}

/**
 * What a change of the attachments of one application writes to the store: its data, and the form's
 * own copy when it is the one in the form. The form's copy may hold what was typed since it was saved,
 * so only the file that was added or removed is put in it (or taken out), not the saved copy over it.
 * A form copy that is older than the saved one (the record was edited in the sheet since) is replaced.
 */
function withDraftSynced(
  state: AppData,
  outcome: Extract<AttachmentOutcome, { ok: true }>,
  change: 'added' | 'removed',
): Partial<AppData> {
  const id = outcome.application.applicationId;
  if (id !== state.draft.applicationId) return { ...outcome.data };
  const saved = state.applications.find((a) => a.applicationId === id);
  const draftTime = Date.parse(state.draft.updatedAt) || 0;
  if (saved && draftTime < (Date.parse(saved.updatedAt) || 0)) {
    return { ...outcome.data, draft: outcome.application };
  }
  const others = state.draft.documents.filter((d) => d.id !== outcome.document.id);
  return {
    ...outcome.data,
    draft: {
      ...state.draft,
      documents: change === 'added' ? [...others, outcome.document] : others,
      updatedAt:
        draftTime > (Date.parse(outcome.application.updatedAt) || 0)
          ? state.draft.updatedAt
          : outcome.application.updatedAt,
    },
  };
}

/** The stars without the ones of files that are gone: the star is the file's, so it goes with it. */
const withoutStars = (stars: string[], ids: string[]): string[] =>
  ids.length === 0 ? stars : stars.filter((id) => !ids.includes(id));

/** The ids of the documents of a draft that is being left behind, if it was never saved (a saved one stays in the list). */
function unsavedDocumentIds(state: AppData): string[] {
  const saved = state.applications.some((a) => a.applicationId === state.draft.applicationId);
  return saved ? [] : state.draft.documents.map((d) => d.id);
}

/**
 * The "Moved" marks after a change to the applications: the ones there were, and the folders that
 * the change moved files into. `patch` is what the action is about to write.
 */
function withMoves(before: AppData, patch: Partial<AppData>): Partial<AppData> {
  const after = { ...before, ...patch };
  const now = liveApplications(after.applications, after.draft);
  const moved = movedFolderIds(liveApplications(before.applications, before.draft), now);
  // the marks there were and the new ones, without the ones that mean nothing any more (a folder the
  // files left, a folder that was renamed, a trail with no marked folder at the end of it)
  const marks = pruneMovedFolders([...before.movedFolders, ...moved], now);
  const same =
    marks.length === before.movedFolders.length &&
    marks.every((id, i) => id === before.movedFolders[i]);
  return same ? patch : { ...patch, movedFolders: marks };
}

/** The part of the state the workflow functions read and write. */
function workflowData(state: AppData): WorkflowData {
  return {
    applications: state.applications,
    masterRecords: state.masterRecords,
    workflowInstances: state.workflowInstances,
    auditEvents: state.auditEvents,
    notifications: state.notifications,
  };
}

/**
 * localStorage that never throws. Saving can fail (storage blocked, full, private window); that
 * must not break the action that asked for it, so a failed save is dropped and the demo goes on in
 * memory.
 */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* not saved */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* nothing to remove */
    }
  },
};

/** Puts the result of a workflow step into the store (if it went through) and hands it back. */
function applyOutcome(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  outcome: WorkflowOutcome,
): WorkflowOutcome {
  if (!outcome.ok) return outcome;
  const { draft } = get();
  // the form's own copy follows, if the application that changed is the one in the form
  const same = outcome.data.applications.find((a) => a.applicationId === draft.applicationId);
  set(withMoves(get(), { ...outcome.data, ...(same ? { draft: same } : {}) }));
  return outcome;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createInitialData(),

      setCurrentUser: (id) => set({ currentUserId: id }),

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      clearMovedFolder: (folderId) =>
        set((state) =>
          state.movedFolders.includes(folderId)
            ? {
                // the folders above it lose their mark when nothing marked is left below them
                movedFolders: pruneMovedFolders(
                  state.movedFolders.filter((id) => id !== folderId),
                  liveApplications(state.applications, state.draft),
                ),
              }
            : state,
        ),

      toggleFavouriteFile: (fileId) =>
        set((state) => ({
          favouriteFileIds: state.favouriteFileIds.includes(fileId)
            ? state.favouriteFileIds.filter((id) => id !== fileId)
            : [...state.favouriteFileIds, fileId],
        })),

      updateDraft: (patch) => {
        const before = get().draft;
        let draft = applyCalculatedFields(
          sanitizeApplication({ ...before, ...patch, updatedAt: new Date().toISOString() }),
        );
        // A change to what KYC checks makes the old result void: clear it, so KYC runs again
        if (hasKycResult(before) && identityChanged(before, draft)) draft = resetKyc(draft);
        revokePreviewUrls(before.documents, draft.documents); // files removed or replaced
        // a file that was removed takes its star with it (a replaced one is the same file: the id stays)
        const gone = before.documents
          .filter((d) => !draft.documents.some((kept) => kept.id === d.id))
          .map((d) => d.id);
        set(
          gone.length > 0
            ? { draft, favouriteFileIds: withoutStars(get().favouriteFileIds, gone) }
            : { draft },
        );
      },

      setStep: (step) => set({ currentStep: step }),

      setKycOutage: (outage) => set({ kycOutage: outage }),

      resetKycResult: () =>
        set((state) => ({
          draft: resetKyc({ ...state.draft, updatedAt: new Date().toISOString() }),
        })),

      fillScenario: (key) => {
        const { currentUserId, applications, draftResetCount, draft: previous } = get();
        const user = DEMO_USERS[currentUserId];
        const scenario = SCENARIOS[key];
        revokePreviewUrls(previous.documents);
        const base = blankDraftFor(user, applications);
        const draft = applyCalculatedFields(
          sanitizeApplication({
            ...base,
            ...structuredClone(scenario.application),
            documents: toApplicationDocuments(
              base.applicationId,
              scenario.documents,
              user.name,
              base.createdAt,
            ),
          }),
        );
        set({
          draft,
          currentStep: 1,
          activeScenario: key,
          draftResetCount: draftResetCount + 1,
          // the draft that is left behind was never saved: its files, and their stars, are gone
          favouriteFileIds: withoutStars(get().favouriteFileIds, unsavedDocumentIds(get())),
        });
      },

      startNewDraft: () => {
        const { currentUserId, applications, draftResetCount, draft: previous } = get();
        revokePreviewUrls(previous.documents);
        set({
          draft: blankDraftFor(DEMO_USERS[currentUserId], applications),
          currentStep: 1,
          activeScenario: null,
          draftResetCount: draftResetCount + 1,
          favouriteFileIds: withoutStars(get().favouriteFileIds, unsavedDocumentIds(get())),
        });
      },

      saveApplication: (application) =>
        set((state) => {
          const saved = sanitizeApplication(application);
          const exists = state.applications.some((a) => a.applicationId === saved.applicationId);
          return {
            applications: exists
              ? state.applications.map((a) => (a.applicationId === saved.applicationId ? saved : a))
              : [...state.applications, saved],
          };
        }),

      submitApplication: () => {
        const state = get();
        const outcome = submitToWorkflow(
          workflowData(state),
          state.draft,
          DEMO_USERS[state.currentUserId],
        );
        if (outcome.ok) {
          const submitted = outcome.data.applications.find(
            (a) => a.applicationId === state.draft.applicationId,
          );
          set(withMoves(state, { ...outcome.data, draft: submitted ?? state.draft }));
        }
        return outcome;
      },

      approve: (instanceId, user, comment, extra) =>
        applyOutcome(set, get, approveStep(workflowData(get()), instanceId, user, comment, extra)),

      reject: (instanceId, user, comment) =>
        applyOutcome(set, get, rejectStep(workflowData(get()), instanceId, user, comment)),

      saveRecordEdit: (input) => {
        const state = get();
        const outcome = saveEdit(workflowData(state), input);
        if (!outcome.ok) return outcome;
        // the form's own copy follows, if the record that was edited is the one in the form
        const same = outcome.application.applicationId === state.draft.applicationId;
        // the star of a file that was removed goes with it, so that a later upload does not inherit it
        const removed = outcome.documentChanges.filter((c) => c.kind === 'removed');
        const removedIds = (
          state.applications.find((a) => a.applicationId === outcome.application.applicationId)
            ?.documents ?? []
        )
          .filter((d) => removed.some((c) => c.docType === d.docType))
          .map((d) => d.id);
        // the local links of the files that this save replaced or removed are freed
        const gone = new Set(
          outcome.documentChanges.filter((c) => c.kind !== 'uploaded').map((c) => c.docType),
        );
        revokePreviewUrls(
          (
            state.applications.find((a) => a.applicationId === outcome.application.applicationId)
              ?.documents ?? []
          ).filter((d) => gone.has(d.docType)),
          outcome.application.documents,
        );
        set(
          withMoves(state, {
            ...outcome.data,
            ...(same
              ? { draft: outcome.application, draftResetCount: state.draftResetCount + 1 }
              : {}),
            favouriteFileIds: withoutStars(state.favouriteFileIds, removedIds),
          }),
        );
        return outcome;
      },

      addAttachment: (applicationId, file, note) => {
        const state = get();
        const outcome = addAttachment(workflowData(state), {
          applicationId,
          file,
          note,
          user: DEMO_USERS[state.currentUserId],
        });
        if (outcome.ok) set(withDraftSynced(state, outcome, 'added'));
        return outcome;
      },

      removeAttachment: (applicationId, documentId) => {
        const state = get();
        const outcome = removeAttachment(workflowData(state), {
          applicationId,
          documentId,
          user: DEMO_USERS[state.currentUserId],
        });
        if (outcome.ok) {
          revokePreviewUrls([outcome.document], []);
          set({
            ...withDraftSynced(state, outcome, 'removed'),
            // the star goes with the file
            favouriteFileIds: withoutStars(state.favouriteFileIds, [documentId]),
          });
        }
        return outcome;
      },

      addRecordComment: (applicationId, text) => {
        const state = get();
        const outcome = addComment(state, {
          applicationId,
          text,
          user: DEMO_USERS[state.currentUserId],
        });
        if (outcome.ok) {
          set({ recordComments: outcome.recordComments, auditEvents: outcome.auditEvents });
        }
        return outcome;
      },

      deleteRecordComment: (commentId) => {
        const state = get();
        const outcome = deleteComment(
          state.recordComments,
          commentId,
          DEMO_USERS[state.currentUserId],
        );
        if (outcome.ok) set({ recordComments: outcome.recordComments });
        return outcome;
      },

      resubmit: (instanceId, user) =>
        applyOutcome(set, get, resubmitStep(workflowData(get()), instanceId, user)),

      returnForCorrection: (instanceId, user, comment) =>
        applyOutcome(set, get, returnStep(workflowData(get()), instanceId, user, comment)),

      markNotificationsRead: (userId) =>
        set((state) => {
          const next = markNotificationsRead(state.notifications, userId);
          return next === state.notifications ? state : { notifications: next };
        }),

      // set() writes the fresh state over whatever was saved, so nothing old is left behind.
      // (No clearStorage call: it does not exist when localStorage is blocked.)
      resetDemo: () => {
        revokePreviewUrls(get().draft.documents);
        set({
          ...createInitialData(),
          draftResetCount: get().draftResetCount + 1,
          sidebarCollapsed: get().sidebarCollapsed, // how the screen is laid out is not demo data
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      // Save data only, not the action functions. Aadhaar is masked once more on the way out, so
      // even a direct setState cannot put a full number in localStorage.
      partialize: (state): AppData => ({
        currentUserId: state.currentUserId,
        draft: withoutBlobPreviews(sanitizeApplication(state.draft)),
        applications: state.applications.map((a) => withoutBlobPreviews(sanitizeApplication(a))),
        currentStep: state.currentStep,
        kycOutage: state.kycOutage,
        activeScenario: state.activeScenario,
        draftResetCount: state.draftResetCount,
        masterRecords: state.masterRecords.map((r) => withoutBlobPreviews(sanitizeApplication(r))),
        workflowInstances: state.workflowInstances,
        auditEvents: state.auditEvents,
        notifications: state.notifications,
        sidebarCollapsed: state.sidebarCollapsed,
        favouriteFileIds: state.favouriteFileIds,
        recordComments: state.recordComments,
        movedFolders: state.movedFolders,
      }),
      // Whatever comes back from localStorage is masked again before it is used. A save from an
      // older version, or a damaged one, is laid over the fresh defaults, so a missing or wrong
      // piece cannot break the page.
      merge: (persisted, current) => {
        if (typeof persisted !== 'object' || persisted === null) return current;
        const saved = persisted as Record<string, unknown>;
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null && !Array.isArray(value);
        const application = (value: unknown): HomeLoanApplication | null => {
          if (!isRecord(value) || typeof value.applicationId !== 'string') return null;
          const merged = { ...current.draft, ...value } as HomeLoanApplication;
          if (!Array.isArray(merged.documents)) merged.documents = [];
          return sanitizeApplication(merged);
        };
        const applications = Array.isArray(saved.applications)
          ? saved.applications.flatMap((a) => application(a) ?? [])
          : null;
        const outages: KycOutage[] = ['none', 'pan-once', 'pan-down', 'gst-down'];
        // the workflow data: a saved copy without it (made before the workflow existed) gets the
        // seed's, and a submitted application that has no instance is given one
        const mergedApplications = applications ?? current.applications;
        const checked = (
          list: unknown,
          ok: (v: unknown) => boolean,
          fallback: never[] | unknown[],
        ) => (Array.isArray(list) ? list.filter(ok) : fallback);
        const mergedWorkflow = addMissingWorkflow(mergedApplications, {
          workflowInstances: uniqueById(
            checked(
              saved.workflowInstances,
              isWorkflowInstance,
              current.workflowInstances,
            ) as WorkflowInstance[],
          ),
          auditEvents: uniqueById(
            checked(saved.auditEvents, isAuditEvent, current.auditEvents) as AuditEvent[],
          ),
          notifications: uniqueById(
            checked(
              saved.notifications,
              isNotification,
              current.notifications,
            ) as AppNotification[],
          ),
        });
        return {
          ...current,
          currentUserId:
            typeof saved.currentUserId === 'string' &&
            Object.hasOwn(DEMO_USERS, saved.currentUserId)
              ? (saved.currentUserId as DemoUserId)
              : current.currentUserId,
          draft: application(saved.draft) ?? current.draft,
          applications: applications ?? current.applications,
          currentStep:
            saved.currentStep === 1 || saved.currentStep === 2 || saved.currentStep === 3
              ? saved.currentStep
              : current.currentStep,
          kycOutage: outages.includes(saved.kycOutage as KycOutage)
            ? (saved.kycOutage as KycOutage)
            : current.kycOutage,
          activeScenario:
            typeof saved.activeScenario === 'string' &&
            Object.hasOwn(SCENARIOS, saved.activeScenario)
              ? (saved.activeScenario as ScenarioKey)
              : null,
          draftResetCount:
            typeof saved.draftResetCount === 'number'
              ? saved.draftResetCount
              : current.draftResetCount,
          masterRecords: Array.isArray(saved.masterRecords)
            ? saved.masterRecords.flatMap((r) => application(r) ?? [])
            : current.masterRecords,
          ...mergedWorkflow,
          sidebarCollapsed:
            typeof saved.sidebarCollapsed === 'boolean'
              ? saved.sidebarCollapsed
              : current.sidebarCollapsed,
          favouriteFileIds: Array.isArray(saved.favouriteFileIds)
            ? [
                ...new Set(
                  saved.favouriteFileIds.filter((id): id is string => typeof id === 'string'),
                ),
              ]
            : current.favouriteFileIds,
          recordComments: Array.isArray(saved.recordComments)
            ? uniqueById(saved.recordComments.filter(isRecordComment))
            : current.recordComments,
          movedFolders: Array.isArray(saved.movedFolders)
            ? [...new Set(saved.movedFolders.filter((id): id is string => typeof id === 'string'))]
            : current.movedFolders,
        };
      },
    },
  ),
);

/** The user the demo is currently acting as. */
export function useCurrentUser(): DemoUser {
  return useAppStore((state) => DEMO_USERS[state.currentUserId]);
}

/** The approval tasks waiting for the demo user who is acting now, oldest first. */
export function usePendingTasks(): ApprovalTask[] {
  const applications = useAppStore((state) => state.applications);
  const masterRecords = useAppStore((state) => state.masterRecords);
  const workflowInstances = useAppStore((state) => state.workflowInstances);
  const notifications = useAppStore((state) => state.notifications);
  const user = useCurrentUser();
  return useMemo(
    () => pendingTasksFor({ applications, masterRecords, workflowInstances, notifications }, user),
    [applications, masterRecords, workflowInstances, notifications, user],
  );
}

/** What the bell counts: the tasks waiting for the user and the messages they have not read. */
export function useUnreadCount(): number {
  const applications = useAppStore((state) => state.applications);
  const masterRecords = useAppStore((state) => state.masterRecords);
  const workflowInstances = useAppStore((state) => state.workflowInstances);
  const notifications = useAppStore((state) => state.notifications);
  const user = useCurrentUser();
  return useMemo(
    () => unreadCount({ applications, masterRecords, workflowInstances, notifications }, user),
    [applications, masterRecords, workflowInstances, notifications, user],
  );
}
