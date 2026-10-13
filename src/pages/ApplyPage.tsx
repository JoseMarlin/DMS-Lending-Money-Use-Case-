import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader, Button, FormCard, Modal, Stepper, useToast } from '@/components/ui';
import { hasBeenSubmitted, hasKycResult, isBlankDraft } from '@/data/application';
import { useAppStore, useCurrentUser } from '@/data/store';
import { ApplicationStatus } from '@/data/types';
import { focusField } from '@/features/home-loan/form/focusField';
import { sectionIdOf, sectionStatus } from '@/features/home-loan/form/sectionStatus';
import { buildPatch } from '@/features/home-loan/form/formState';
import SectionBlock from '@/features/home-loan/form/SectionBlock';
import { useDocumentUploads } from '@/features/home-loan/form/useDocumentUploads';
import { useStep1Validation } from '@/features/home-loan/form/useStep1Validation';
import ValidationSummary from '@/features/home-loan/form/ValidationSummary';
import { validateStep1 } from '@/features/home-loan/validation/validate';
import type { FieldSchema } from '@/features/home-loan/form/schema';
import type { ValidationIssue } from '@/features/home-loan/validation/validate';
import { STEP1_SECTIONS } from '@/features/home-loan/form/step1Schema';
import { hasExceptionRemark, kycAllowsSubmit } from '@/features/home-loan/kyc/gating';
import KycStep from '@/features/home-loan/kyc/KycStep';
import { useKycRun } from '@/features/home-loan/kyc/useKycRun';
import ReviewStep from '@/features/home-loan/review/ReviewStep';
import SubmittedCard from '@/features/home-loan/review/SubmittedCard';
import { RECORD_LIST_PATH } from '@/features/master/paths';

const STEPS = ['Application', 'KYC Validation', 'Review'];

/** What a section header says at its right: errors in red, else how much is filled in. */
function SectionSummary({ status }: { status: ReturnType<typeof sectionStatus> }) {
  if (status.errors > 0) {
    return (
      <span className="font-semibold text-error-text">
        {status.errors} {status.errors === 1 ? 'error' : 'errors'}
      </span>
    );
  }
  // filled in, but something breaks a rule (its error shows once the field is left or Next is pressed)
  if (status.invalid > 0) return <span className="font-semibold text-warning">Check details</span>;
  if (status.required === 0) return null;
  if (status.filled === status.required) return <span className="text-success">Complete</span>;
  return (
    <span>
      {status.filled} of {status.required} required
    </span>
  );
}

/**
 * Ignores the second click of a double-click. Step buttons sit in the same place on every step, so
 * without this the second click would land on the next step's button (a double-click on
 * "Review and submit" would submit the application without it being seen).
 */
const single = (action: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
  if (event.detail > 1) return;
  action();
};

const FIRST_SECTION = { [STEP1_SECTIONS[0].id]: true };

