import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDialog,
  FileTypeIcon,
  Modal,
  fileKindOf,
  fileTypeName,
  useToast,
} from '@/components/ui';
import { PaperclipIcon } from '@/components/ui/icons';
import { maskAadhaarInText } from '@/data/aadhaar';
import { MAX_NOTE_LENGTH, validateAttachmentFile } from '@/data/attachments';
import { useAppStore, useCurrentUser } from '@/data/store';
import type { ApplicationDocument, DocType, HomeLoanApplication } from '@/data/types';
import FilePreviewModal, { type PreviewFile } from '@/features/files/FilePreviewModal';
import FileRowMenu, { type FileMenuItem } from '@/features/files/FileRowMenu';
import FileStatusBadge from '@/features/files/FileStatusBadge';
import { folderLink } from '@/features/files/filesPageModel';
import { formatFileSize } from '@/lib/format';
import type { RecordEdit } from '../useRecordEdit';
import {
  attachmentRows,
  documentControlId,
  documentCounts,
  documentRows,
  downloadMock,
  previewOfDocument,
  type AttachmentRow,
  type DocumentRow,
} from './filesPanelModel';

/** The button that adds an attachment: where the cursor goes when the row it was on is gone */
const ATTACH_BUTTON_ID = 'record-attach-button';

const ACCEPT_DOCUMENT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const ACCEPT_ATTACHMENT = `${ACCEPT_DOCUMENT},.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document`;

/** A small count beside the title of a group. */
function Count({ children, label }: { children: string; label: string }) {
  return (
    <span
      aria-label={label}
      className="rounded-full bg-white px-2 text-[11px] leading-[18px] font-semibold text-label ring-1 ring-line"
    >
      {children}
    </span>
  );
}

function GroupHeader({
  title,
  count,
  countLabel,
  children,
}: {
  title: string;
  count: string;
  countLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 border-b border-line bg-table-head px-4 py-1.5">
      <h4 className="flex items-center gap-2 text-[13px] leading-5 font-bold text-ink">
        {title}
        <Count label={countLabel}>{count}</Count>
      </h4>
      {children}
    </div>
  );
}

/** The folder of a file, as a link into Files & Folders. */
function FolderLink({
  folderId,
  label,
  path,
  onNavigate,
}: {
  folderId: string;
  label: string;
  path: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, to: string) => void;
}) {
  const to = folderLink(folderId);
  return (
    <Link
      to={to}
      title={path}
      aria-label={`Open the folder ${path} in Files & Folders`}
      onClick={(event) => onNavigate(event, to)}
      className="block truncate rounded text-[12px] leading-4 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      {label}
    </Link>
  );
}

/**
 * The Files and Attachments tab of the side panel (the record sheet). Two groups: the documents of
 * the form, one row for each (a status, where the file is now as a link into Files & Folders, and a
 * menu: Preview and Download, and in edit mode Replace and Remove), and the other attachments that
 * were added with "Attach file". Replacing or removing a document is part of the edit: it is saved
 * with Save changes. An attachment is added or removed at once and writes its own audit event.
 */
