'use client';

import { useActionState } from 'react';
import { forgotPasswordAction } from '@/actions/auth';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialActionState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field
        label="Email"
        htmlFor="email"
        required
        error={state.errors?.email}
        hint="We will send a single-use reset link valid for 30 minutes."
      >
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
