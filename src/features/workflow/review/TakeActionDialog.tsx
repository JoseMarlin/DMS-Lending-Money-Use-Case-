import { useId, useState, type FormEvent } from 'react';
import {
  Button,
  DatePicker,
  InlineBanner,
  Modal,
  NumberInput,
  RadioGroup,
  TextArea,
} from '@/components/ui';
import { useAppStore } from '@/data/store';
import type { DemoUser, HomeLoanApplication, WorkflowInstance } from '@/data/types';
import { formatIndianNumber } from '@/lib/format';
import {
  ACTION_OPTIONS,
  canSubmit,
  commentRequired,
  defaultSanction,
  levelOf,
  needsSanction,
  validateAction,
  type ActionForm,
} from './takeActionModel';

const LABEL = 'text-[12px] leading-4 font-semibold text-subtle';

/**
 * The Take Action dialog (the "Action" panel of the Workflow design, node 2535-45001, in its
 * simplest variant): a choice of Approve, Reject or Return for correction, a Comments box, and
 * Cancel and Submit. At Level 2 an approval also asks for the Sanctioned Amount and the Sanction
 * Date. Submit stays off until the form is valid; the store checks the same rules again.
 *
 * Mount it while it is open: it starts empty every time. `onDone` gets the sentence for the toast.
 */
export default function TakeActionDialog({
  instance,
  application,
  user,
  onClose,
  onDone,
}: {
  instance: WorkflowInstance;
  application: HomeLoanApplication;
  user: DemoUser;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const formId = useId();
  const approve = useAppStore((state) => state.approve);
  const reject = useAppStore((state) => state.reject);
  const returnForCorrection = useAppStore((state) => state.returnForCorrection);
  const level = levelOf(instance);

  const [form, setForm] = useState<ActionForm>(() => ({
    choice: '',
    comment: '',
    ...defaultSanction(application),
  }));
  const [commentTouched, setCommentTouched] = useState(false);
  // what the store said, if it refused (somebody else decided meanwhile, for example)
  const [refusal, setRefusal] = useState('');

  const errors = validateAction(form, { level, eligibleAmount: application.eligibleAmount });
  const ready = canSubmit(errors);
  const sanction = needsSanction(form.choice, level);
  const mustComment = commentRequired(form.choice);
  const patch = (change: Partial<ActionForm>) => {
    setRefusal('');
    setForm((current) => ({ ...current, ...change }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || form.choice === '') return;
    const comment = form.comment.trim();
    const outcome =
      form.choice === 'approve'
        ? approve(
            instance.id,
            user,
            comment,
            sanction
              ? {
                  sanctionedAmount: form.sanctionedAmount ?? undefined,
                  sanctionDate: form.sanctionDate,
                }
              : {},
          )
        : form.choice === 'reject'
          ? reject(instance.id, user, comment)
          : returnForCorrection(instance.id, user, comment);
    if (!outcome.ok) {
      setRefusal(outcome.error);
      return;
    }
    onDone(outcome.message);
  };

  const commentError = commentTouched ? errors.comment : undefined;

  return (
    <Modal
      open
      variant="panel"
      title="Take Action"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            form={formId}
            disabled={!ready}
            // the design's pale blue, not a half-faded primary
            className="disabled:bg-primary-disabled disabled:text-primary-disabled-ink disabled:opacity-100!"
          >
            Submit
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <RadioGroup
          legend="Select Action"
          name={`${formId}-action`}
          value={form.choice}
          onChange={(choice) => patch({ choice })}
          options={ACTION_OPTIONS}
        />

        {sanction ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${formId}-amount`} className={LABEL}>
                Sanctioned Amount
                <span aria-hidden className="text-error-text">
                  *
                </span>
              </label>
              <NumberInput
                id={`${formId}-amount`}
                value={form.sanctionedAmount}
                onValueChange={(sanctionedAmount) => patch({ sanctionedAmount })}
                invalid={Boolean(errors.sanctionedAmount)}
                aria-describedby={`${formId}-amount-note`}
                required
              />
              <p
                id={`${formId}-amount-note`}
                role={errors.sanctionedAmount ? 'alert' : undefined}
                className={`text-xs leading-4 ${errors.sanctionedAmount ? 'text-error-text' : 'text-subtle'}`}
              >
                {errors.sanctionedAmount ??
                  (application.eligibleAmount === null
                    ? `Asked for ${formatIndianNumber(application.loanAmountRequested)}`
                    : `Asked for ${formatIndianNumber(application.loanAmountRequested)}. Up to ${formatIndianNumber(application.eligibleAmount)}.`)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${formId}-date`} className={LABEL}>
                Sanction Date
                <span aria-hidden className="text-error-text">
                  *
                </span>
              </label>
              <DatePicker
                id={`${formId}-date`}
                value={form.sanctionDate}
                onValueChange={(sanctionDate) => patch({ sanctionDate })}
                invalid={Boolean(errors.sanctionDate)}
                aria-describedby={`${formId}-date-note`}
                required
              />
              <p
                id={`${formId}-date-note`}
                role={errors.sanctionDate ? 'alert' : undefined}
                className="min-h-4 text-xs leading-4 text-error-text"
              >
                {errors.sanctionDate}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-comments`} className={LABEL}>
            Comments
            {mustComment ? (
              <span aria-hidden className="text-error-text">
                *
              </span>
            ) : null}
          </label>
          <TextArea
            id={`${formId}-comments`}
            placeholder="Write a comment..."
            value={form.comment}
            onChange={(event) => patch({ comment: event.target.value })}
            onBlur={() => setCommentTouched(true)}
            invalid={Boolean(commentError)}
            aria-describedby={`${formId}-comments-note`}
            aria-required={mustComment || undefined}
            className="h-20! text-[13px] leading-[18px]"
          />
          <p
            id={`${formId}-comments-note`}
            role={commentError ? 'alert' : undefined}
            className={`text-xs leading-4 ${commentError ? 'text-error-text' : 'text-subtle'}`}
          >
            {commentError ?? (mustComment ? 'Required to reject or return.' : 'Optional.')}
          </p>
        </div>

        {refusal ? <InlineBanner variant="error">{refusal}</InlineBanner> : null}
      </form>
    </Modal>
  );
}
