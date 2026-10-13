import { useState } from 'react';
import { Button, FormField, Modal, TextInput } from '@/components/ui';
import { KYC_CONFIG } from '@/services/mockKyc';
import type { OtpState } from './useKycRun';

interface OtpModalProps {
  state: OtpState;
  /** Last four digits of the mobile number the OTP was "sent" to */
  mobileLast4: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onClose: () => void;
}

/** The Aadhaar OTP pop-up: 6 digits, a resend link and an error for a wrong OTP. */
export default function OtpModal(props: OtpModalProps) {
  // The dialog is built afresh each time it opens, so the code box starts empty
  return props.state.open ? <OtpDialog {...props} /> : null;
}

function OtpDialog({ state, mobileLast4, onSubmit, onResend, onClose }: OtpModalProps) {
  const [code, setCode] = useState('');
  const complete = /^\d{6}$/.test(code);

  return (
    <Modal
      open={state.open}
      title="Aadhaar OTP"
      // while the OTP is being checked, the pop-up cannot be dismissed (the check would go on)
      onClose={state.verifying ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={state.verifying}>
            Cancel
          </Button>
          <Button type="submit" form="otp-form" disabled={!complete || state.verifying}>
            {state.verifying ? 'Verifying…' : 'Verify OTP'}
          </Button>
        </>
      }
    >
      <form
        id="otp-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (complete && !state.verifying) onSubmit(code);
        }}
      >
        <p className="text-body-m text-ink">
          Enter the 6-digit OTP sent to the mobile number ending {mobileLast4 || 'XXXX'}.
        </p>
        <FormField
          htmlFor="otp-input"
          label="OTP"
          required
          error={state.error ?? undefined}
          helperText={state.error ? undefined : (state.notice ?? undefined)}
        >
          <TextInput
            id="otp-input"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit OTP"
            required
            invalid={Boolean(state.error)}
            aria-describedby={state.error || state.notice ? 'otp-input-message' : undefined}
            className="tracking-[0.4em] placeholder:tracking-normal"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </FormField>
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onResend} disabled={state.verifying}>
            Resend OTP
          </Button>
          {/* Presenter help. Not part of the product. */}
          <span className="text-xs text-subtle">Demo OTP: {KYC_CONFIG.otp}</span>
        </div>
      </form>
    </Modal>
  );
}
