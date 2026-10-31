'use client';

import { useActionState } from 'react';
import { createStaffAction } from '@/actions/catalog';
import { Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export function StaffForm() {
  const [state, formAction, pending] = useActionState(createStaffAction, initialActionState);
  return (
    <form action={formAction} className="max-w-2xl space-y-4" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" required />
        </Field>
        <Field label="Email" htmlFor="email" required error={state.errors?.email}>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field label="Role" htmlFor="role" required error={state.errors?.role}>
          <Select id="role" name="role" defaultValue="STAFF">
            <option value="STAFF">Staff — day-to-day billing work</option>
            <option value="ADMIN">Admin — full control</option>
          </Select>
        </Field>
        <Field
          label="Initial password"
          htmlFor="password"
          required
          error={state.errors?.password}
          hint="At least 9 characters with uppercase, lowercase and a special character."
        >
          <Input id="password" name="password" type="password" required />
        </Field>
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create staff account'}
        </Button>
      </div>
    </form>
  );
}
