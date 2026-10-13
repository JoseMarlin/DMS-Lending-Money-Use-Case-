import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDialog,
  InlineBanner,
  SearchInput,
  Tabs,
  Tooltip,
  tabPanelProps,
  useToast,
} from '@/components/ui';
import { CloseIcon, EditIcon } from '@/components/ui/icons';
import StatusChip from '@/components/ui/StatusChip';
import { useFocusTrap } from '@/components/ui/useFocusTrap';
import { listStatusOf } from '@/data/listStatus';
import { editAccess } from '@/data/recordEdit';
import { useAppStore, useCurrentUser } from '@/data/store';
import { ApplicationStatus, WorkflowInstanceStatus, type HomeLoanApplication } from '@/data/types';
import { instanceByApplication } from '@/data/workflow';
import { focusField } from '@/features/home-loan/form/focusField';
import { fieldId, type FieldSchema } from '@/features/home-loan/form/schema';
import { reviewPath } from '@/features/workflow/workflowList';
import EditFields from './EditFields';
import KycRerunDialog from './KycRerunDialog';
import ReasonDialog from './ReasonDialog';
import { correctedSinceReturn, editItems, issueSummary, tabOfField } from './editModel';
import {
  SCHEMA_FIELDS,
  SHEET_TABS,
  filterFields,
  formatFormValue,
  sheetBanner,
  sheetFields,
  workflowAccess,
  type SheetField,
  type SheetTabId,
} from './recordSheetModel';
import RecordSidePanel from './panel/RecordSidePanel';
import { defaultPanelTab, type PanelTabId } from './panel/sidePanelModel';
import { useRecordEdit } from './useRecordEdit';

const PREFIX = 'record';

const HEADER_BUTTON =
  'h-8 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** What a screen reader is told about the search: nothing without a search, else how many fields are shown. */
function searchResult(query: string, shown: number, all: number): string {
  const text = query.trim();
  if (text === '') return '';
  return shown > 0
    ? `${shown} of ${all} fields shown`
    : `No field of this tab has “${text}” in its label or value`;
}

/** One label and its value: the label muted above, the value in bold, "-" when there is none. */
function FieldItem({ field }: { field: SheetField }) {
  return (
    <div className={`min-w-0 ${field.fullRow ? 'col-span-full' : field.wide ? 'col-span-2' : ''}`}>
      <dt className="text-[13px] leading-[18px] font-medium text-subtle">{field.label}</dt>
      <dd className="mt-1 text-[14px] leading-5 font-semibold [overflow-wrap:anywhere] whitespace-pre-line text-ink">
        {field.value === '' ? (
          <>
            <span aria-hidden>-</span>
            <span className="sr-only">Not provided</span>
          </>
        ) : field.badge ? (
          <Badge tone={field.badge}>{field.value}</Badge>
        ) : (
          field.value
        )}
      </dd>
    </div>
  );
}

/** The close button, the same in the sheet of a record and in the one for a record that is not there. */
function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close record"
      onClick={onClose}
      className="flex h-8 w-8 items-center justify-center rounded-full text-label hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <CloseIcon size={18} />
    </button>
  );
}

/**
 * The frame of the sheet: it slides up from the bottom (250ms), covers everything below the 56px top
 * bar, the sidebar too, and dims nothing. The cursor stays inside it, and Escape closes it.
 */
