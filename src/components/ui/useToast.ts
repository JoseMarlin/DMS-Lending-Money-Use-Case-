import { createContext, useContext } from 'react';

export interface ToastOptions {
  message: string;
  tone?: 'success' | 'info' | 'error';
  /** A link-style button after the message, for example "Open folder" */
  action?: { label: string; onClick: () => void };
  /** How long it stays, in milliseconds. 6000 by default. */
  durationMs?: number;
}

export interface ToastApi {
  show: (options: ToastOptions | string) => void;
}

// Without a provider (a screen drawn alone, in a test) showing a toast does nothing, not an error
export const ToastContext = createContext<ToastApi>({ show: () => {} });

/** `const toast = useToast(); toast.show('Saved')` */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}
