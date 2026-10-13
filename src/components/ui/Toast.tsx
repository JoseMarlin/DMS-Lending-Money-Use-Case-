import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircleIcon, CloseIcon } from './icons';
import { ToastContext, type ToastOptions } from './useToast';

interface ToastEntry extends ToastOptions {
  id: number;
}

const TONE_ICON = {
  success: 'text-success',
  info: 'text-primary',
  error: 'text-error-text',
} as const;

/** How long a toast with an action stays when nobody is on it (the keyboard needs time to get there). */
const ACTION_MS = 20_000;

/** An Application ID (HL-2026-0006) is not broken over two lines at its hyphens. */
function keepIdsWhole(message: string): ReactNode {
  return message.split(/(\b[A-Z]{2}-\d{4}-\d{4}\b)/).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function ToastItem({ toast, onClose }: { toast: ToastEntry; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  // It leaves by itself, unless the pointer or the keyboard is on it. One with an action stays longer:
  // the action is the last thing in the page's tab order, and has to be reachable before it goes.
  useEffect(() => {
    if (paused) return;
    const stays = toast.durationMs ?? (toast.action ? ACTION_MS : 6000);
    const timer = setTimeout(() => onClose(toast.id), stays);
    return () => clearTimeout(timer);
  }, [paused, toast.id, toast.durationMs, toast.action, onClose]);

  const tone = toast.tone ?? 'success';
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-card border border-line bg-white p-3 shadow-card"
    >
      <CheckCircleIcon size={20} className={`mt-px shrink-0 ${TONE_ICON[tone]}`} />
      <p className="min-w-0 flex-1 text-body-m [overflow-wrap:anywhere] text-ink">
        {keepIdsWhole(toast.message)}
        {toast.action ? (
          <>
            {' '}
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onClose(toast.id);
              }}
              className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {toast.action.label}
            </button>
          </>
        ) : null}
      </p>
      <button
        type="button"
        aria-label="Close notification"
        onClick={() => onClose(toast.id)}
        className="-m-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-subtle hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

/**
 * Small messages at the top right ("Application HL-2026-0006 submitted"). Mount it once, above the
 * routes, so a message made on one screen is still there after moving to the next. The region is
 * always in the page, so a screen reader hears each new message.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const close = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions | string) => {
    const entry = typeof options === 'string' ? { message: options } : options;
    const id = nextId.current++;
    // three at most: the oldest goes when a fourth comes
    setToasts((list) => [...list, { ...entry, id }].slice(-3));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed top-[var(--toast-top,4rem)] right-5 z-[10001] flex w-[380px] max-w-[calc(100vw-40px)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={close} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
