'use client';

import { useActionState } from 'react';
import { createPlanAction, updatePlanAction } from '@/actions/catalog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';
import { BILLING_PERIODS, PERIOD_LABELS, type BillingPeriod } from '@/lib/enums';

export interface PlanInitial {
  name?: string;
  price?: string;
  period?: string;
  minQuantity?: string;
  availableFrom?: string;
  availableTo?: string;
  autoClose?: boolean;
  allowEarlyClose?: boolean;
  allowPause?: boolean;
  allowRenew?: boolean;
  isActive?: boolean;
}

export function PlanForm({ planId, initial }: { planId?: string; initial?: PlanInitial }) {
  const action = planId ? updatePlanAction.bind(null, planId) : createPlanAction;
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="max-w-2xl space-y-5" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
        </Field>
        <Field label="Billing period" htmlFor="period" required error={state.errors?.period}>
          <Select id="period" name="period" defaultValue={initial?.period ?? 'MONTHLY'}>
            {BILLING_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p as BillingPeriod]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Price per period (₹)"
          htmlFor="price"
          required
          error={state.errors?.price}
          hint="Charged each billing cycle for the plan line."
        >
          <Input id="price" name="price" inputMode="decimal" defaultValue={initial?.price ?? ''} required />
        </Field>
        <Field
          label="Minimum quantity"
          htmlFor="minQuantity"
          required
          error={state.errors?.minQuantity}
          hint="Subscriptions cannot be activated below this quantity."
        >
          <Input id="minQuantity" name="minQuantity" type="number" min="1" defaultValue={initial?.minQuantity ?? '1'} required />
        </Field>
        <Field label="Available from" htmlFor="availableFrom" required error={state.errors?.availableFrom}>
          <Input id="availableFrom" name="availableFrom" type="date" defaultValue={initial?.availableFrom ?? ''} required />
        </Field>
        <Field label="Available to" htmlFor="availableTo" error={state.errors?.availableTo} hint="Leave empty for open-ended availability.">
          <Input id="availableTo" name="availableTo" type="date" defaultValue={initial?.availableTo ?? ''} />
        </Field>
      </div>

      <fieldset className="grid gap-3 rounded border border-zinc-200 p-4 sm:grid-cols-2">
        <legend className="px-1 text-xs font-semibold text-zinc-700">Subscription rules</legend>
        <Checkbox id="autoClose" label="Auto-close at the end date" defaultChecked={initial?.autoClose ?? true} />
        <Checkbox id="allowEarlyClose" label="Allow early close" defaultChecked={initial?.allowEarlyClose ?? false} />
        <Checkbox id="allowPause" label="Allow pause" defaultChecked={initial?.allowPause ?? false} />
        <Checkbox id="allowRenew" label="Allow renewal" defaultChecked={initial?.allowRenew ?? true} />
        <Checkbox id="isActive" label="Plan is active" defaultChecked={initial?.isActive ?? true} />
      </fieldset>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : planId ? 'Save changes' : 'Create plan'}
        </Button>
      </div>
    </form>
  );
}
