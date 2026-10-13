import { fireEvent, render, screen } from '@testing-library/react';
import FileUploadRow from './FileUploadRow';

const base = { id: 'doc-pan', label: 'PAN Card', onSelect: () => {}, onRemove: () => {} };
const pdf = { name: 'PAN_Card_Ramesh_Patil.pdf', sizeBytes: 184_320, mimeType: 'application/pdf' };

describe('FileUploadRow', () => {
  it('shows the label with a red asterisk when required, and an empty slot', () => {
    render(<FileUploadRow {...base} required />);
    expect(screen.getByText('PAN Card').textContent).toContain('*');
    expect(screen.getByText('No file chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose file for PAN Card' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Replace|Remove/ })).not.toBeInTheDocument();
  });

  it('offers only PDF, JPG and PNG in the file picker', () => {
    render(<FileUploadRow {...base} />);
    const accept = screen.getByLabelText('PAN Card file').getAttribute('accept');
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.jpg');
    expect(accept).toContain('.png');
    expect(accept).not.toContain('.txt');
  });

  it('shows the file name, size, a type icon, Replace and Remove', () => {
    render(<FileUploadRow {...base} file={pdf} />);
    expect(screen.getByText('PAN_Card_Ramesh_Patil.pdf')).toBeInTheDocument();
    expect(screen.getByText('180 KB')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace PAN Card file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove PAN Card file' })).toBeInTheDocument();
    expect(screen.queryByText('No file chosen')).not.toBeInTheDocument();
  });

  it('shows an image icon for a picture', () => {
    render(
      <FileUploadRow
        {...base}
        label="Photograph"
        file={{ name: 'Passport_Photo.jpg', sizeBytes: 98_304, mimeType: 'image/jpeg' }}
      />,
    );
    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
    expect(screen.getByText('96 KB')).toBeInTheDocument();
  });

  it('turns the file name into a preview link only when there is a preview URL', () => {
    const { rerender } = render(<FileUploadRow {...base} file={pdf} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    rerender(<FileUploadRow {...base} file={{ ...pdf, previewUrl: 'blob:abc' }} />);
    const link = screen.getByRole('link', { name: 'PAN_Card_Ramesh_Patil.pdf' });
    expect(link).toHaveAttribute('href', 'blob:abc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('hands the chosen file to onSelect', () => {
    const onSelect = vi.fn();
    render(<FileUploadRow {...base} onSelect={onSelect} />);
    const chosen = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('PAN Card file'), { target: { files: [chosen] } });
    expect(onSelect).toHaveBeenCalledWith(chosen);
  });

  it('Replace and Choose file open the same file picker', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    const { rerender } = render(<FileUploadRow {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose file for PAN Card' }));
    rerender(<FileUploadRow {...base} file={pdf} />);
    fireEvent.click(screen.getByRole('button', { name: 'Replace PAN Card file' }));
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });

  it('Remove calls onRemove', () => {
    const onRemove = vi.fn();
    render(<FileUploadRow {...base} file={pdf} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove PAN Card file' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows the error in red under the row', () => {
    render(<FileUploadRow {...base} error="Upload PDF, JPG or PNG up to 5 MB" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Upload PDF, JPG or PNG up to 5 MB');
    expect(screen.getByLabelText('PAN Card file')).toHaveAccessibleDescription(
      'Upload PDF, JPG or PNG up to 5 MB',
    );
  });

  it('cannot be used when disabled', () => {
    render(<FileUploadRow {...base} file={pdf} disabled />);
    expect(screen.getByRole('button', { name: 'Replace PAN Card file' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove PAN Card file' })).toBeDisabled();
  });
  describe('for a screen reader and the keyboard', () => {
    it('says that a required row is required, without changing its name', () => {
      render(<FileUploadRow {...base} required />);
      const group = screen.getByRole('group', { name: 'PAN Card' });
      expect(group).toHaveAccessibleDescription('Required');
    });

    it('says nothing about "required" for an optional row', () => {
      render(<FileUploadRow {...base} />);
      expect(screen.getByRole('group', { name: 'PAN Card' })).not.toHaveAccessibleDescription();
    });

    it('ties the error message to the buttons you can reach, not only the hidden input', () => {
      const { rerender } = render(<FileUploadRow {...base} error="File is too large" />);
      expect(
        screen.getByRole('button', { name: 'Choose file for PAN Card' }),
      ).toHaveAccessibleDescription('File is too large');
      rerender(<FileUploadRow {...base} file={pdf} error="File is too large" />);
      expect(
        screen.getByRole('button', { name: 'Replace PAN Card file' }),
      ).toHaveAccessibleDescription('File is too large');
      expect(
        screen.getByRole('button', { name: 'Remove PAN Card file' }),
      ).toHaveAccessibleDescription('File is too large');
    });

    it('moves the cursor to Replace after a file is chosen', () => {
      const { rerender } = render(<FileUploadRow {...base} />);
      const input = screen.getByLabelText('PAN Card file');
      fireEvent.change(input, {
        target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] },
      });
      rerender(<FileUploadRow {...base} file={pdf} />);
      expect(screen.getByRole('button', { name: 'Replace PAN Card file' })).toHaveFocus();
    });

    it('moves the cursor to Choose file after the file is removed', () => {
      const { rerender } = render(<FileUploadRow {...base} file={pdf} />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove PAN Card file' }));
      rerender(<FileUploadRow {...base} />);
      expect(screen.getByRole('button', { name: 'Choose file for PAN Card' })).toHaveFocus();
    });

    it('does not take the cursor when the file is changed from elsewhere', () => {
      const { rerender } = render(<FileUploadRow {...base} />);
      rerender(<FileUploadRow {...base} file={pdf} />);
      expect(screen.getByRole('button', { name: 'Replace PAN Card file' })).not.toHaveFocus();
    });

    it('does not take the cursor when a chosen file is turned down', () => {
      const { rerender } = render(<FileUploadRow {...base} />);
      fireEvent.change(screen.getByLabelText('PAN Card file'), {
        target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] },
      });
      rerender(<FileUploadRow {...base} error="Only PDF, JPG or PNG" />);
      // a later change from outside (for example a scenario fill) must not grab the cursor
      rerender(<FileUploadRow {...base} file={pdf} />);
      expect(screen.getByRole('button', { name: 'Replace PAN Card file' })).not.toHaveFocus();
    });
  });
});
