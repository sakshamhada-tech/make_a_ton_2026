'use client';

import { useActionState } from 'react';
import { createTaxAction, updateTaxAction } from '@/actions/catalog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export interface TaxInitial {
  name?: string;
  rate?: string;
  appliesTo?: string;
  isActive?: boolean;
}

export function TaxForm({
  taxId,
  products,
  initial,
  initialProductIds,
}: {
  taxId?: string;
  products: { id: string; name: string }[];
  initial?: TaxInitial;
  initialProductIds?: string[];
}) {
  const action = taxId ? updateTaxAction.bind(null, taxId) : createTaxAction;
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="max-w-2xl space-y-4" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
        </Field>
        <Field label="Rate (%)" htmlFor="rate" required error={state.errors?.rate} hint="e.g. 18 or 5">
          <Input id="rate" name="rate" inputMode="decimal" defaultValue={initial?.rate ?? ''} required />
        </Field>
        <Field label="Applies to" htmlFor="appliesTo" required error={state.errors?.appliesTo}>
          <Select id="appliesTo" name="appliesTo" defaultValue={initial?.appliesTo ?? 'ALL'}>
            <option value="ALL">All products</option>
            <option value="PRODUCTS">Selected products</option>
          </Select>
        </Field>
      </div>
      <Checkbox id="isActive" label="Active" defaultChecked={initial?.isActive ?? true} />
      <details className="rounded border border-zinc-200 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-zinc-700">
          Limit to specific products (optional)
        </summary>
        <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
          {products.map((p) => (
            <Checkbox
              key={p.id}
              id={`tax-prod-${p.id}`}
              name="productIds"
              label={p.name}
              defaultChecked={initialProductIds?.includes(p.id) ?? false}
            />
          ))}
        </div>
      </details>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : taxId ? 'Save tax rule' : 'Create tax rule'}
        </Button>
      </div>
    </form>
  );
}
