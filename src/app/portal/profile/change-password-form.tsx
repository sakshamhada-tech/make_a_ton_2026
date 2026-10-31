'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/actions/profile';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialActionState);
  return (
    <form action={formAction} className="max-w-md space-y-4" noValidate>
      {state.message ? (
        <p className={state.ok ? 'rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800' : 'form-error-summary'} role={state.ok ? 'status' : 'alert'}>
          {state.message}
        </p>
      ) : null}
      <Field label="Current password" htmlFor="currentPassword" required error={state.errors?.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field
        label="New password"
        htmlFor="newPassword"
        required
        error={state.errors?.newPassword}
        hint="At least 9 characters with uppercase, lowercase and a special character."
      >
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" required error={state.errors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </form>
  );
}
