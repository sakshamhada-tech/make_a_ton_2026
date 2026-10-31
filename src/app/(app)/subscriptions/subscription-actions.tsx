'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addSubscriptionLineAction,
  closeSubscriptionAction,
  deleteSubscriptionAction,
  pauseSubscriptionAction,
  renewSubscriptionAction,
  resumeSubscriptionAction,
  transitionSubscriptionAction,
  updateSubscriptionAction,
} from '@/actions/subscriptions';
import { ActionButton } from '@/components/ui/action-button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { initialActionState } from '@/lib/action-state';
import { PAYMENT_TERMS } from '@/lib/enums';

const NEXT_LABEL: Record<string, string> = {
  DRAFT: 'Send quotation',
  QUOTATION: 'Confirm subscription',
  CONFIRMED: 'Activate',
  ACTIVE: 'Close subscription',
};

export interface PlanFlags {
  autoClose: boolean;
  allowEarlyClose: boolean;
  allowPause: boolean;
  allowRenew: boolean;
}

export function SubscriptionActions({
  subscriptionId,
  status,
  allowedTransitions,
  planFlags,
  endDate,
  paused,
}: {
  subscriptionId: string;
  status: string;
  allowedTransitions: string[];
  planFlags: PlanFlags;
  endDate: string;
  paused: boolean;
}) {
  const router = useRouter();
  const next = allowedTransitions[0];
  const today = new Date().toISOString().slice(0, 10);
  const closesEarly = endDate > today;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next ? (
        <ActionButton
          label={NEXT_LABEL[status] ?? `Move to ${next.toLowerCase()}`}
          variant={status === 'ACTIVE' ? 'secondary' : 'primary'}
          action={() => transitionSubscriptionAction(subscriptionId, next)}
          requireConfirm={next === 'CLOSED'}
          confirmMessage="Close this subscription? No further invoices will be generated."
        />
      ) : null}
      {status === 'ACTIVE' && planFlags.allowPause ? (
        paused ? (
          <ActionButton label="Resume" action={() => resumeSubscriptionAction(subscriptionId)} />
        ) : (
          <ActionButton label="Pause" action={() => pauseSubscriptionAction(subscriptionId)} />
        )
      ) : null}
      {status === 'ACTIVE' && planFlags.allowRenew ? (
        <ActionButton label="Renew +1 period" action={() => renewSubscriptionAction(subscriptionId)} />
      ) : null}
      {status === 'ACTIVE' && closesEarly && planFlags.allowEarlyClose ? (
        <ConfirmButton
          label="Close early"
          variant="danger"
          size="md"
          confirmTitle="Close subscription early"
          confirmMessage="The subscription will close immediately and stop billing."
          onConfirm={async () => {
            await closeSubscriptionAction(subscriptionId);
            router.refresh();
          }}
        />
      ) : null}
      {status === 'DRAFT' ? (
        <ConfirmButton
          label="Delete draft"
          variant="danger"
          confirmTitle="Delete draft subscription"
          confirmMessage="This draft and its lines will be permanently removed."
          onConfirm={async () => {
            await deleteSubscriptionAction(subscriptionId);
          }}
        />
      ) : null}
    </div>
  );
}

export function SubscriptionEditForm({
  subscriptionId,
  initial,
}: {
  subscriptionId: string;
  initial: { paymentTerms: string; startDate: string; endDate: string; quantity: string };
}) {
  const action = updateSubscriptionAction.bind(null, subscriptionId);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-4" noValidate>
      {state.message ? (
        <p className="form-error-summary sm:col-span-4" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field label="Quantity" htmlFor="quantity" error={state.errors?.quantity}>
        <Input id="quantity" name="quantity" type="number" min="1" defaultValue={initial.quantity} required />
      </Field>
      <Field label="Start date" htmlFor="startDate" error={state.errors?.startDate}>
        <Input id="startDate" name="startDate" type="date" defaultValue={initial.startDate} required />
      </Field>
      <Field label="Expiry date" htmlFor="endDate" error={state.errors?.endDate}>
        <Input id="endDate" name="endDate" type="date" defaultValue={initial.endDate} required />
      </Field>
      <Field label="Payment terms" htmlFor="paymentTerms" error={state.errors?.paymentTerms}>
        <Select id="paymentTerms" name="paymentTerms" defaultValue={initial.paymentTerms}>
          {PAYMENT_TERMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-4">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save draft'}
        </Button>
      </div>
    </form>
  );
}

export function AddLineForm({
  subscriptionId,
  products,
}: {
  subscriptionId: string;
  products: { id: string; name: string; variants: { id: string; label: string }[]; taxes: { id: string; label: string }[] }[];
}) {
  const action = addSubscriptionLineAction.bind(null, subscriptionId);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const product = products.find((p) => p.id === productId);
  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-[2fr_1.5fr_4rem_1.5fr_auto]" noValidate>
      {state.message ? (
        <p className="form-error-summary sm:col-span-5" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field label="Product" htmlFor="line-product" error={state.errors?.productId}>
        <Select
          id="line-product"
          name="productId"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Variant" htmlFor="line-variant">
        <Select id="line-variant" name="variantOptionId" defaultValue="">
          <option value="">None</option>
          {product?.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Qty" htmlFor="line-qty" error={state.errors?.quantity}>
        <Input id="line-qty" name="quantity" type="number" min="1" defaultValue="1" required />
      </Field>
      <Field label="Tax" htmlFor="line-tax">
        <Select id="line-tax" name="taxId" defaultValue="">
          <option value="">Default</option>
          {product?.taxes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="pb-0.5">
        <Button type="submit" variant="secondary" size="sm" disabled={pending || products.length === 0}>
          {pending ? 'Adding…' : 'Add line'}
        </Button>
      </div>
    </form>
  );
}
