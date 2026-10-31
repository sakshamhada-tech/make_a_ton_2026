'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signupAction } from '@/actions/auth';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field label="Full name" htmlFor="name" required error={state.errors?.name}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field
        label="Company"
        htmlFor="company"
        error={state.errors?.company}
        hint="Shown on your invoices. Optional."
      >
        <Input id="company" name="company" autoComplete="organization" />
      </Field>
      <Field label="Email" htmlFor="email" required error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        required
        error={state.errors?.password}
        hint="At least 9 characters with uppercase, lowercase and a special character."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-xs text-zinc-600">
        Already registered?{' '}
        <Link href="/login" className="text-accent-text hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
