'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Runs a zero-argument server action (e.g. confirm invoice) with pending state
 * and optional built-in confirmation. Errors surface inline via title/aria.
 */
export function ActionButton({
  label,
  action,
  variant = 'secondary',
  size = 'md',
  disabled,
  requireConfirm,
  confirmMessage,
}: {
  label: string;
  action: () => Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  requireConfirm?: boolean;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (requireConfirm && !window.confirm(confirmMessage ?? `Confirm: ${label}?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed.');
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant={variant} size={size} onClick={run} disabled={disabled || pending}>
        {pending ? 'Working…' : label}
      </Button>
      {error ? (
        <span className="text-2xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
