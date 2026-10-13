import { fireEvent, render, screen, within } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

const draw = (over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Discard your changes?"
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    >
      You have changes that are not saved.
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('asks the question in a dialog named after it, with its two answers', () => {
    draw();
    const dialog = screen.getByRole('dialog', { name: 'Discard your changes?' });
    expect(within(dialog).getByText('You have changes that are not saved.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Discard changes' })).toBeInTheDocument();
  });

  it('answers with the buttons', () => {
    const { onConfirm, onCancel } = draw();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('takes Escape as the cancelling answer', () => {
    const { onConfirm, onCancel } = draw();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('draws nothing while closed', () => {
    draw({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says Cancel when it is not told another word', () => {
    draw({ cancelLabel: undefined });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
