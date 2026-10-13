import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { KYC_CONFIG, resetKycConfig } from '@/services/mockKyc';

// The mocked KYC takes 1.5 to 2 seconds in the app. In tests every wait is 1 ms, unless a test
// asks for the real values (resetKycConfig()) and uses fake timers.
beforeEach(() => {
  resetKycConfig();
  Object.assign(KYC_CONFIG, {
    panDelayMs: 1,
    aadhaarDelayMs: 1,
    gstDelayMs: 1,
    otpCheckDelayMs: 1,
    retryDelayMs: 1,
  });
});
