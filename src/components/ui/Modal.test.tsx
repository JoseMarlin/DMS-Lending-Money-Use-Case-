import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import Modal from './Modal';

function Harness({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Modal
        open={open}
        title="Aadhaar OTP"
        onClose={() => setOpen(false)}
        footer={<button>Save</button>}
      >
        <input aria-label="OTP" />
        <p>Body text</p>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('shows nothing while closed', () => {
    render(<Harness initiallyOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a modal dialog named by its title, with its body and footer', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Aadhaar OTP' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Body text');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('is drawn over the page, above the demo controls', () => {
    render(<Harness />);
    // dialog > the centring wrapper > the scrolling overlay, which is a child of the body
    const overlay = screen.getByRole('dialog').parentElement!.parentElement!;
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.className).toContain('z-[10000]');
  });

  it('puts the cursor in the first field when it opens', () => {
    render(<Harness />);
    expect(screen.getByLabelText('OTP')).toHaveFocus();
  });

  it('closes with the close button, Escape and a click on the backdrop', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    const second = render(<Harness />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    second.unmount();

    render(<Harness />);
    const backdrop = screen.getByRole('dialog').previousElementSibling as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not close when the dialog itself is clicked', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Body text'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('gives the focus back to what had it before', () => {
    render(<Harness initiallyOpen={false} />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByLabelText('OTP')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(opener).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, input'));
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);

    focusable[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('keeps Shift+Tab inside when the cursor starts on the dialog itself (no field to start in)', () => {
    render(
      <>
        <button>Behind</button>
        <Modal open title="Preview" onClose={() => {}} footer={<button>Done</button>}>
          <p>Only text</p>
        </Modal>
      </>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
    const last = focusable[focusable.length - 1];
    expect(fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })).toBe(false); // handled
    expect(document.activeElement).toBe(last);
  });

  it('brings the cursor back into the dialog if Tab is pressed with it outside', () => {
    render(
      <>
        <button>Behind</button>
        <Modal open title="Preview" onClose={() => {}} footer={<button>Done</button>}>
          <p>Only text</p>
        </Modal>
      </>,
    );
    screen.getByRole('button', { name: 'Behind' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('button'));
  });

  it('scrolls as a whole when the window is shorter than the dialog', () => {
    render(<Harness />);
    const overlay = screen.getByRole('dialog').parentElement!.parentElement!;
    expect(overlay).toHaveClass('overflow-y-auto');
    expect(screen.getByRole('dialog').parentElement).toHaveClass('min-h-full');
  });

  it('is 420px wide with a 20px title by default', () => {
    render(<Harness />);
    expect(screen.getByRole('dialog')).toHaveClass('max-w-[420px]');
    expect(screen.getByRole('heading', { name: 'Aadhaar OTP' })).toHaveClass('text-heading-s');
  });

  it('can take the look of the Take Action panel: 494px, a 48px header, a 16px title, a 60px footer', () => {
    render(
      <Modal
        open
        title="Take Action"
        variant="panel"
        onClose={() => {}}
        footer={<button>Go</button>}
      >
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Take Action' });
    expect(dialog).toHaveClass('max-w-[494px]');
    expect(screen.getByRole('heading', { name: 'Take Action' })).toHaveClass(
      'text-[16px]',
      'font-semibold',
    );
    expect(screen.getByRole('heading', { name: 'Take Action' }).parentElement).toHaveClass('h-12');
    expect(screen.getByRole('button', { name: 'Go' }).parentElement).toHaveClass('h-[60px]');
    expect(screen.getByRole('button', { name: 'Go' }).parentElement).toHaveClass('bg-panel-footer');
    // a bigger and darker cross than the plain dialog's
    const cross = screen.getByRole('button', { name: 'Close' });
    expect(cross).toHaveClass('text-label');
    expect(cross.querySelector('svg')).toHaveAttribute('width', '20');
  });
});
