import { useMemo, useState } from 'react';
import { useAppStore } from '@/data/store';
import { validateStep1, type ValidationIssue } from '../validation/validate';
import { fieldId, type FieldSchema, type SectionSchema } from './schema';

interface FormValidationState {
  /** Which draft this belongs to: a scenario fill, new draft or reset starts it afresh */
  resetCount: number;
  /** Fields the user has left at least once */
  touched: string[];
  /** The user pressed "Next: KYC Validation" */
  attempted: boolean;
}

/**
 * When errors show:
 * - a field's error appears when the user LEAVES the field, and from then on follows the value,
 *   so it clears as soon as the value is fixed;
 * - after "Next", every error shows, plus the duplicate PAN check.
 * Errors are worked out from the current draft each time, so a rule that depends on another field
 * (the loan amount against the estimate) updates when that field changes.
 */
export function useStep1Validation(
  sections: SectionSchema[],
  /** Errors of files that were rejected on upload, by field id. They win over the rest. */
  uploadErrors: Record<string, string> = {},
) {
  const draft = useAppStore((s) => s.draft);
  const applications = useAppStore((s) => s.applications);
  const resetCount = useAppStore((s) => s.draftResetCount);

  const [stored, setStored] = useState<FormValidationState>({
    resetCount,
    touched: [],
    attempted: false,
  });
  const current: FormValidationState =
    stored.resetCount === resetCount ? stored : { resetCount, touched: [], attempted: false };

  const allIssues = useMemo(
    () =>
      validateStep1(sections, draft, {
        applications,
        checkDuplicatePan: current.attempted,
      }),
    [sections, draft, applications, current.attempted],
  );

  const errors = useMemo(() => {
    const byField: Record<string, string> = {};
    for (const issue of allIssues) {
      if (current.attempted || current.touched.includes(issue.fieldId)) {
        byField[issue.fieldId] = issue.message;
      }
    }
    return { ...byField, ...uploadErrors };
  }, [allIssues, current.attempted, current.touched, uploadErrors]);

  /** Call when the user leaves a field */
  const touch = (field: FieldSchema) => {
    const id = fieldId(field);
    if (current.touched.includes(id)) return;
    setStored({ ...current, touched: [...current.touched, id] });
  };

  /** Call when the user presses Next. Returns every problem, including a duplicate PAN. */
  const submit = (): ValidationIssue[] => {
    setStored({ ...current, attempted: true });
    return validateStep1(sections, draft, { applications, checkDuplicatePan: true });
  };

  return {
    errors,
    /** The list for the summary at the top: empty until the user has pressed Next */
    issues: current.attempted ? allIssues : [],
    touch,
    submit,
  };
}