function SheetFrame({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, panelRef, onClose, 'panel');
  // the messages (a toast) hang under the header of the sheet while it is open, not over its buttons
  useEffect(() => {
    document.documentElement.style.setProperty('--toast-top', '120px');
    return () => {
      document.documentElement.style.removeProperty('--toast-top');
    };
  }, []);
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="fixed inset-x-0 top-header bottom-0 z-[9000] flex animate-sheet-up flex-col bg-white shadow-[0_-4px_24px_#19283926] outline-none motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}

/** The sheet for an Application ID that is not in the store (a link from before a Reset demo). */
function MissingRecord({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  return (
    <SheetFrame label="Record not found" onClose={onClose}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-6">
        <h2 className="text-[20px] leading-7 font-bold text-ink">Record not found</h2>
        <CloseButton onClose={onClose} />
      </header>
      <div className="px-8 pt-8">
        <p className="text-body-m text-ink">We could not find this application.</p>
        <p className="mt-1 text-body-m text-subtle">
          There is no application with the ID {applicationId}. It may have been cleared by Reset
          demo.
        </p>
      </div>
    </SheetFrame>
  );
}

/**
 * The record bottom sheet (Figma file 0OEbaHCUR61Mkff8AWoQmX, node 2983:8209: the layout and the
 * behaviour only; the colours, the logo and the top bar are DMS+). A header with the record name, its
 * status chip, a search box, Edit, View workflow and a close button; tabs; a 4-column grid of the
 * fields of the tab; and, at the right, a 360px panel with a 40px rail of icons (RecordSidePanel).
 * It opens at /metadata/master/home-loan?record={applicationId}.
 *
 * Edit turns the fields into the form's own inputs, in a working copy that is kept while the tabs
 * are switched; Save validates every tab, runs the KYC checks again when an identity field changed,
 * asks the reason for the change of an approved record, and writes the record and the audit trail.
 */
export default function RecordSheet({
  applicationId,
  tab,
  onTabChange,
  onClose,
}: {
  applicationId: string;
  tab: SheetTabId;
  onTabChange: (tab: SheetTabId) => void;
  onClose: () => void;
}) {
  const application: HomeLoanApplication | undefined = useAppStore(
    (state) =>
      state.masterRecords.find((r) => r.applicationId === applicationId) ??
      state.applications.find((a) => a.applicationId === applicationId),
  );
  if (!application) return <MissingRecord applicationId={applicationId} onClose={onClose} />;
  return (
    <RecordSheetBody
      // another record is another sheet: an edit, a search or a typed comment is not carried over to it
      key={application.applicationId}
      application={application}
      tab={tab}
      onTabChange={onTabChange}
      onClose={onClose}
    />
  );
}

function RecordSheetBody({
  application,
  tab,
  onTabChange,
  onClose,
}: {
  application: HomeLoanApplication;
  tab: SheetTabId;
  onTabChange: (tab: SheetTabId) => void;
  onClose: () => void;
}) {
  const workflowInstances = useAppStore((state) => state.workflowInstances);
  const auditEvents = useAppStore((state) => state.auditEvents);
  const resubmit = useAppStore((state) => state.resubmit);
  const user = useCurrentUser();
  const toast = useToast();
  const [query, setQuery] = useState('');
  // the side panel: which one is on and whether it is open (Save opens Files when a document is missing)
  const [panelTab, setPanelTab] = useState<PanelTabId>(() => defaultPanelTab(application.status));
  const [panelOpen, setPanelOpen] = useState(true);
  // a required document that Save found missing: each blocked Save is a new request, so the cursor goes there again
  const [focusDoc, setFocusDoc] = useState<{ docType: string; n: number } | null>(null);
  // the sheet is being left (not only the edit cancelled): the discard dialog then closes it, or goes on to the workflow
  const [leaving, setLeaving] = useState<{ to: string | null } | null>(null);
  const navigate = useNavigate();
  const edit = useRecordEdit({ application, user, onSaved: () => {} });
  // the first invalid field after a Save: the sheet goes to its tab and puts the cursor in it
  const focusRequest = useRef<FieldSchema | null>(null);
  useEffect(() => {
    const field = focusRequest.current;
    if (field && tabOfField(fieldId(field)) === tab) {
      focusRequest.current = null;
      focusField(field);
    }
  });
  // Edit and Cancel/Save take each other's place, so the cursor is put somewhere that stays: the
  // fields when editing starts, the Edit button when it ends
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (edit.active && !wasEditing.current) {
      document.getElementById(`${PREFIX}-panel-${tab}`)?.focus();
    } else if (!edit.active && wasEditing.current) {
      editButton.current?.focus();
    }
    wasEditing.current = edit.active;
  }, [edit.active, tab]);

  // after Resubmit the button is gone: the cursor goes to View workflow, which is where the record went on
  const workflowLink = useRef<HTMLAnchorElement>(null);
  const resubmitWas = useRef(false);

  const applicationId = application.applicationId;
  const view = edit.active ? edit.working : application;
  const name = view.fullNameAsPerPan.trim() || applicationId;
  const current = SHEET_TABS.find((t) => t.id === tab) ?? SHEET_TABS[0];
  const fields = sheetFields(view, current.id);
  const shown = filterFields(fields, query);
  const items = edit.active ? editItems(edit.working, current.id) : [];
  const banner = sheetBanner(application);
  const access = workflowAccess({ workflowInstances }, user, applicationId);
  const editing = editAccess(application, user);
  const instance = instanceByApplication({ workflowInstances }, applicationId);
  const canResubmit =
    application.status === ApplicationStatus.Returned &&
    instance?.status === WorkflowInstanceStatus.Returned &&
    (user.role === 'admin' ||
      (user.role === 'loanOfficer' && user.name === instance.initiatedBy)) &&
    correctedSinceReturn(auditEvents, applicationId);
  useEffect(() => {
    const active = document.activeElement;
    if (resubmitWas.current && !canResubmit && (!active || active === document.body)) {
      (workflowLink.current ?? editButton.current)?.focus();
    }
    resubmitWas.current = canResubmit;
  }, [canResubmit]);
  const resultCount = edit.active ? items.length : fields.length;
  const shownCount = edit.active
    ? filterFields(
        items.map((item) => ({
          label: item.kind === 'field' ? item.field.label : item.label,
          value: item.kind === 'field' ? formatFormValue(item.field, edit.working) : item.value,
        })),
        query,
      ).length
    : shown.length;

  // Closing a sheet with unsaved changes asks first
  const close = () => {
    if (edit.active && edit.dirty) {
      setLeaving({ to: null });
      edit.requestCancel();
    } else onClose();
  };

  const save = () => {
    const block = edit.save();
    if (!block) return;
    if (block.tab === 'files') {
      // a required document is missing: the Files and Attachments panel opens, and the cursor goes to its row
      setPanelTab('files');
      setPanelOpen(true);
      const docType = block.field.docType;
      if (docType) setFocusDoc((current) => ({ docType, n: (current?.n ?? 0) + 1 }));
    } else {
      setQuery(''); // a search that hides the field would keep the cursor from reaching it
      focusRequest.current = block.field;
      if (block.tab !== tab) onTabChange(block.tab);
    }
  };

  // Leaving the sheet for another page (the folder of a file, the workflow) with unsaved changes asks first, like Close
  const guardLeave = (event: MouseEvent<HTMLElement>, to: string) => {
    if (edit.active && edit.dirty) {
      event.preventDefault();
      setLeaving({ to });
      edit.requestCancel();
    }
  };

  const doResubmit = () => {
    if (!instance) return;
    const outcome = resubmit(instance.id, user);
    toast.show(
      outcome.ok ? outcome.message : { message: outcome.error, tone: 'error', durationMs: 8000 },
    );
  };

  return (
    <SheetFrame label={`${name}, record`} onClose={close}>
      {/* three columns, so that the search box is in the middle of the sheet whatever the name is */}
      <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-4 border-b border-line pr-3 pl-6 max-lg:flex max-lg:h-auto max-lg:flex-wrap max-lg:gap-y-2 max-lg:py-2">
        <div className="flex min-w-0 items-center gap-3 max-lg:w-full">
          <h2 className="truncate text-[20px] leading-7 font-bold text-ink" title={name}>
            {name}
          </h2>
          <span className="shrink-0">
            <StatusChip status={listStatusOf(application.status)} />
          </span>
        </div>
        <div className="w-[clamp(180px,22vw,280px)] max-lg:w-auto max-lg:min-w-[140px] max-lg:flex-1">
          <SearchInput
            size="md"
            label="Search the fields of this tab"
            placeholder="Search"
            value={query}
            onChange={setQuery}
            className="max-w-none min-w-0!"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 justify-self-end max-lg:ml-auto">
          {edit.active ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                className={HEADER_BUTTON}
                onClick={edit.requestCancel}
              >
                Cancel
              </Button>
              <Button size="sm" className={HEADER_BUTTON} onClick={save}>
                Save changes
              </Button>
            </>
          ) : (
            <>
              {editing.allowed ? (
                <Button
                  ref={editButton}
                  variant="outline"
                  size="sm"
                  className={`${HEADER_BUTTON} border-primary-border bg-view-toggle-on! text-view-toggle-ink hover:bg-primary-100!`}
                  onClick={edit.start}
                >
                  <EditIcon size={14} />
                  Edit
                </Button>
              ) : (
                <Tooltip text={editing.reason}>
                  {(describedBy) => (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-disabled
                      aria-describedby={describedBy}
                      className={`${HEADER_BUTTON} cursor-not-allowed border-primary-border bg-view-toggle-on! text-view-toggle-ink opacity-50 hover:bg-view-toggle-on!`}
                    >
                      <EditIcon size={14} />
                      Edit
                    </Button>
                  )}
                </Tooltip>
              )}
              {canResubmit ? (
                <Button size="sm" className={HEADER_BUTTON} onClick={doResubmit}>
                  Resubmit for approval
                </Button>
              ) : null}
            </>
          )}
          {access.instance ? (
            <Link
              ref={workflowLink}
              to={reviewPath(access.instance.id)}
              onClick={(event) => guardLeave(event, reviewPath(access.instance!.id))}
              className="inline-flex h-8 items-center justify-center rounded-field border border-primary-border bg-white px-3 text-button-s whitespace-nowrap text-primary hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              View workflow
            </Link>
          ) : (
            <Tooltip text={access.reason}>
              {(describedBy) => (
                <Button
                  variant="outline"
                  size="sm"
                  aria-disabled
                  aria-describedby={describedBy}
                  className={`${HEADER_BUTTON} cursor-not-allowed opacity-50 hover:bg-white!`}
                >
                  View workflow
                </Button>
              )}
            </Tooltip>
          )}
          <CloseButton onClose={close} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* the row of the tabs: the title bar of the side panel is in the same row, and the rail starts under it */}
          <div className="shrink-0 border-b border-line bg-table-head px-6">
            {/* seven tabs with their error dots do not fit beside the side panel at 1024px: the row scrolls (the bar of the selected tab still covers the hairline) */}
            <div className="thin-scrollbar -mb-px overflow-x-auto overflow-y-hidden pb-px">
              <Tabs
                tabs={SHEET_TABS.map((t) => ({
                  id: t.id,
                  label: t.label,
                  alert: edit.tabsInError.includes(t.id),
                }))}
                value={current.id}
                onChange={(id) => onTabChange(id as SheetTabId)}
                label="Record sections"
                idPrefix={PREFIX}
                flush
              />
            </div>
          </div>
          {/* outside the panel that is made again for each tab: a rejected banner is read out once, not at every tab */}
          {banner ? (
            <div className="shrink-0 px-8 pt-4">
              <InlineBanner variant={banner.variant} title={banner.title}>
                {banner.message ? (
                  <p className="[overflow-wrap:anywhere] whitespace-pre-line">{banner.message}</p>
                ) : null}
              </InlineBanner>
            </div>
          ) : null}
          {edit.tabsInError.length > 0 || edit.filesNeedAttention ? (
            <div className="shrink-0 px-8 pt-4">
              <InlineBanner variant="error" title="The changes were not saved">
                <p>{issueSummary(edit.issues)}. Fix them and save again.</p>
              </InlineBanner>
            </div>
          ) : null}
          {edit.kycFailure ? (
            <div className="shrink-0 px-8 pt-4">
              <InlineBanner variant="error" title="KYC result: Fail. The changes were not saved">
                <ul className="list-disc pl-5">
                  {edit.kycFailure.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-1">Correct the identity fields and save again.</p>
              </InlineBanner>
            </div>
          ) : null}
          {edit.saveError ? (
            <div className="shrink-0 px-8 pt-4">
              <InlineBanner variant="error" title="The changes were not saved">
                <p>{edit.saveError}</p>
              </InlineBanner>
            </div>
          ) : null}
          {/* what the search found, for a screen reader; kept in place so that a change is announced */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {searchResult(query, shownCount, resultCount)}
          </div>
          <div
            {...tabPanelProps(PREFIX, current.id)}
            // `relative` keeps the visually hidden text inside the scrolling area; a new tab starts at the top
            key={current.id}
            className="thin-scrollbar @container relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            <h3 className="px-6 pt-4 text-[14px] leading-5 font-bold text-subtle">
              {current.heading}
            </h3>
            {edit.active ? (
              <EditFields
                items={items}
                query={query}
                working={edit.working}
                errors={edit.errors}
                aadhaarChanging={edit.aadhaarChanging}
                onChange={edit.change}
                onBlur={edit.blur}
                onChangeAadhaar={() => {
                  // the button that was pressed goes: the cursor goes to the input that takes its place
                  focusRequest.current = SCHEMA_FIELDS.get('aadhaar') ?? null;
                  edit.changeAadhaar();
                }}
              />
            ) : shown.length > 0 ? (
              <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-8 px-8 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4">
                {shown.map((field) => (
                  <FieldItem key={field.id} field={field} />
                ))}
              </dl>
            ) : (
              <p className="mt-7 px-8 text-body-m [overflow-wrap:anywhere] text-subtle">
                No field of this tab has “{query.trim()}” in its label or value.
              </p>
            )}
          </div>
        </div>
        <RecordSidePanel
          key={applicationId}
          application={application}
          edit={edit}
          tab={panelTab}
          open={panelOpen}
          onTabChange={setPanelTab}
          onOpenChange={setPanelOpen}
          focusDoc={focusDoc}
          onNavigate={guardLeave}
        />
      </div>

      <ConfirmDialog
        open={edit.step === 'discard'}
        title="Discard your changes?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          edit.discard();
          if (leaving?.to) navigate(leaving.to);
          else if (leaving) onClose();
        }}
        onCancel={() => {
          setLeaving(null);
          edit.keepEditing();
        }}
      >
        You have changes that are not saved. If you discard them, the record stays as it was.
      </ConfirmDialog>
      {edit.step === 'kyc' ? (
        <KycRerunDialog
          application={edit.working}
          onContinue={edit.kycDone}
          onFail={edit.kycFailed}
          onStop={edit.kycStopped}
        />
      ) : null}
      {edit.step === 'reason' ? (
        <ReasonDialog onSave={edit.reasonDone} onCancel={edit.reasonCancelled} />
      ) : null}
    </SheetFrame>
  );
}
