import { Badge, Button } from '@/components/ui';
import { LockIcon } from '@/components/ui/icons';
import type { HomeLoanApplication } from '@/data/types';
import FieldRenderer from '@/features/home-loan/form/FieldRenderer';
import { fieldDomId, fieldId, type FieldSchema } from '@/features/home-loan/form/schema';
import { filterFields, formatFormValue } from './recordSheetModel';
import type { EditItem } from './editModel';

const SPAN = { one: '', two: 'col-span-2', row: 'col-span-full' } as const;

/** What the search looks at for an item: its label, and its value as text. */
function searchable(item: EditItem, working: HomeLoanApplication) {
  return item.kind === 'field'
    ? { label: item.field.label, value: formatFormValue(item.field, working) }
    : { label: item.label, value: item.value };
}

/** A field that cannot be changed, drawn like an input that is switched off, with a padlock and its reason. */
function LockedField({ item }: { item: Extract<EditItem, { kind: 'locked' }> }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-link-s text-label">{item.label}</span>
      <div className="flex min-h-10 items-center justify-between gap-2 rounded-field border border-field-border bg-field-disabled px-3 py-2 text-body-m text-subtle">
        <span className="min-w-0 [overflow-wrap:anywhere] whitespace-pre-line">
          {item.value === '' ? (
            <>
              <span aria-hidden>-</span>
              <span className="sr-only">Not provided</span>
            </>
          ) : item.badge ? (
            <Badge tone={item.badge}>{item.value}</Badge>
          ) : (
            item.value
          )}
        </span>
        <LockIcon size={16} className="shrink-0 text-muted" />
      </div>
      <p className="flex items-center gap-1 text-xs leading-4 text-subtle">
        <LockIcon size={12} className="shrink-0" />
        <span>
          <span className="sr-only">{item.label} is locked. </span>
          {item.hint}
        </span>
      </p>
    </div>
  );
}

/**
 * The Aadhaar of a saved record is masked, so it is shown as it is kept, with a button that clears it
 * to an input: the full number is never in the page unless it is typed.
 */
function AadhaarLocked({ value, onChange }: { value: string; onChange: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span id="record-aadhaar-label" className="text-link-s text-label">
        Aadhaar
        <span aria-hidden className="text-error-text">
          *
        </span>
      </span>
      <output
        aria-labelledby="record-aadhaar-label"
        className="flex min-h-10 items-center rounded-field border border-field-border bg-field-disabled px-3 py-2 text-body-m whitespace-nowrap text-ink"
      >
        {value || 'Not entered'}
      </output>
      <div>
        <Button variant="secondary" size="sm" onClick={onChange}>
          Change Aadhaar
        </Button>
      </div>
      <p className="text-xs leading-4 text-subtle">The number is kept masked.</p>
    </div>
  );
}

/**
 * The fields of a tab as inputs, in the grid of the view: the form's own renderer for each field of
 * the form, so the controls, the labels, the helper text and the error messages are the form's.
 */
export default function EditFields({
  items,
  query,
  working,
  errors,
  aadhaarChanging,
  onChange,
  onBlur,
  onChangeAadhaar,
}: {
  items: EditItem[];
  query: string;
  working: HomeLoanApplication;
  /** Error text by field id */
  errors: Record<string, string>;
  aadhaarChanging: boolean;
  onChange: (field: FieldSchema, raw: string) => void;
  onBlur: (field: FieldSchema) => void;
  onChangeAadhaar: () => void;
}) {
  const shown = filterFields(
    items.map((item) => ({ item, ...searchable(item, working) })),
    query,
  ).map((row) => row.item);
  if (shown.length === 0) {
    return (
      <p className="mt-7 px-8 text-body-m [overflow-wrap:anywhere] text-subtle">
        No field of this tab has “{query.trim()}” in its label or value.
      </p>
    );
  }
  return (
    <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-8 px-8 @3xl:grid-cols-3 @6xl:grid-cols-4">
      {shown.map((item) =>
        item.kind === 'locked' ? (
          <div key={item.id} className={`min-w-0 ${SPAN[item.wide]}`}>
            <LockedField item={item} />
          </div>
        ) : (
          <div
            key={item.id}
            id={`wrap-${fieldDomId(item.field)}`}
            className={`min-w-0 ${SPAN[item.wide]}`}
          >
            {item.field.mask === 'aadhaar' && !aadhaarChanging ? (
              <AadhaarLocked value={working.aadhaar} onChange={onChangeAadhaar} />
            ) : (
              <FieldRenderer
                field={item.field}
                values={working}
                error={errors[fieldId(item.field)]}
                onChange={onChange}
                onBlur={onBlur}
                scenarioPrefill={false}
              />
            )}
          </div>
        ),
      )}
    </div>
  );
}
