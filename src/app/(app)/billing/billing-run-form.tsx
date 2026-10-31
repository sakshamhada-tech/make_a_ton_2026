'use client';

import { useActionState } from 'react';
import { runBillingAction } from '@/actions/invoices';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export function BillingRunForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(runBillingAction, initialActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      <Field
        label="Bill subscriptions due on or before"
        htmlFor="asOfDate"
        required
        error={state.errors?.asOfDate}
        className="w-56"
      >
        <Input id="asOfDate" name="asOfDate" type="date" defaultValue={today} required />
      </Field>
      <div className="pb-0.5">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Running billing…' : 'Run billing'}
        </Button>
      </div>
      {state.message ? (
        <p
          className={`w-full text-xs ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}
          role={state.ok ? 'status' : 'alert'}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
