'use client';

import { useActionState } from 'react';
import { createDiscountAction, updateDiscountAction } from '@/actions/catalog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

export interface DiscountInitial {
  name?: string;
  type?: string;
  valueRaw?: string;
  minPurchaseRaw?: string;
  minQuantityRaw?: string;
  usageLimitRaw?: string;
  startsAt?: string;
  endsAt?: string;
  scope?: string;
  isActive?: boolean;
  productIds?: string[];
}

export function DiscountForm({
  discountId,
  products,
  initial,
}: {
  discountId?: string;
  products: { id: string; name: string }[];
  initial?: DiscountInitial;
}) {
  const action = discountId ? updateDiscountAction.bind(null, discountId) : createDiscountAction;
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="max-w-2xl space-y-4" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" defaultValue={initial?.name ?? ''} placeholder="Festival offer" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="type" required error={state.errors?.type}>
            <Select id="type" name="type" defaultValue={initial?.type ?? 'PERCENT'}>
              <option value="PERCENT">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </Select>
          </Field>
          <Field
            label="Value"
            htmlFor="valueRaw"
            required
            error={state.errors?.valueRaw}
            hint="Percent (e.g. 10) or ₹ amount"
          >
            <Input id="valueRaw" name="valueRaw" defaultValue={initial?.valueRaw ?? ''} required />
          </Field>
        </div>
        <Field label="Start date" htmlFor="startsAt" required error={state.errors?.startsAt}>
          <Input id="startsAt" name="startsAt" type="date" defaultValue={initial?.startsAt ?? ''} required />
        </Field>
        <Field label="End date" htmlFor="endsAt" required error={state.errors?.endsAt}>
          <Input id="endsAt" name="endsAt" type="date" defaultValue={initial?.endsAt ?? ''} required />
        </Field>
        <Field label="Minimum purchase (₹)" htmlFor="minPurchaseRaw" error={state.errors?.minPurchaseRaw}>
          <Input id="minPurchaseRaw" name="minPurchaseRaw" inputMode="decimal" defaultValue={initial?.minPurchaseRaw ?? ''} />
        </Field>
        <Field label="Minimum quantity" htmlFor="minQuantityRaw" error={state.errors?.minQuantityRaw}>
          <Input id="minQuantityRaw" name="minQuantityRaw" type="number" min="0" defaultValue={initial?.minQuantityRaw ?? ''} />
        </Field>
        <Field label="Usage limit" htmlFor="usageLimitRaw" error={state.errors?.usageLimitRaw} hint="Leave empty for unlimited uses.">
          <Input id="usageLimitRaw" name="usageLimitRaw" type="number" min="1" defaultValue={initial?.usageLimitRaw ?? ''} />
        </Field>
        <Field label="Scope" htmlFor="scope" required error={state.errors?.scope}>
          <Select id="scope" name="scope" defaultValue={initial?.scope ?? 'SUBSCRIPTION'}>
            <option value="SUBSCRIPTION">Whole subscription</option>
            <option value="PRODUCTS">Specific products</option>
          </Select>
        </Field>
      </div>

      <details className="rounded border border-zinc-200 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-zinc-700">
          Products for product-scoped discounts
        </summary>
        <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
          {products.map((p) => (
            <Checkbox
              key={p.id}
              id={`disc-prod-${p.id}`}
              name="productIds"
              label={p.name}
              defaultChecked={initial?.productIds?.includes(p.id) ?? false}
            />
          ))}
        </div>
      </details>

      <Checkbox id="isActive" label="Discount is active" defaultChecked={initial?.isActive ?? true} />

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : discountId ? 'Save discount' : 'Create discount'}
        </Button>
      </div>
    </form>
  );
}
