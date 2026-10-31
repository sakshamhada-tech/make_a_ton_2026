'use client';

import { useActionState, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createSubscriptionAction } from '@/actions/subscriptions';
import { Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { initialActionState } from '@/lib/action-state';
import { PERIOD_LABELS, PAYMENT_TERMS, type BillingPeriod } from '@/lib/enums';
import { formatMoney } from '@/lib/money';

export interface FormCustomer {
  id: string;
  name: string;
  email: string;
}

export interface FormVariant {
  id: string;
  label: string;
  priceExtra: number;
}

export interface FormProduct {
  id: string;
  name: string;
  salesPrice: number;
  variants: FormVariant[];
  taxes: { id: string; label: string }[];
}

export interface FormPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  minQuantity: number;
}

export interface FormTemplate {
  id: string;
  name: string;
  planName?: string;
  planId: string;
  validityDays: number;
  lines: { productId: string; variantOptionId: string | null; quantity: number }[];
}

interface LineState {
  productId: string;
  variantOptionId: string;
  quantity: string;
  taxId: string;
}

export function SubscriptionForm({
  customers,
  plans,
  products,
  templates,
  initialTemplateId,
  defaults,
}: {
  customers: FormCustomer[];
  plans: FormPlan[];
  products: FormProduct[];
  templates: FormTemplate[];
  initialTemplateId?: string;
  defaults: { startDate: string; endDate: string };
}) {
  const [state, formAction, pending] = useActionState(createSubscriptionAction, initialActionState);
  const [planId, setPlanId] = useState(
    templates.find((t) => t.id === initialTemplateId)?.planId ?? plans[0]?.id ?? '',
  );
  const [templateId, setTemplateId] = useState(initialTemplateId ?? '');
  const [lines, setLines] = useState<LineState[]>(() => {
    const template = templates.find((t) => t.id === initialTemplateId);
    if (!template) return [];
    return template.lines.map((l) => {
      const product = products.find((p) => p.id === l.productId);
      return {
        productId: l.productId,
        variantOptionId: l.variantOptionId ?? '',
        quantity: String(l.quantity),
        taxId: product?.taxes[0]?.id ?? '',
      };
    });
  });

  const plan = plans.find((p) => p.id === planId);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setPlanId(template.planId);
    setLines(
      template.lines.map((l) => {
        const product = products.find((p) => p.id === l.productId);
        return {
          productId: l.productId,
          variantOptionId: l.variantOptionId ?? '',
          quantity: String(l.quantity),
          taxId: product?.taxes[0]?.id ?? '',
        };
      }),
    );
  };

  const linePreview = useMemo(() => {
    return lines.map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return { amount: 0, unit: 0 };
      const variant = product.variants.find((v) => v.id === line.variantOptionId);
      const unit = product.salesPrice + (variant?.priceExtra ?? 0);
      const qty = Math.max(Number.parseInt(line.quantity, 10) || 0, 0);
      return { amount: unit * qty, unit };
    });
  }, [lines, products]);

  const linesSubtotal = linePreview.reduce((s, l) => s + l.amount, 0);

  function addLine() {
    const first = products[0];
    if (!first) return;
    setLines((rows) => [
      ...rows,
      { productId: first.id, variantOptionId: '', quantity: '1', taxId: first.taxes[0]?.id ?? '' },
    ]);
  }

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-5" noValidate>
      {state.message ? (
        <p className="form-error-summary" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer" htmlFor="customerId" required error={state.errors?.customerId}>
          <Select id="customerId" name="customerId" defaultValue="" required>
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="From template"
          htmlFor="templateId"
          error={state.errors?.templateId}
          hint="Prefills plan and product lines."
        >
          <Select id="templateId" name="templateId" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.planName ?? 'plan'})
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Plan"
          htmlFor="planId"
          required
          error={state.errors?.planId}
          hint={plan ? `${formatMoney(plan.price)} / ${PERIOD_LABELS[plan.period as BillingPeriod]?.toLowerCase()} · min qty ${plan.minQuantity}` : undefined}
        >
          <Select id="planId" name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatMoney(p.price)}/{PERIOD_LABELS[p.period as BillingPeriod]?.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Quantity"
          htmlFor="quantity"
          required
          error={state.errors?.quantity}
          hint={plan ? `Minimum ${plan.minQuantity}` : undefined}
        >
          <Input id="quantity" name="quantity" type="number" min="1" defaultValue={String(plan?.minQuantity ?? 1)} required />
        </Field>
        <Field label="Start date" htmlFor="startDate" required error={state.errors?.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={defaults.startDate} required />
        </Field>
        <Field label="Expiry date" htmlFor="endDate" required error={state.errors?.endDate}>
          <Input id="endDate" name="endDate" type="date" defaultValue={defaults.endDate} required />
        </Field>
        <Field label="Payment terms" htmlFor="paymentTerms" required error={state.errors?.paymentTerms}>
          <Select id="paymentTerms" name="paymentTerms" defaultValue="Net 15">
            {PAYMENT_TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="rounded border border-zinc-200 p-4">
        <legend className="px-1 text-xs font-semibold text-zinc-700">Product lines</legend>
        <p className="mb-3 text-2xs text-zinc-500">
          Unit price = product base price + variant extra. The plan line is added automatically.
        </p>
        {lines.length === 0 ? (
          <p className="text-xs text-zinc-500">No product lines yet. The plan line is always included.</p>
        ) : (
          <ul className="space-y-3">
            {lines.map((line, i) => {
              const product = products.find((p) => p.id === line.productId);
              const preview = linePreview[i];
              return (
                <li key={i} className="grid items-end gap-2 sm:grid-cols-[2fr_1.4fr_4rem_1.4fr_5rem_auto]">
                  <Field label={i === 0 ? 'Product' : ''} htmlFor={`line-prod-${i}`}>
                    <Select
                      id={`line-prod-${i}`}
                      name="line_productId"
                      value={line.productId}
                      onChange={(e) => {
                        const nextProduct = products.find((p) => p.id === e.target.value);
                        updateLine(i, {
                          productId: e.target.value,
                          variantOptionId: '',
                          taxId: nextProduct?.taxes[0]?.id ?? '',
                        });
                      }}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={i === 0 ? 'Variant' : ''} htmlFor={`line-variant-${i}`}>
                    <Select
                      id={`line-variant-${i}`}
                      name="line_variantOptionId"
                      value={line.variantOptionId}
                      onChange={(e) => updateLine(i, { variantOptionId: e.target.value })}
                    >
                      <option value="">None</option>
                      {product?.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label} (+{formatMoney(v.priceExtra)})
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
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    />
                  </Field>
                  <Field label={i === 0 ? 'Tax' : ''} htmlFor={`line-tax-${i}`}>
                    <Select id={`line-tax-${i}`} name="line_taxId" value={line.taxId} onChange={(e) => updateLine(i, { taxId: e.target.value })}>
                      {product?.taxes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                      {product?.taxes.length === 0 ? <option value="">No tax</option> : null}
                    </Select>
                  </Field>
                  <div className="pb-1.5 text-right text-xs tabular-nums text-zinc-600">
                    {preview ? formatMoney(preview.amount) : ''}
                  </div>
                  <div className="flex h-9 items-center">
                    <Button variant="ghost" size="sm" aria-label="Remove line" onClick={() => setLines((rows) => rows.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={addLine} disabled={products.length === 0}>
            <Plus className="h-3.5 w-3.5" /> Add product line
          </Button>
          <p className="text-xs text-zinc-600">
            Plan line: <span className="tabular-nums">{formatMoney(plan?.price ?? 0)}</span> · Product lines:{' '}
            <span className="tabular-nums">{formatMoney(linesSubtotal)}</span>
          </p>
        </div>
      </fieldset>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create draft subscription'}
        </Button>
      </div>
    </form>
  );
}