export default function FilesPanel({
  application,
  edit,
  focusDoc,
  onNavigate,
}: {
  /** The record as it is in the store */
  application: HomeLoanApplication;
  edit: RecordEdit;
  /** A required document that Save found missing: its control takes the cursor (each request is new) */
  focusDoc: { docType: string; n: number } | null;
  /** A link into Files & Folders was pressed (the sheet asks about unsaved changes first) */
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, to: string) => void;
}) {
  const user = useCurrentUser();
  const toast = useToast();
  const addAttachment = useAppStore((state) => state.addAttachment);
  const removeAttachment = useAppStore((state) => state.removeAttachment);

  // the documents are those of the working copy while editing, the attachments always those of the store
  // (the folders are those of the record as saved: an unsaved name or branch has no folder yet)
  const documents = documentRows(edit.active ? edit.working : application, application);
  const attachments = attachmentRows(application, user);
  const counts = documentCounts(documents);

  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 });
  const announce = (text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 }));
  // what was said about a row belongs to one edit: it goes when the edit ends (saved or discarded)
  const [wasEditing, setWasEditing] = useState(edit.active);
  if (wasEditing !== edit.active) {
    setWasEditing(edit.active);
    setNotes({});
    setAnnouncement((current) => ({ text: '', n: current.n + 1 }));
  }
  const [attachError, setAttachError] = useState('');
  const [chosen, setChosen] = useState<File | null>(null);
  const [removing, setRemoving] = useState<AttachmentRow | null>(null);
  const replaceTarget = useRef<DocType | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);

  // a required document that Save found missing takes the cursor
  useEffect(() => {
    if (focusDoc) document.getElementById(documentControlId(focusDoc.docType))?.focus();
  }, [focusDoc]);

  // the control that was pressed goes with its row: the cursor is put on one that stays
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    if (refocus.current) document.getElementById(refocus.current)?.focus();
    refocus.current = null;
  });

  const say = (docType: string, text: string) => {
    setNotes((current) => ({ ...current, [docType]: text }));
    announce(text);
  };

  const chooseFor = (docType: DocType) => {
    replaceTarget.current = docType;
    replaceInput.current?.click();
  };

  const onReplaceChosen = (files: FileList | null) => {
    const file = files?.[0];
    const docType = replaceTarget.current;
    if (replaceInput.current) replaceInput.current.value = '';
    if (!file || !docType) return;
    const previewUrl =
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined;
    const error = edit.replaceDocument(docType, {
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl,
    });
    if (error) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      say(docType, error);
    } else {
      say(
        docType,
        `${maskAadhaarInText(file.name)} will replace the file when the changes are saved`,
      );
      // an Upload button turns into the menu of the file: the cursor stays on that row
      refocus.current = documentControlId(docType);
    }
  };

  const onAttachChosen = (files: FileList | null) => {
    const file = files?.[0];
    if (attachInput.current) attachInput.current.value = '';
    if (!file) return;
    const error = validateAttachmentFile({ name: file.name, size: file.size, type: file.type });
    if (error) {
      setAttachError(error);
      announce(error);
      return;
    }
    setAttachError('');
    setChosen(file);
  };

  const download = (doc: ApplicationDocument) => {
    const done = downloadMock(doc);
    toast.show(
      done
        ? { message: `Downloaded a placeholder for ${doc.fileName}` }
        : { message: 'Download is not available in this browser', tone: 'error' },
    );
  };

  const baseItems = (doc: ApplicationDocument): FileMenuItem[] => [
    { label: 'Preview', onSelect: () => setPreview(previewOfDocument(application, doc)) },
    { label: 'Download', onSelect: () => download(doc) },
  ];

  const issueFor = (docType: string): string | undefined => {
    const issue = edit.issues.find((i) => i.tab === 'files' && i.field.docType === docType);
    return issue ? edit.errors[issue.fieldId] : undefined;
  };

  const renderDocument = (row: DocumentRow) => {
    const changed = edit.documentChanges.find((c) => c.docType === row.docType);
    const note = notes[row.docType];
    const error = issueFor(row.docType);
    const id = documentControlId(row.docType);
    if (!row.doc || !row.place) {
      return (
        <li key={row.docType} className="border-b border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-[30px] w-[26px] shrink-0 items-center justify-center rounded border border-dashed border-field-border text-muted"
            >
              <PaperclipIcon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-[18px] font-semibold text-ink">{row.docType}</p>
              <p className="text-[12px] leading-4 text-subtle">
                Not uploaded{row.required ? ', required' : ''}
              </p>
            </div>
            {edit.active ? (
              <Button
                id={id}
                variant="secondary"
                size="sm"
                className="h-8 shrink-0 px-3"
                aria-label={`Upload ${row.docType}`}
                onClick={() => chooseFor(row.docType as DocType)}
              >
                Upload
              </Button>
            ) : (
              <Badge tone="neutral">Missing</Badge>
            )}
          </div>
          {error ? (
            <p role="alert" className="mt-1.5 pl-[38px] text-[12px] leading-4 text-error-text">
              {error}
            </p>
          ) : null}
          {note ? (
            <p className="mt-1.5 pl-[38px] text-[12px] leading-4 text-subtle">{note}</p>
          ) : null}
        </li>
      );
    }
    const doc = row.doc;
    const items: FileMenuItem[] = [
      ...baseItems(doc),
      ...(edit.active
        ? [
            { label: 'Replace', onSelect: () => chooseFor(row.docType as DocType) },
            {
              label: 'Remove',
              onSelect: () => {
                const refusal = edit.removeDocument(row.docType as DocType);
                say(
                  row.docType,
                  refusal ?? `${doc.fileName} will be removed when the changes are saved`,
                );
                // the row of a document that goes has no menu any more
                refocus.current = refusal ? documentControlId(row.docType) : ATTACH_BUTTON_ID;
              },
            },
          ]
        : []),
    ];
    return (
      <li key={row.docType} className="border-b border-line px-4 py-3">
        <div className="flex items-start gap-3">
          <FileTypeIcon kind={fileKindOf(doc.mimeType)} size={30} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold text-ink">
              <span title={doc.fileName} className="min-w-0 truncate">
                {doc.fileName}
              </span>
              <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-chip-version-bg px-2 text-[11px] leading-[18px] font-semibold text-chip-version-text">
                {doc.version ?? 'v1.0'}
              </span>
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 text-subtle">
              <span>{row.docType}</span>
              {row.status ? <FileStatusBadge status={row.status} showFiled="chip" /> : null}
            </p>
            <div className="mt-1">
              <FolderLink
                folderId={row.place.folderId}
                label={row.place.folderLabel}
                path={row.place.folderPath}
                onNavigate={onNavigate}
              />
            </div>
          </div>
          <FileRowMenu fileName={doc.fileName} items={items} triggerId={id} />
        </div>
        {changed ? (
          <p className="mt-1.5 pl-[42px] text-[12px] leading-4 font-medium text-primary">
            {changed.kind === 'replaced'
              ? `New version ${changed.version}, not saved yet`
              : 'New file, not saved yet'}
          </p>
        ) : null}
        {note ? (
          <p role="status" className="mt-1.5 pl-[42px] text-[12px] leading-4 text-subtle">
            {note}
          </p>
        ) : null}
      </li>
    );
  };

  const renderAttachment = (row: AttachmentRow) => {
    const { doc } = row;
    const items: FileMenuItem[] = [
      ...baseItems(doc),
      ...(row.canRemove ? [{ label: 'Remove', onSelect: () => setRemoving(row) }] : []),
    ];
    return (
      <li key={doc.id} className="border-b border-line px-4 py-3">
        <div className="flex items-start gap-3">
          <FileTypeIcon kind={fileKindOf(doc.mimeType)} size={30} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p
              title={doc.fileName}
              className="truncate text-[13px] leading-[18px] font-semibold text-ink"
            >
              {doc.fileName}
            </p>
            {doc.note ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 [overflow-wrap:anywhere] text-subtle">
                {doc.note}
              </p>
            ) : null}
            <p className="mt-0.5 text-[12px] leading-4 text-subtle">
              <span className="[overflow-wrap:anywhere]">{row.subline}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <FolderLink
                folderId={row.place.folderId}
                label={row.place.folderLabel}
                path={row.place.folderPath}
                onNavigate={onNavigate}
              />
              <FileStatusBadge status={row.status} showFiled="chip" />
            </div>
          </div>
          <FileRowMenu fileName={doc.fileName} items={items} />
        </div>
      </li>
    );
  };

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-14">
      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT_DOCUMENT}
        tabIndex={-1}
        aria-hidden
        className="hidden"
        data-testid="record-replace-input"
        onChange={(event) => onReplaceChosen(event.target.files)}
      />
      <input
        ref={attachInput}
        type="file"
        accept={ACCEPT_ATTACHMENT}
        tabIndex={-1}
        aria-hidden
        className="hidden"
        data-testid="record-attach-input"
        onChange={(event) => onAttachChosen(event.target.files)}
      />

      <section aria-label="Application documents">
        <GroupHeader
          title="Application documents"
          count={
            counts.uploaded === counts.total
              ? String(counts.total)
              : `${counts.uploaded} of ${counts.total}`
          }
          countLabel={`${counts.uploaded} of ${counts.total} documents uploaded`}
        />
        <ul aria-label="Documents of the application">{documents.map(renderDocument)}</ul>
      </section>

      <section aria-label="Other attachments">
        <GroupHeader
          title="Other attachments"
          count={String(attachments.length)}
          countLabel={`${attachments.length} ${attachments.length === 1 ? 'attachment' : 'attachments'}`}
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 px-3"
            id={ATTACH_BUTTON_ID}
            onClick={() => attachInput.current?.click()}
          >
            <PaperclipIcon size={14} />
            Attach file
          </Button>
        </GroupHeader>
        {attachError ? (
          <p
            role="alert"
            className="border-b border-line px-4 py-2 text-[12px] leading-4 text-error-text"
          >
            {attachError}
          </p>
        ) : null}
        {attachments.length > 0 ? (
          <ul aria-label="Attachments">{attachments.map(renderAttachment)}</ul>
        ) : (
          <div className="px-6 py-8 text-center">
            <p className="text-body-m font-semibold text-label">No attachments yet</p>
            <p className="mt-1 text-[13px] leading-5 text-subtle">
              Attach salary slips, a bill or a statement with Attach file. PDF, JPG, PNG or DOCX, up
              to 5 MB.
            </p>
          </div>
        )}
      </section>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={announcement.n}>{announcement.text}</span>
      </div>

      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />

      {chosen ? (
        <AttachDialog
          file={chosen}
          onCancel={() => setChosen(null)}
          onAttach={(note) => {
            const previewUrl =
              typeof URL.createObjectURL === 'function' ? URL.createObjectURL(chosen) : undefined;
            const outcome = addAttachment(
              application.applicationId,
              { name: chosen.name, size: chosen.size, type: chosen.type, previewUrl },
              note,
            );
            if (!outcome.ok) {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              return outcome.error;
            }
            setChosen(null);
            const shown = maskAadhaarInText(chosen.name);
            toast.show(`Attached ${shown}`);
            announce(`${shown} attached`);
            refocus.current = ATTACH_BUTTON_ID;
            return null;
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this attachment?"
        confirmLabel="Remove attachment"
        cancelLabel="Keep attachment"
        danger
        onConfirm={() => {
          const row = removing;
          setRemoving(null);
          if (!row) return;
          const outcome = removeAttachment(application.applicationId, row.doc.id);
          if (outcome.ok) {
            toast.show(`Removed ${row.doc.fileName}`);
            announce(`${row.doc.fileName} removed`);
            // the row of the attachment is gone, and with it the button that opened the question
            refocus.current = ATTACH_BUTTON_ID;
          } else {
            toast.show({ message: outcome.error, tone: 'error', durationMs: 8000 });
          }
        }}
        onCancel={() => setRemoving(null)}
      >
        <span className="[overflow-wrap:anywhere]">{removing?.doc.fileName}</span> is taken off this
        application and out of its folder in Files &amp; Folders. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}

/** The small dialog after a file is chosen: what it is, and a note that is optional. */
function AttachDialog({
  file,
  onCancel,
  onAttach,
}: {
  file: File;
  onCancel: () => void;
  /** Gives the error text when it cannot be attached */
  onAttach: (note: string) => string | null;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const kind = file.type || 'application/octet-stream';
  // an Aadhaar number in the name of the file is masked here too, before anything is kept
  const shownName = maskAadhaarInText(file.name);
  return (
    <Modal
      open
      title="Attach file"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const problem = onAttach(note);
              if (problem) setError(problem);
            }}
          >
            Attach
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <FileTypeIcon kind={fileKindOf(kind)} size={36} className="shrink-0" />
          <div className="min-w-0">
            <p title={shownName} className="truncate text-body-m font-semibold text-ink">
              {shownName}
            </p>
            <p className="text-[12px] leading-4 text-subtle">
              {fileTypeName(kind)} &middot; {formatFileSize(file.size)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="record-attach-note" className="text-link-s text-label">
            Note (optional)
          </label>
          <textarea
            id="record-attach-note"
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="What is this file? For example: September salary slip"
            onChange={(event) => {
              setNote(event.target.value);
              if (error) setError('');
            }}
            className="block w-full resize-none rounded-field border border-field-border bg-white px-3 py-2 text-body-m text-ink outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-right text-[12px] leading-4 text-subtle">
            {note.length} of {MAX_NOTE_LENGTH}
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-[13px] leading-5 text-error-text">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
