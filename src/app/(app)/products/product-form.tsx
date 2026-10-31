'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createProductAction, updateProductAction } from '@/actions/catalog';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';
import { PRODUCT_TYPES } from '@/lib/enums';

interface VariantRow {
  id?: string;
  attribute: string;
  value: string;
  priceExtra: string;
}

export function ProductForm({
  productId,
  initial,
}: {
  productId?: string;
  initial?: {
    name: string;
    type: string;
    salesPrice: string;
    costPrice: string;
    notes: string;
    isActive: boolean;
    variants: VariantRow[];
  };
}) {
  const action = productId ? updateProductAction.bind(null, productId) : createProductAction;
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [variants, setVariants] = useState<VariantRow[]>(initial?.variants ?? []);

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-5" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={state.errors?.name}>
          <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
        </Field>
        <Field label="Type" htmlFor="type" required error={state.errors?.type}>
          <Select id="type" name="type" defaultValue={initial?.type ?? 'license'}>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Sales price (₹)"
          htmlFor="salesPrice"
          required
          error={state.errors?.salesPrice}
          hint="Base unit price before variant extras."
        >
          <Input id="salesPrice" name="salesPrice" inputMode="decimal" defaultValue={initial?.salesPrice ?? ''} required />
        </Field>
        <Field label="Cost price (₹)" htmlFor="costPrice" required error={state.errors?.costPrice}>
          <Input id="costPrice" name="costPrice" inputMode="decimal" defaultValue={initial?.costPrice ?? ''} required />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={state.errors?.notes}>
        <Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes ?? ''} />
      </Field>

      <Checkbox id="isActive" label="Active (available for new subscriptions)" defaultChecked={initial?.isActive ?? true} />

      <fieldset className="rounded border border-zinc-200 p-4">
        <legend className="px-1 text-xs font-semibold text-zinc-700">Variant options</legend>
        <p className="mb-3 text-2xs text-zinc-500">
          Final unit price = base price + variant extra (for example, Brand: Odoo adds ₹560.00).
        </p>
        {variants.length === 0 ? (
          <p className="text-xs text-zinc-500">No variants. The base price is used for every line.</p>
        ) : (
          <ul className="space-y-2">
            {variants.map((row, i) => (
              <li key={row.id ?? i} className="grid grid-cols-[1fr_1fr_7rem_auto] items-end gap-2">
                <Field label={i === 0 ? 'Attribute' : ''} htmlFor={`var-attr-${i}`}>
                  <Input
                    id={`var-attr-${i}`}
                    name="var_attribute"
                    value={row.attribute}
                    onChange={(e) => updateVariant(i, { attribute: e.target.value })}
                    placeholder="Brand"
                  />
                </Field>
                <Field label={i === 0 ? 'Value' : ''} htmlFor={`var-value-${i}`}>
                  <Input
                    id={`var-value-${i}`}
                    name="var_value"
                    value={row.value}
                    onChange={(e) => updateVariant(i, { value: e.target.value })}
                    placeholder="Odoo"
                  />
                </Field>
                <Field label={i === 0 ? 'Price extra (₹)' : ''} htmlFor={`var-extra-${i}`}>
                  <Input
                    id={`var-extra-${i}`}
                    name="var_priceExtra"
                    inputMode="decimal"
                    value={row.priceExtra}
                    onChange={(e) => updateVariant(i, { priceExtra: e.target.value })}
                    placeholder="560"
                  />
                </Field>
                <div className="flex h-9 items-center">
                  {row.id ? <input type="hidden" name="var_id" value={row.id} /> : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove variant ${row.attribute} ${row.value}`}
                    onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => setVariants((rows) => [...rows, { attribute: '', value: '', priceExtra: '0' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add variant
        </Button>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : productId ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}
