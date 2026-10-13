import { useEffect, useRef } from 'react';
import { formatFileSize } from '@/lib/format';
import Button from './Button';
import { FieldMessage } from './FormField';

export interface UploadedFile {
  name: string;
  sizeBytes: number;
  mimeType: string;
  /** Local preview link. When present the file name opens it in a new tab. */
  previewUrl?: string;
}

export interface FileUploadRowProps {
  /** Unique id; the message and the file input get ids built from it */
  id: string;
  /** What is being uploaded, for example the DocType name */
  label: string;
  required?: boolean;
  file?: UploadedFile;
  /** Red text under the row, for example when a file was rejected */
  error?: string;
  /** Types the file picker offers. The row does not check the file itself. */
  accept?: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

function UploadedFileIcon({ mimeType }: { mimeType: string }) {
  const isPdf = mimeType === 'application/pdf';
  return (
    <span
      aria-hidden
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-bold ${
        isPdf ? 'bg-error/10 text-error-text' : 'bg-primary/10 text-primary'
      }`}
    >
      {isPdf ? (
        'PDF'
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      )}
    </span>
  );
}

/**
 * One upload slot. Not in the Figma form file: built from the same tokens, so it is provisional.
 * Shows the label (red asterisk when required) and either "No file chosen" with a Choose file
 * button, or the file's icon, name and size with Replace and Remove. Nothing is uploaded: the
 * parent decides what to do with the chosen File.
 */
export default function FileUploadRow({
  id,
  label,
  required,
  file,
  error,
  accept = DEFAULT_ACCEPT,
  disabled,
  onSelect,
  onRemove,
}: FileUploadRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const labelId = `${id}-label`;
  const requiredId = `${id}-required`;
  const messageId = error ? `${id}-message` : undefined;

  // The button that was pressed goes away when a file is chosen or removed. Put the cursor on its
  // replacement, so a keyboard user is not sent back to the top of the page.
  const hasFile = Boolean(file);
  const refocus = useRef(false);
  const hadFile = useRef(hasFile);
  useEffect(() => {
    const changed = hadFile.current !== hasFile;
    hadFile.current = hasFile;
    if (!refocus.current) return;
    refocus.current = false;
    if (changed) (hasFile ? replaceRef : chooseRef).current?.focus();
  });

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={required ? requiredId : undefined}
      className="flex flex-col gap-2"
    >
      <span id={labelId} className="text-link-s text-label">
        {label}
        {required ? (
          <span aria-hidden className="text-error-text">
            *
          </span>
        ) : null}
      </span>
      {required ? (
        <span id={requiredId} className="sr-only">
          Required
        </span>
      ) : null}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        aria-label={`${label} file`}
        aria-describedby={messageId}
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          e.target.value = ''; // so the same file can be picked again
          if (chosen) {
            refocus.current = true;
            onSelect(chosen);
          }
        }}
      />

      <div
        className={`flex min-h-12 items-center gap-3 rounded-field border bg-white px-3 py-2 ${
          error ? 'border-error' : 'border-field-border'
        } ${file ? '' : 'border-dashed'}`}
      >
        {file ? (
          <>
            <UploadedFileIcon mimeType={file.mimeType} />
            <div className="min-w-0 flex-1">
              {file.previewUrl ? (
                <a
                  title={file.name}
                  href={file.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-2 text-body-m [overflow-wrap:anywhere] text-primary hover:underline"
                >
                  {file.name}
                </a>
              ) : (
                <span
                  title={file.name}
                  className="line-clamp-2 text-body-m [overflow-wrap:anywhere] text-ink"
                >
                  {file.name}
                </span>
              )}
              <span className="block text-xs text-subtle">{formatFileSize(file.sizeBytes)}</span>
            </div>
            <Button
              ref={replaceRef}
              variant="secondary"
              size="sm"
              disabled={disabled}
              aria-label={`Replace ${label} file`}
              aria-describedby={messageId}
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              disabled={disabled}
              aria-label={`Remove ${label} file`}
              aria-describedby={messageId}
              onClick={() => {
                refocus.current = true;
                onRemove();
              }}
            >
              Remove
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-body-m text-subtle">No file chosen</span>
            <Button
              ref={chooseRef}
              variant="secondary"
              size="sm"
              disabled={disabled}
              aria-label={`Choose file for ${label}`}
              aria-describedby={messageId}
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
          </>
        )}
      </div>

      <FieldMessage id={id} error={error} />
    </div>
  );
}
