import { requireUser } from '@/lib/auth';
import { listTaxes } from '@/services/tax.service';
import { db } from '@/lib/db';
import { listProducts } from '@/services/product.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { TaxForm } from '@/app/(app)/taxes/tax-form';
import { formatBps } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import Link from 'next/link';

export const metadata = { title: 'Taxes' };
export const dynamic = 'force-dynamic';

export default async function TaxesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'name', defaultDir: 'asc' });
  const { items } = await listTaxes(actor, listParams);
  const canEdit = actor.role === 'ADMIN';
  const editId = str(params, 'edit');
  const [products, editTax] = await Promise.all([
    listProducts(actor, { page: 1, pageSize: 100, sort: 'name', dir: 'asc' }),
    editId
      ? db.tax.findUnique({ where: { id: editId }, include: { products: true } })
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title="Taxes"
        description="Tax rules are applied automatically to matching subscription lines."
      />

      {canEdit ? (
        <section className="card-panel mb-6 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            {editTax ? `Edit tax rule: ${editTax.name}` : 'New tax rule'}
          </h2>
          <TaxForm
            taxId={editTax?.id}
            products={products.items}
            initial={
              editTax
                ? {
                    name: editTax.name,
                    rate: (editTax.rateBps / 100).toString(),
                    appliesTo: editTax.appliesTo,
                    isActive: editTax.isActive,
                  }
                : undefined
            }
            initialProductIds={editTax?.products.map((p) => p.productId)}
          />
        </section>
      ) : null}

      {items.length === 0 ? (
        <p className="card-panel px-4 py-8 text-center text-xs text-zinc-500">No tax rules defined yet.</p>
      ) : (
        <Table>
          <THead>
            <TH>Name</TH>
            <TH align="right">Rate</TH>
            <TH>Applies to</TH>
            <TH align="right">Products</TH>
            <TH>Status</TH>
            <TH>Created</TH>
            {canEdit ? <TH></TH> : null}
          </THead>
          <tbody>
            {items.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium text-zinc-900">{t.name}</TD>
                <TD align="right" className="tabular-nums">
                  {formatBps(t.rateBps)}
                </TD>
                <TD className="text-zinc-600">{t.appliesTo === 'ALL' ? 'All products' : 'Selected products'}</TD>
                <TD align="right" className="tabular-nums text-zinc-600">
                  {t.appliesTo === 'ALL' ? '—' : t.productCount}
                </TD>
                <TD>
                  <StatusBadge label={t.isActive ? 'Active' : 'Inactive'} tone={t.isActive ? 'emerald' : 'zinc'} />
                </TD>
                <TD className="text-zinc-600">{formatDate(t.createdAt)}</TD>
                {canEdit ? (
                  <TD>
                    <Link href={`/taxes?edit=${t.id}`} className="text-xs text-accent-text hover:underline">
                      Edit
                    </Link>
                  </TD>
                ) : null}
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
