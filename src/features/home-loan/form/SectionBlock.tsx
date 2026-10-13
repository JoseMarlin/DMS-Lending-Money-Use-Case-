import type { ReactNode } from 'react';
import { Accordion } from '@/components/ui';
import type { HomeLoanApplication } from '@/data/types';
import FieldRenderer from './FieldRenderer';
import { isFieldVisible } from './formState';
import {
  fieldDomId,
  fieldId,
  type FieldSchema,
  type FieldWidth,
  type SectionSchema,
} from './schema';

/** Columns taken by a field in the six-column grid (a third of the row is two columns). */
const SPAN: Record<FieldWidth, string> = {
  third: 'lg:col-span-2',
  half: 'lg:col-span-3',
  twoThirds: 'lg:col-span-4',
  full: 'lg:col-span-6',
};

interface SectionBlockProps {
  section: SectionSchema;
  values: HomeLoanApplication;
  /** Error text by field id (see fieldId) */
  errors?: Partial<Record<string, string>>;
  /** Whether the accordion is open. Default: open. */
  open?: boolean;
  onToggle?: () => void;
  /** Shown at the right of the header, for example "3 of 5 required" */
  summary?: ReactNode;
  onChange: (field: FieldSchema, raw: string) => void;
  /** The user left a field */
  onBlur?: (field: FieldSchema) => void;
  /** A file was chosen for an attachment field */
  onFileSelect?: (field: FieldSchema, file: File) => void;
  /** The file of an attachment field was removed */
  onFileRemove?: (field: FieldSchema) => void;
}

/**
 * One section of the form as an accordion: a header (the heading) and, when open, its visible
 * fields in a grid of three columns. A field can be wider (see `width` in the schema). When the
 * fields carry a `group`, a small heading is shown at the start of each group.
 */
export default function SectionBlock({
  section,
  values,
  errors,
  open = true,
  onToggle = () => {},
  summary,
  onChange,
  onBlur,
  onFileSelect,
  onFileRemove,
}: SectionBlockProps) {
  const visible = section.fields.filter((field) => isFieldVisible(field, values));
  if (visible.length === 0) return null;

  return (
    <Accordion
      id={`section-${section.id}`}
      headingLevel={2}
      title={section.title}
      summary={summary}
      open={open}
      onToggle={onToggle}
      panelClassName="px-4 py-4"
    >
      {section.note ? <p className="mb-4 text-sm text-subtle">{section.note}</p> : null}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 lg:grid-cols-6">
        {visible.map((field, index) => {
          const startsGroup = field.group && field.group !== visible[index - 1]?.group;
          return (
            <FieldCell
              key={fieldId(field)}
              field={field}
              heading={startsGroup ? field.group : undefined}
            >
              <FieldRenderer
                field={field}
                values={values}
                error={errors?.[fieldId(field)]}
                onChange={onChange}
                onBlur={onBlur}
                onFileSelect={onFileSelect}
                onFileRemove={onFileRemove}
              />
            </FieldCell>
          );
        })}
      </div>
    </Accordion>
  );
}

/** A grid cell for one field, preceded by a full-width group heading when a group starts here. */
function FieldCell({
  field,
  heading,
  children,
}: {
  field: FieldSchema;
  heading?: string;
  children: ReactNode;
}) {
  return (
    <>
      {heading ? (
        <h3 className="mt-1 border-b border-line pb-1 text-link-s tracking-wide text-label uppercase lg:col-span-6">
          {heading}
        </h3>
      ) : null}
      <div id={`wrap-${fieldDomId(field)}`} className={`min-w-0 ${SPAN[field.width ?? 'third']}`}>
        {children}
      </div>
    </>
  );
}
