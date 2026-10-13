import type { ReactNode } from 'react';
import Button from './Button';
import Modal from './Modal';

/**
 * A question with two answers, in a small dialog: "Discard your changes?" with Keep editing and
 * Discard changes. The cancelling answer is the first button and Escape or a click outside gives it.
 * Not in the Figma files, so it is provisional.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** The confirming answer throws something away: it is drawn as a danger button */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'dangerGhost' : 'primary'}
            className={danger ? 'border-error/40' : ''}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-body-m text-ink">{children}</div>
    </Modal>
  );
}
