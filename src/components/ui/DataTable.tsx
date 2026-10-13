import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { SortIcon } from './icons';

export interface Column<T> {
  id: string;
  header: string;
  /** The header becomes a button that asks the parent to sort by this column */
  sortable?: boolean;
  /** CSS width. The column without one takes what is left. */
  width?: string;
  /** The header says nothing on screen (a column of menus) but keeps its name for screen readers */
  headerHidden?: boolean;
  render: (row: T) => ReactNode;
}

export interface SortState {
  id: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  /** What the table is, for screen readers (not drawn) */
  caption: string;
  columns: Column<T>[];
  /** Rows in the order to show: the parent sorts */
  rows: T[];
  rowKey: (row: T) => string;
  sort: SortState | null;
  onSortChange: (columnId: string) => void;
  /** Narrowest the table is drawn, in pixels; the page scrolls sideways below it. 760 by default. */
  minWidth?: number;
  /**
   * list: the master lists (header 40px, rows 48px, 14px text). files: the Files tables of the
   * Workflow design (header 36px with a hairline, rows 60px for a two-line cell, 13px text).
   */
  variant?: 'list' | 'files';
  /** Adds the checkbox column. `rowLabel` names each row's checkbox, for example "Select Ramesh Patil". */
  selection?: {
    selected: ReadonlySet<string>;
    onChange: (next: Set<string>) => void;
    rowLabel: (row: T) => string;
  };
}

const CELL = 'border-b border-line px-0 pr-4 align-middle';

const VARIANTS = {
  list: { table: 'text-body-m', headRow: 'h-10', headCell: 'font-semibold', row: 'h-12' },
  files: {
    table: 'text-[13px] leading-[18px]',
    headRow: 'h-9',
    headCell: 'border-b border-line font-medium',
    row: 'h-[60px]',
  },
} as const;

/**
 * The table of the master lists (Figma frame 5904:14434): a light blue-grey header row with bold
 * labels and sort arrows, rows 48px high with a hairline between them, an optional checkbox column.
 * The parent owns the rows, the sort and the selection; this only draws them.
 */
export default function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  minWidth = 760,
  variant = 'list',
  selection,
}: DataTableProps<T>) {
  const look = VARIANTS[variant];
  const allRef = useRef<HTMLInputElement>(null);
  const keys = rows.map(rowKey);
  const chosen = selection ? keys.filter((key) => selection.selected.has(key)).length : 0;
  const all = rows.length > 0 && chosen === rows.length;

  // "some but not all" has no HTML attribute: it is set on the element
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = chosen > 0 && !all;
  }, [chosen, all]);

  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const key of keys) {
      if (all) next.delete(key);
      else next.add(key);
    }
    selection.onChange(next);
  };

  const toggleOne = (key: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  };

  const last = columns.length - 1;

  return (
    // `relative` keeps the visually hidden caption inside this box, so it cannot stretch the page
    <div className="relative">
      <table
        style={{ minWidth }}
        className={`w-full table-fixed border-collapse text-left text-ink ${look.table}`}
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {selection ? <col style={{ width: 54 }} /> : null}
          {columns.map((column) => (
            <col key={column.id} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className={`${look.headRow} bg-table-head`}>
            {selection ? (
              <th scope="col" className="rounded-tl-lg pl-[19px] text-left">
                <input
                  ref={allRef}
                  type="checkbox"
                  className="table-checkbox"
                  aria-label="Select all rows"
                  checked={all}
                  disabled={rows.length === 0}
                  onChange={toggleAll}
                />
              </th>
            ) : null}
            {columns.map((column, index) => {
              const direction = sort?.id === column.id ? sort.dir : null;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? direction === 'asc'
                        ? 'ascending'
                        : direction === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                  className={`pr-4 text-left whitespace-nowrap text-label ${look.headCell} ${
                    index === last ? 'rounded-tr-lg' : ''
                  } ${!selection && index === 0 ? 'rounded-tl-lg pl-4' : ''}`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.id)}
                      className="inline-flex items-center gap-1.5 rounded font-[inherit] text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {column.header}
                      <SortIcon size={16} active={direction} className="text-subtle" />
                    </button>
                  ) : column.headerHidden ? (
                    <span className="sr-only">{column.header}</span>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const isSelected = selection?.selected.has(key) ?? false;
            return (
              <tr key={key} className={`${look.row} ${isSelected ? 'bg-primary-50' : ''}`}>
                {selection ? (
                  <td className="border-b border-line pl-[19px] align-middle">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      aria-label={selection.rowLabel(row)}
                      checked={isSelected}
                      onChange={() => toggleOne(key)}
                    />
                  </td>
                ) : null}
                {columns.map((column, index) => (
                  <td
                    key={column.id}
                    className={`${CELL} ${!selection && index === 0 ? 'pl-4' : ''}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
