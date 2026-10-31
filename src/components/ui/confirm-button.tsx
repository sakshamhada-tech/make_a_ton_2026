'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Destructive-action button: opens a native <dialog> confirmation, then runs
 * the given server action. Keyboard accessible (Esc cancels, focus trapped by
 * the browser dialog element).
 */
export function ConfirmButton({
  label,
  confirmTitle,
  confirmMessage,
  onConfirm,
  variant = 'danger',
  size = 'md',
  disabled,
}: {
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  onConfirm: () => Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await onConfirm();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed.');
      }
    });
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled || pending}>
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded border border-zinc-200 bg-white p-0 shadow-lg backdrop:bg-zinc-900/40"
        aria-labelledby="confirm-title"
      >
        <div className="p-4">
          <h2 id="confirm-title" className="text-sm font-semibold text-zinc-900">
            {confirmTitle}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600">{confirmMessage}</p>
          {error ? (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant={variant} size="sm" onClick={confirm} disabled={pending}>
              {pending ? 'Working…' : confirmTitle}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
