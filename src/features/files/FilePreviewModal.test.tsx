import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FileStatus } from '@/data/fileSystem';
import FilePreviewModal, { type PreviewFile } from './FilePreviewModal';

const PDF: PreviewFile = {
  fileName: 'PAN_Card_Ramesh_Patil.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 184320,
  docType: 'PAN Card',
  uploadedBy: 'Priya Kulkarni',
  uploadedAt: '2026-10-09T18:23:00+05:30',
};

describe('FilePreviewModal', () => {
  it('draws nothing while there is no file', () => {
    render(<FilePreviewModal file={null} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is named after the file and says what it is: type, size, DocType, who and when', () => {
    render(<FilePreviewModal file={PDF} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'PAN_Card_Ramesh_Patil.pdf' });
    const row = (label: string) => within(dialog).getByText(label).nextElementSibling;
    expect(row('Type')).toHaveTextContent('PDF document');
    expect(row('Size')).toHaveTextContent('180 KB');
    expect(row('DocType')).toHaveTextContent('PAN Card');
    expect(row('Uploaded by')).toHaveTextContent('Priya Kulkarni · 9 Oct 2026, 6:23 PM');
  });

  it('keeps the date and the time of the upload in one piece, so that "PM" is never alone on a line', () => {
    render(<FilePreviewModal file={PDF} onClose={() => {}} />);
    const when = screen.getByText('9 Oct 2026, 6:23 PM');
    expect(when.tagName).toBe('SPAN');
    expect(when).toHaveClass('whitespace-nowrap');
  });

  it('says that the preview is a mock, in a placeholder with its own name', () => {
    render(<FilePreviewModal file={PDF} onClose={() => {}} />);
    expect(
      screen.getByRole('img', { name: 'Placeholder for the preview of PAN_Card_Ramesh_Patil.pdf' }),
    ).toHaveTextContent('preview is mocked in this demo');
  });

  it('names the type of a picture', () => {
    render(
      <FilePreviewModal
        file={{ ...PDF, fileName: 'Photo.jpg', mimeType: 'image/jpeg' }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('JPEG image', { selector: 'dd' })).toBeInTheDocument();
    render(
      <FilePreviewModal
        file={{ ...PDF, fileName: 'Scan.png', mimeType: 'image/png' }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('PNG image', { selector: 'dd' })).toBeInTheDocument();
  });

  it('shows the folder only when it knows one', () => {
    const { rerender } = render(<FilePreviewModal file={PDF} onClose={() => {}} />);
    expect(screen.queryByText('Folder')).not.toBeInTheDocument();
    rerender(
      <FilePreviewModal
        file={{ ...PDF, folderPath: 'Loans / Home Loan / Pending Approval / HL-1 R / 01 KYC' }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Folder').nextElementSibling).toHaveTextContent(
      /^Loans \/ Home Loan \/ Pending Approval \/ HL-1 R \/ 01 KYC$/,
    );
  });

  it('says where the file stands, with the status of the file, and has no note about a planned place', () => {
    render(
      <FilePreviewModal
        file={{
          ...PDF,
          folderPath: 'Loans / Home Loan / Rejected / HL-1 R / 01 KYC',
          status: 'Rejected',
        }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Status').nextElementSibling).toHaveTextContent('Rejected');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Planned');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Not filed');
  });

  it('shows a dash for a size that is not a number', () => {
    render(<FilePreviewModal file={{ ...PDF, sizeBytes: Number.NaN }} onClose={() => {}} />);
    expect(screen.getByText('Size').nextElementSibling).toHaveTextContent('—');
  });

  it('closes with Close, with the cross and with Escape', () => {
    const onClose = vi.fn();
    render(<FilePreviewModal file={PDF} onClose={onClose} />);
    const buttons = within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('FilePreviewModal for a file of Files & Folders', () => {
  const FILED: PreviewFile = {
    ...PDF,
    applicationId: 'HL-2026-0001',
    applicantName: 'Vijay Kulkarni',
    status: FileStatus.Filed,
    recordHref: '/metadata/master/home-loan?record=HL-2026-0001',
    folderPath:
      'Loans / Home Loan / Belagavi Main Branch (demo) / HL-2026-0001 Vijay Kulkarni / 01 KYC',
  };
  const draw = (file: PreviewFile) =>
    render(
      <MemoryRouter>
        <FilePreviewModal file={file} onClose={() => {}} />
      </MemoryRouter>,
    );
  const row = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

  it('says the DocType, the linked application, the status and the folder', () => {
    draw(FILED);
    expect(row('DocType')).toHaveTextContent('PAN Card');
    expect(row('Linked application')).toHaveTextContent('HL-2026-0001 · Vijay Kulkarni');
    expect(row('Status')).toHaveTextContent('Filed');
    expect(row('Folder')).toHaveTextContent('Loans / Home Loan / Belagavi Main Branch (demo)');
  });

  it('has a View record link to the record of the application', () => {
    draw(FILED);
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: 'View record' });
    expect(link).toHaveAttribute('href', '/metadata/master/home-loan?record=HL-2026-0001');
  });

  it('shows a status that is not final as its badge', () => {
    draw({ ...FILED, status: FileStatus.PendingApproval });
    expect(within(row('Status') as HTMLElement).getByText('Pending approval')).toBeInTheDocument();
  });

  it('has no application row and no View record link for a file that belongs to no application', () => {
    draw({
      ...PDF,
      status: FileStatus.Filed,
      docType: '',
    });
    expect(screen.queryByText('Linked application')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View record' })).not.toBeInTheDocument();
    expect(row('DocType')).toHaveTextContent('—');
  });

  it('has no Status row when the screen gives no status (the review screen)', () => {
    draw(PDF);
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('keeps Close next to View record', () => {
    draw(FILED);
    const footer = within(screen.getByRole('dialog'));
    expect(footer.getByRole('link', { name: 'View record' })).toBeInTheDocument();
    expect(footer.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
  });
});