export default function ApplyPage() {
  const user = useCurrentUser();
  const draft = useAppStore((s) => s.draft);
  const storedStep = useAppStore((s) => s.currentStep);
  const applications = useAppStore((s) => s.applications);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const setStep = useAppStore((s) => s.setStep);
  const saveApplication = useAppStore((s) => s.saveApplication);
  const submitApplication = useAppStore((s) => s.submitApplication);
  const resetKycResult = useAppStore((s) => s.resetKycResult);
  const resetCount = useAppStore((s) => s.draftResetCount);
  const activeScenario = useAppStore((s) => s.activeScenario);
  const startNewDraft = useAppStore((s) => s.startNewDraft);
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [seenResetCount, setSeenResetCount] = useState(resetCount);
  const { uploadErrors, selectFile, removeFile } = useDocumentUploads();
  const validation = useStep1Validation(STEP1_SECTIONS, uploadErrors);

  // Sections are accordions: the first one is open, the rest open when the user opens them or when
  // an error needs to be shown
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(FIRST_SECTION);

  // A scenario fill, a new application or Reset demo starts the page afresh. A scenario fill keeps
  // the sections as the presenter left them (to see what was filled); a new application or Reset
  // demo goes back to the first section only.
  if (seenResetCount !== resetCount) {
    setSeenResetCount(resetCount);
    setSavedMessage('');
    if (activeScenario === null) setOpenSections(FIRST_SECTION);
  }
  const allOpen = STEP1_SECTIONS.every((section) => openSections[section.id]);
  const toggleSection = (id: string) => setOpenSections((open) => ({ ...open, [id]: !open[id] }));
  const toggleAll = () =>
    setOpenSections(Object.fromEntries(STEP1_SECTIONS.map((section) => [section.id, !allOpen])));
  const openSectionsOf = (issues: ValidationIssue[]) =>
    setOpenSections((open) => ({
      ...open,
      ...Object.fromEntries(
        issues.flatMap((issue) => {
          const id = sectionIdOf(STEP1_SECTIONS, issue.field);
          return id ? [[id, true] as const] : [];
        }),
      ),
    }));
  const submitted = hasBeenSubmitted(draft.status);

  // Steps 2 and 3 are only for an application whose Step 1 is complete. If the saved step does not
  // fit the saved data (for example the data was edited), go back to Step 1.
  const step1Complete = useMemo(
    () =>
      validateStep1(STEP1_SECTIONS, draft, { applications, checkDuplicatePan: true }).length === 0,
    [draft, applications],
  );
  const step = !submitted && storedStep > 1 && !step1Complete ? 1 : storedStep;
  useEffect(() => {
    if (step !== storedStep) setStep(step);
  }, [step, storedStep, setStep]);

  // KYC starts by itself when Step 2 is showing (and the application has no result yet)
  const kyc = useKycRun(step === 2 && !submitted);

  // When the step changes, the cursor goes to the heading of the new step (not on first load)
  const stepKey = submitted ? 'submitted' : String(step);
  const lastStepKey = useRef(stepKey);
  useEffect(() => {
    if (lastStepKey.current === stepKey) return;
    lastStepKey.current = stepKey;
    document.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true });
  }, [stepKey]);

  // Every change goes straight to the store, which saves it to localStorage
  const handleChange = (field: FieldSchema, raw: string) => {
    setSavedMessage('');
    updateDraft(buildPatch(STEP1_SECTIONS, draft, field, raw));
    // The record only holds the last four digits of the Aadhaar, so a different number that ends
    // the same looks unchanged. Typing a new number means the old KYC result no longer applies.
    if (field.mask === 'aadhaar' && hasKycResult(useAppStore.getState().draft)) resetKycResult();
  };

  const handleSaveDraft = () => {
    // an application that was returned stays returned: saving must not turn it back into a draft
    const status =
      draft.status === ApplicationStatus.Returned
        ? ApplicationStatus.Returned
        : ApplicationStatus.Draft;
    saveApplication({ ...draft, status });
    setSavedMessage(`Draft ${draft.applicationId} saved`);
  };

  // Next: check everything. If something is wrong, show it and take the user to the first problem.
  const handleNext = () => {
    const issues = validation.submit();
    if (issues.length > 0) {
      openSectionsOf(issues); // show every section that has a problem
      // wait for the summary and the sections to appear so the card has its final size
      requestAnimationFrame(() => focusField(issues[0].field));
      return;
    }
    // a kept Pass or Exception stays "KYC Done"; otherwise the application is a Draft
    const keepsResult = draft.kycOverallResult === 'Pass' || draft.kycOverallResult === 'Exception';
    if (!keepsResult) updateDraft({ status: ApplicationStatus.Draft });
    setStep(2);
  };

  // Submit: the application goes into the workflow "Home Loan Approval" (it becomes In Level 1 and
  // the Branch Manager has a task), then back to the master list, where it shows as In-Progress.
  const canSubmit = kycAllowsSubmit(draft.kycOverallResult, draft.kycExceptionRemark);
  const handleSubmit = () => {
    if (!canSubmit) return;
    const outcome = submitApplication();
    if (!outcome.ok) {
      toast.show({ message: outcome.error, tone: 'error' });
      return;
    }
    toast.show(outcome.message);
    navigate(RECORD_LIST_PATH);
  };

  // Cancel leaves the form for the master list. What was typed is not kept (Save as draft keeps
  // it), so a form with something in it asks first.
  const leaveForm = () => {
    startNewDraft();
    navigate(RECORD_LIST_PATH);
  };
  const handleCancel = () => {
    if (isBlankDraft(draft)) leaveForm();
    else setConfirmDiscard(true);
  };

  // Review and submit is available once KYC passed, or is an Exception with its remark
  const canReview =
    !kyc.running &&
    (draft.kycOverallResult === 'Pass' ||
      (draft.kycOverallResult === 'Exception' && hasExceptionRemark(draft.kycExceptionRemark)));

  let footer;
  if (submitted) {
    footer = undefined;
  } else if (step === 1) {
    footer = (
      <>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <span role="status" className="text-sm text-subtle">
            {savedMessage}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSaveDraft}>
            Save as draft
          </Button>
          <Button onClick={single(handleNext)}>Next: KYC Validation</Button>
        </div>
      </>
    );
  } else if (step === 2) {
    footer = (
      <>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <span role="status" className="text-sm text-subtle">
            {kyc.running ? 'Checking your details…' : ''}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={single(() => setStep(1))}>
            Back
          </Button>
          <Button disabled={!canReview} onClick={single(() => setStep(3))}>
            Review and submit
          </Button>
        </div>
      </>
    );
  } else {
    footer = (
      <>
        <div>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={single(() => setStep(2))}>
            Back
          </Button>
          <Button disabled={!canSubmit} onClick={single(handleSubmit)}>
            Submit application
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <AppHeader
        right={
          <span className="text-sm text-white/80">
            {user.name} &middot; {user.roleLabel}
          </span>
        }
      />
      <main className="flex justify-center px-4 pt-10 pb-6">
        <FormCard
          title="Home Loan Application"
          subHeader={
            submitted ? undefined : (
              <>
                <Stepper steps={STEPS} current={step} />
                {step === 1 ? (
                  <ValidationSummary
                    issues={validation.issues}
                    onSelect={(issue) => {
                      openSectionsOf([issue]);
                      requestAnimationFrame(() => focusField(issue.field));
                    }}
                  />
                ) : null}
              </>
            )
          }
          footer={footer}
          scrollResetKey={stepKey}
        >
          {submitted ? (
            <SubmittedCard applicationId={draft.applicationId} onStartNew={startNewDraft} />
          ) : step === 1 ? (
            <div className="flex flex-col gap-3">
              <p className="sr-only" tabIndex={-1} data-step-heading>
                Step 1 of 3: Application
              </p>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {allOpen ? 'Collapse all sections' : 'Expand all sections'}
                </Button>
              </div>
              {STEP1_SECTIONS.map((section) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  values={draft}
                  errors={validation.errors}
                  open={Boolean(openSections[section.id])}
                  onToggle={() => toggleSection(section.id)}
                  summary={
                    <SectionSummary status={sectionStatus(section, draft, validation.errors)} />
                  }
                  onChange={handleChange}
                  onBlur={validation.touch}
                  onFileSelect={selectFile}
                  onFileRemove={removeFile}
                />
              ))}
            </div>
          ) : step === 2 ? (
            <KycStep kyc={kyc} onBackToEdit={() => setStep(1)} />
          ) : (
            <ReviewStep onBackToEdit={() => setStep(1)} />
          )}
        </FormCard>
      </main>
      <Modal
        open={confirmDiscard}
        title="Discard this application?"
        onClose={() => setConfirmDiscard(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button variant="dangerGhost" onClick={leaveForm}>
              Discard
            </Button>
          </>
        }
      >
        <p className="text-body-m text-ink">
          What you entered will not be kept. To keep it, choose Keep editing and then Save as draft.
        </p>
      </Modal>
    </div>
  );
}
