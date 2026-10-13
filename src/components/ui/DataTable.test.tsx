import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import DataTable, { type Column, type SortState } from './DataTable';

interface Person {
  id: string;
  name: string;
  city: string;
}

const PEOPLE: Person[] = [
  { id: 'a', name: 'Anita', city: 'Gokak' },
  { id: 'b', name: 'Basavaraj', city: 'Athani' },
  { id: 'c', name: 'Chetan', city: 'Belagavi' },
];

const COLUMNS: Column<Person>[] = [
  { id: 'name', header: 'Name', sortable: true, render: (p) => p.name },
  { id: 'city', header: 'City', width: '200px', render: (p) => p.city },
];

function Harness({ selectable = true, sort = null as SortState | null, onSort = () => {} }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <DataTable
      caption="People"
      columns={COLUMNS}
      rows={PEOPLE}
      rowKey={(p) => p.id}
      sort={sort}
      onSortChange={onSort}
      selection={
        selectable
          ? { selected, onChange: setSelected, rowLabel: (p) => `Select ${p.name}` }
          : undefined
      }
    />
  );
}

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

describe('DataTable', () => {
  it('is a table with a hidden caption, a header row and one row for each item', () => {
    render(<Harness />);
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      '',
      'Name',
      'City',
    ]);
    expect(bodyRows()).toHaveLength(3);
    expect(within(bodyRows()[1]).getByText('Athani')).toBeInTheDocument();
  });

  it('makes each row 48px high and the header 40px, as in the design', () => {
    render(<Harness />);
    expect(bodyRows()[0]).toHaveClass('h-12');
    expect(screen.getAllByRole('row')[0]).toHaveClass('h-10', 'bg-table-head');
  });

  it('gives a column the width it asks for, and the checkbox column 54px', () => {
    const { container } = render(<Harness />);
    const cols = Array.from(container.querySelectorAll('col')) as HTMLElement[];
    expect(cols.map((c) => c.style.width)).toEqual(['54px', '', '200px']);
  });

  it('has no checkbox column when there is no selection', () => {
    render(<Harness selectable={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });
});

describe('DataTable sorting', () => {
  it('turns the header of a sortable column into a button, and leaves the others as text', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Name' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'City' })).not.toBeInTheDocument();
  });

  it('asks the parent to sort when the header is pressed', () => {
    const onSort = vi.fn();
    render(<Harness onSort={onSort} />);
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('says how it is sorted with aria-sort, and "none" for a sortable column not in use', () => {
    const { rerender } = render(<Harness sort={null} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: 'City' })).not.toHaveAttribute('aria-sort');
    rerender(<Harness sort={{ id: 'name', dir: 'asc' }} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    rerender(<Harness sort={{ id: 'name', dir: 'desc' }} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
});

describe('DataTable selection', () => {
  it('names each checkbox after its row', () => {
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: 'Select Anita' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
  });

  it('selects a row, and highlights it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Basavaraj' }));
    expect(screen.getByRole('checkbox', { name: 'Select Basavaraj' })).toBeChecked();
    expect(bodyRows()[1]).toHaveClass('bg-primary-50');
    expect(bodyRows()[0]).not.toHaveClass('bg-primary-50');
  });

  it('shows "some" on the select-all box when part of the rows are selected', () => {
    render(<Harness />);
    const all = screen.getByRole('checkbox', { name: 'Select all rows' }) as HTMLInputElement;
    expect(all.indeterminate).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Anita' }));
    expect(all.indeterminate).toBe(true);
    expect(all).not.toBeChecked();
  });

  it('selects every row from the select-all box, and clears them again', () => {
    render(<Harness />);
    const all = screen.getByRole('checkbox', { name: 'Select all rows' }) as HTMLInputElement;
    fireEvent.click(all);
    expect(
      screen
        .getAllByRole('checkbox', { name: /^Select (?!all)/ })
        .every((c) => (c as HTMLInputElement).checked),
    ).toBe(true);
    expect(all).toBeChecked();
    expect(all.indeterminate).toBe(false);
    fireEvent.click(all);
    expect(screen.getByRole('checkbox', { name: 'Select Anita' })).not.toBeChecked();
  });

  it('finishes selecting when some are already selected', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Anita' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(screen.getByRole('checkbox', { name: 'Select Chetan' })).toBeChecked();
  });

  it('turns the select-all box off when there are no rows', () => {
    render(
      <DataTable
        caption="Empty"
        columns={COLUMNS}
        rows={[]}
        rowKey={(p) => p.id}
        sort={null}
        onSortChange={() => {}}
        selection={{ selected: new Set(), onChange: () => {}, rowLabel: (p) => p.name }}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeDisabled();
  });
});

describe('the files variant (the Files tables of the Workflow design)', () => {
  const columns: Column<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, render: (p) => p.name },
    { id: 'menu', header: 'Actions', headerHidden: true, render: () => '...' },
  ];
  const draw = (variant?: 'list' | 'files') =>
    render(
      <DataTable
        caption="People"
        columns={columns}
        rows={PEOPLE}
        rowKey={(p) => p.id}
        sort={null}
        onSortChange={() => {}}
        variant={variant}
      />,
    );

  it('has a 36px header with a hairline, medium 13px labels and 60px rows', () => {
    draw('files');
    const head = screen.getAllByRole('row')[0];
    expect(head).toHaveClass('h-9');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveClass(
      'border-b',
      'font-medium',
    );
    expect(screen.getAllByRole('row')[1]).toHaveClass('h-[60px]');
    expect(screen.getByRole('table')).toHaveClass('text-[13px]');
  });

  it('is the list look (40px header, semibold, 48px rows, 14px) by default', () => {
    draw();
    expect(screen.getAllByRole('row')[0]).toHaveClass('h-10');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveClass('font-semibold');
    expect(screen.getAllByRole('row')[1]).toHaveClass('h-12');
    expect(screen.getByRole('table')).toHaveClass('text-body-m');
  });

  it('keeps the name of a column whose header is not drawn, for screen readers', () => {
    draw('files');
    const header = screen.getByRole('columnheader', { name: 'Actions' });
    expect(within(header).getByText('Actions')).toHaveClass('sr-only');
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('DataTable box', () => {
  it('is its own positioning box, so that the hidden caption and header text cannot stretch the page', () => {
    const { container } = render(
      <DataTable
        caption="Things"
        columns={[{ id: 'a', header: 'A', render: (row: { id: string }) => row.id }]}
        rows={[{ id: '1' }]}
        rowKey={(row) => row.id}
        sort={null}
        onSortChange={() => {}}
      />,
    );
    expect(container.firstElementChild).toHaveClass('relative');
  });
});
