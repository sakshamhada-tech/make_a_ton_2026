'use client';

import { useActionState } from 'react';
import { recordPaymentAction } from '@/actions/invoices';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums';

export function PaymentForm({ invoiceId, outstanding, today }: { invoiceId: string; outstanding: number; today: string }) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, initialActionState);
  const outstandingRupees = (outstanding / 100).toFixed(2);
  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-2" noValidate>
      {state.message ? (
        <p className="form-error-summary sm:col-span-2" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.ok ? (
        <p className="sm:col-span-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {state.message}
        </p>
      ) : null}
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Field label="Method" htmlFor="method" required error={state.errors?.method}>
        <Select id="method" name="method" defaultValue="BANK_TRANSFER">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m as PaymentMethod]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={`Amount (₹, outstanding ${outstandingRupees})`}
        htmlFor="amount"
        required
        error={state.errors?.amount}
      >
        <Input id="amount" name="amount" inputMode="decimal" placeholder={outstandingRupees} required />
      </Field>
      <Field label="Date" htmlFor="paidAt" required error={state.errors?.paidAt}>
        <Input id="paidAt" name="paidAt" type="date" defaultValue={today} required />
      </Field>
      <Field label="Note" htmlFor="note" error={state.errors?.note}>
        <Textarea id="note" name="note" rows={1} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending || outstanding <= 0}>
          {pending ? 'Recording…' : 'Record payment'}
        </Button>
      </div>
    </form>
  );
}
