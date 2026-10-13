import { fireEvent, render, screen } from '@testing-library/react';
import FileCell from './FileCell';
import { fileKindOf, fileTypeName, fileTypeShort } from './fileKind';
import FileTypeIcon from './FileTypeIcon';

describe('fileKindOf and fileTypeName', () => {
  it('calls a PDF a PDF, and the pictures pictures', () => {
    expect(fileKindOf('application/pdf')).toBe('pdf');
    expect(fileKindOf('image/jpeg')).toBe('image');
    expect(fileKindOf('image/png')).toBe('image');
  });

  it('treats a type it does not know as a picture, and names it File', () => {
    expect(fileKindOf('application/zip')).toBe('image');
    expect(fileTypeName('application/zip')).toBe('File');
  });

  it('names the three types a person can upload', () => {
    expect(fileTypeName('application/pdf')).toBe('PDF document');
    expect(fileTypeName('image/jpeg')).toBe('JPEG image');
    expect(fileTypeName('image/png')).toBe('PNG image');
  });
});

describe('fileTypeShort', () => {
  it('gives the short name drawn under a thumbnail', () => {
    expect(fileTypeShort('application/pdf')).toBe('PDF');
    expect(fileTypeShort('image/jpeg')).toBe('JPG');
    expect(fileTypeShort('image/png')).toBe('PNG');
    expect(fileTypeShort('application/zip')).toBe('FILE');
  });
});

describe('FileTypeIcon', () => {
  it('is hidden from screen readers: the name is always next to it', () => {
    const { container } = render(<FileTypeIcon kind="pdf" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the PDF label on a PDF, and none on a picture', () => {
    const { container, rerender } = render(<FileTypeIcon kind="pdf" />);
    expect(container.querySelector('text')?.textContent).toBe('PDF');
    rerender(<FileTypeIcon kind="image" />);
    expect(container.querySelector('text')).toBeNull();
  });

  it('is as high as asked and a little narrower', () => {
    const { container } = render(<FileTypeIcon kind="pdf" size={28} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('height', '28');
    expect(Number(svg.getAttribute('width'))).toBeCloseTo(24.1, 1);
  });
});

describe('FileCell', () => {
  it('has the icon, the name in bold and the muted line under it', () => {
    const { container } = render(
      <FileCell
        fileName="PAN_Card_Ramesh_Patil.pdf"
        mimeType="application/pdf"
        subline="Priya Kulkarni · 9 Oct 2026, 6:23 PM"
      />,
    );
    expect(screen.getByText('PAN_Card_Ramesh_Patil.pdf')).toHaveClass('font-semibold');
    expect(screen.getByText('Priya Kulkarni · 9 Oct 2026, 6:23 PM')).toHaveClass('text-subtle');
    expect(container.querySelector('svg text')?.textContent).toBe('PDF');
  });

  it('gives a picture the picture icon', () => {
    const { container } = render(
      <FileCell fileName="Photo.jpg" mimeType="image/jpeg" subline="Priya Kulkarni" />,
    );
    expect(container.querySelector('svg text')).toBeNull();
  });

  it('keeps a long name on one line, and puts the whole name in the tooltip', () => {
    const name = 'Address_Proof_Electricity_Bill_Ramesh_Patil_September_2026.pdf';
    render(<FileCell fileName={name} mimeType="application/pdf" subline="x" />);
    const line = screen.getByText(name);
    expect(line).toHaveClass('truncate');
    expect(line).toHaveAttribute('title', name);
  });
});

describe('FileCell with onOpen', () => {
  it('makes the name a button that opens the file', () => {
    const onOpen = vi.fn();
    render(
      <FileCell fileName="A.pdf" mimeType="application/pdf" subline="Priya" onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'A.pdf' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('leaves the name as plain text without onOpen', () => {
    render(<FileCell fileName="A.pdf" mimeType="application/pdf" subline="Priya" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('A.pdf')).toBeInTheDocument();
  });
});
