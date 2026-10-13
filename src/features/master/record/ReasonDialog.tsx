import { useState } from 'react';
import { Button, FormField, Modal, TextArea } from '@/components/ui';

/**
 * The reason for the change, asked before an approved record is saved (only the administrator can
 * edit one). It is written in the audit trail with each field that changed. Built afresh each time
 * it opens, so the box starts empty.
 */
export default function ReasonDialog({
  onSave,
  onCancel,
}: {
  onSave: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const missing = reason.trim() === '';

  const submit = () => {
    if (missing) {
      setAttempted(true);
      return;
    }
    onSave(reason.trim());
  };

  return (
    <Modal
      open
      title="Reason for change"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="record-reason-form">
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="record-reason-form"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="text-body-m text-subtle">
          This record is approved. Say why it is being changed: the reason is kept in its audit
          trail.
        </p>
        <FormField
          htmlFor="record-reason"
          label="Reason for change"
          required
          error={attempted && missing ? 'Enter the reason for the change' : undefined}
        >
          <TextArea
            id="record-reason"
            name="reason"
            required
            invalid={attempted && missing}
            aria-describedby={attempted && missing ? 'record-reason-message' : undefined}
            autoComplete="off"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
