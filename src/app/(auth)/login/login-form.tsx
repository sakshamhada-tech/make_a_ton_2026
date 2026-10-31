'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '@/actions/auth';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {notice ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field label="Email" htmlFor="email" required error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" required error={state.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <div className="flex items-center justify-between text-xs">
        <Link href="/forgot-password" className="text-accent-text hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-zinc-600 hover:underline">
          Create an account
        </Link>
      </div>
      <div className="border-t border-zinc-100 pt-3 text-2xs leading-relaxed text-zinc-500">
        <p className="font-medium text-zinc-600">Demo accounts</p>
        <p>admin@brightloop.example / Admin@12345!</p>
        <p>staff@brightloop.example / Staff@12345!</p>
        <p>ishita.rao@northwind.example / Customer@12345!</p>
      </div>
    </form>
  );
}
