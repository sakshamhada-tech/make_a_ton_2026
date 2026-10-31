'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createTemplateAction } from '@/actions/catalog';
import { Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';

interface LineRow {
  productId: string;
  quantity: string;
}

export function TemplateForm({
  plans,
  products,
  initialPlanId,
}: {
  plans: { id: string; name: string }[];
  products: { id: string; name: string; taxLabel: string; variants: { id: string; label: string }[] }[];
  initialPlanId?: string;
}) {
  const [state, formAction, pending] = useActionState(createTemplateAction, initialActionState);
  const [lines, setLines] = useState<LineRow[]>(
    products.length > 0 ? [{ productId: products[0].id, quantity: '1' }] : [],
  );

  return (
    <form action={formAction} className="max-w-3xl space-y-5" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Template name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" placeholder="Standard starter package" required />
        </Field>
        <Field label="Linked plan" htmlFor="planId" required error={state.errors?.planId}>
          <Select id="planId" name="planId" defaultValue={initialPlanId ?? plans[0]?.id ?? ''} required>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Quote validity (days)"
          htmlFor="validityDays"
          required
          error={state.errors?.validityDays}
          hint="Used for the quotation expiry on new subscriptions."
        >
          <Input id="validityDays" name="validityDays" type="number" min="1" max="365" defaultValue="15" required />
        </Field>
      </div>

      <fieldset className="rounded border border-zinc-200 p-4">
        <legend className="px-1 text-xs font-semibold text-zinc-700">Preset product lines</legend>
        <p className="mb-3 text-2xs text-zinc-500">
          Prices and taxes are resolved from the product when the subscription is created.
        </p>
        {lines.length === 0 ? (
          <p className="text-xs text-zinc-500">Add at least one product line.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((row, i) => {
              const product = products.find((p) => p.id === row.productId);
              return (
                <li key={i} className="grid grid-cols-[2fr_5rem_2fr_auto] items-end gap-2">
                  <Field label={i === 0 ? 'Product' : ''} htmlFor={`line-prod-${i}`}>
                    <Select
                      id={`line-prod-${i}`}
                      name="line_productId"
                      value={row.productId}
                      onChange={(e) => setLines((rows) => rows.map((r, j) => (j === i ? { ...r, productId: e.target.value } : r)))}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={i === 0 ? 'Qty' : ''} htmlFor={`line-qty-${i}`}>
                    <Input
                      id={`line-qty-${i}`}
                      name="line_quantity"
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => setLines((rows) => rows.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))}
                    />
                  </Field>
                  <Field label={i === 0 ? 'Variant' : ''} htmlFor={`line-variant-${i}`}>
                    <Select id={`line-variant-${i}`} name="line_variantOptionId" defaultValue="">
                      <option value="">None</option>
                      {product?.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex h-9 items-center gap-2">
                    <input type="hidden" name="line_taxId" value="" />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remove line"
                      onClick={() => setLines((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          disabled={products.length === 0}
          onClick={() => setLines((rows) => [...rows, { productId: products[0].id, quantity: '1' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </fieldset>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Create template'}
        </Button>
      </div>
    </form>
  );
}
