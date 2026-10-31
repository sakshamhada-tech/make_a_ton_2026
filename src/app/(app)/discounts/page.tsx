import { requireUser } from '@/lib/auth';
import { listDiscounts } from '@/services/discount.service';
import { db } from '@/lib/db';
import { listProducts } from '@/services/product.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/badge';
import { DiscountForm } from '@/app/(app)/discounts/discount-form';
import { formatMoney } from '@/lib/money';
import { todayUtc, toDateInput } from '@/lib/dates';
import Link from 'next/link';

export const metadata = { title: 'Discounts' };
export const dynamic = 'force-dynamic';

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'createdAt', defaultDir: 'desc' });
  const { items, meta } = await listDiscounts(actor, listParams);
  const canEdit = actor.role === 'ADMIN';
  const editId = str(params, 'edit');
  const [products, editDiscount] = await Promise.all([
    listProducts(actor, { page: 1, pageSize: 100, sort: 'name', dir: 'asc' }),
    editId
      ? db.discount.findUnique({ where: { id: editId }, include: { products: true } })
      : Promise.resolve(null),
  ]);
  const query = { page: undefined };
  const today = todayUtc();

  return (
    <div>
      <PageHeader
        title="Discounts"
        description="Eligible discounts apply automatically to the next invoice and stop when expired or exhausted."
      />

      {canEdit ? (
        <section className="card-panel mb-6 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            {editDiscount ? `Edit discount: ${editDiscount.name}` : 'New discount'}
          </h2>
          <DiscountForm
            discountId={editDiscount?.id}
            products={products.items}
            initial={
              editDiscount
                ? {
                    name: editDiscount.name,
                    type: editDiscount.type,
                    valueRaw:
                      editDiscount.type === 'PERCENT'
                        ? (editDiscount.value / 100).toString()
                        : (editDiscount.value / 100).toFixed(2),
                    minPurchaseRaw: editDiscount.minPurchase !== null ? (editDiscount.minPurchase / 100).toFixed(2) : '',
                    minQuantityRaw: editDiscount.minQuantity !== null ? String(editDiscount.minQuantity) : '',
                    usageLimitRaw: editDiscount.usageLimit !== null ? String(editDiscount.usageLimit) : '',
                    startsAt: toDateInput(editDiscount.startsAt),
                    endsAt: toDateInput(editDiscount.endsAt),
                    scope: editDiscount.scope,
                    isActive: editDiscount.isActive,
                    productIds: editDiscount.products.map((p) => p.productId),
                  }
                : undefined
            }
          />
        </section>
      ) : null}

      {items.length === 0 ? (
        <p className="card-panel px-4 py-8 text-center text-xs text-zinc-500">No discounts defined yet.</p>
      ) : (
        <>
          <Table>
            <THead>
              <TH>Name</TH>
              <TH>Value</TH>
              <TH>Scope</TH>
              <TH>Window</TH>
              <TH align="right">Usage</TH>
              <TH>Status</TH>
              {canEdit ? <TH></TH> : null}
            </THead>
            <tbody>
              {items.map((d) => {
                const expired = d.endsAt.getTime() < today.getTime();
                const exhausted = d.usageLimit !== null && d.usedCount >= d.usageLimit;
                return (
                  <TR key={d.id}>
                    <TD className="font-medium text-zinc-900">
                      {d.name}
                      {d.minPurchase !== null ? (
                        <span className="ml-2 text-2xs font-normal text-zinc-500">
                          min {formatMoney(d.minPurchase)}
                        </span>
                      ) : null}
                      {d.minQuantity !== null ? (
                        <span className="ml-2 text-2xs font-normal text-zinc-500">min qty {d.minQuantity}</span>
                      ) : null}
                    </TD>
                    <TD className="tabular-nums">{d.valueLabel}</TD>
                    <TD className="text-zinc-600">{d.scope === 'PRODUCTS' ? 'Selected products' : 'Whole subscription'}</TD>
                    <TD className="text-xs text-zinc-600">{d.periodLabel}</TD>
                    <TD align="right" className="tabular-nums text-zinc-600">
                      {d.usedCount}
                      {d.usageLimit !== null ? ` / ${d.usageLimit}` : ''}
                    </TD>
                    <TD>
                      {exhausted ? (
                        <StatusBadge label="Exhausted" tone="zinc" />
                      ) : expired ? (
                        <StatusBadge label="Expired" tone="zinc" />
                      ) : d.isActive ? (
                        <StatusBadge label="Active" tone="emerald" />
                      ) : (
                        <StatusBadge label="Inactive" tone="zinc" />
                      )}
                    </TD>
                    {canEdit ? (
                      <TD>
                        <Link href={`/discounts?edit=${d.id}`} className="text-xs text-accent-text hover:underline">
                          Edit
                        </Link>
                      </TD>
                    ) : null}
                  </TR>
                );
              })}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/discounts" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
