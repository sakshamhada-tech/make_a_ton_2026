'use client';

import { useActionState } from 'react';
import { createCustomerAction, updateCustomerAction } from '@/actions/catalog';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export interface CustomerInitial {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  gstin?: string;
}

export function CustomerForm({ customerId, initial }: { customerId?: string; initial?: CustomerInitial }) {
  const action = customerId ? updateCustomerAction.bind(null, customerId) : createCustomerAction;
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="max-w-2xl space-y-4" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company / contact name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
        </Field>
        <Field label="Email" htmlFor="email" required error={state.errors?.email}>
          <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} required />
        </Field>
        <Field label="Phone" htmlFor="phone" error={state.errors?.phone}>
          <Input id="phone" name="phone" defaultValue={initial?.phone ?? ''} />
        </Field>
        <Field label="GSTIN" htmlFor="gstin" error={state.errors?.gstin}>
          <Input id="gstin" name="gstin" defaultValue={initial?.gstin ?? ''} />
        </Field>
      </div>
      <Field label="Address" htmlFor="address" error={state.errors?.address}>
        <Input id="address" name="address" defaultValue={initial?.address ?? ''} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city" error={state.errors?.city}>
          <Input id="city" name="city" defaultValue={initial?.city ?? ''} />
        </Field>
        <Field label="State" htmlFor="state" error={state.errors?.state}>
          <Input id="state" name="state" defaultValue={initial?.state ?? ''} />
        </Field>
        <Field label="Postal code" htmlFor="postalCode" error={state.errors?.postalCode}>
          <Input id="postalCode" name="postalCode" defaultValue={initial?.postalCode ?? ''} />
        </Field>
      </div>
      <Field label="Country" htmlFor="country" error={state.errors?.country}>
        <Input id="country" name="country" defaultValue={initial?.country ?? 'India'} />
      </Field>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : customerId ? 'Save changes' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}
