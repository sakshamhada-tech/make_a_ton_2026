'use client';

import { useActionState } from 'react';
import { resetPasswordAction } from '@/actions/auth';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialActionState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field
        label="New password"
        htmlFor="password"
        required
        error={state.errors?.password}
        hint="At least 9 characters with uppercase, lowercase and a special character."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" required error={state.errors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? 'Updating…' : 'Set new password'}
      </Button>
    </form>
  );
}
