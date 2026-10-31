import { requireUser } from '@/lib/auth';
import { getProduct } from '@/services/product.service';
import { PageHeader } from '@/components/ui/page-header';
import { ProductForm } from '@/app/(app)/products/product-form';
import { Money } from '@/components/ui/money';
import { StatusBadge, Pill } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';
import { formatBps } from '@/lib/money';
import { notFound } from 'next/navigation';
import { NotFoundError } from '@/lib/errors';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Product' };
export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const { id } = await params;
  const sp = await searchParams;
  let product;
  try {
    product = await getProduct(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const canEdit = actor.role === 'ADMIN';
  const notice = str(sp, 'saved') ? 'Product saved.' : str(sp, 'created') ? 'Product created.' : undefined;

  return (
    <div>
      <PageHeader
        title={product.name}
        description={`Created ${formatDate(product.createdAt)} · ${product.type}`}
        actions={<StatusBadge label={product.isActive ? 'Active' : 'Inactive'} tone={product.isActive ? 'emerald' : 'zinc'} />}
      />
      {notice ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Sales price</p>
          <p className="mt-1 text-sm font-semibold">
            <Money minor={product.salesPrice} />
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Cost price</p>
          <p className="mt-1 text-sm font-semibold">
            <Money minor={product.costPrice} muted />
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Applied taxes</p>
          <p className="mt-1 flex flex-wrap gap-1">
            {product.taxAssignments.length === 0 ? (
              <span className="text-xs text-zinc-500">General rules only</span>
            ) : (
              product.taxAssignments.map((t) => (
                <Pill key={t.id}>
                  {t.name} ({formatBps(t.rateBps)})
                </Pill>
              ))
            )}
          </p>
        </div>
      </div>

      {canEdit ? (
        <ProductForm
          productId={product.id}
          initial={{
            name: product.name,
            type: product.type,
            salesPrice: (product.salesPrice / 100).toFixed(2),
            costPrice: (product.costPrice / 100).toFixed(2),
            notes: product.notes ?? '',
            isActive: product.isActive,
            variants: product.variantOptions.map((v) => ({
              id: v.id,
              attribute: v.attribute,
              value: v.value,
              priceExtra: (v.priceExtra / 100).toFixed(2),
            })),
          }}
        />
      ) : (
        <div className="card-panel p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Variant options</h2>
          {product.variantOptions.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">No variants defined.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {product.variantOptions.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2 text-xs">
                  <span>
                    {v.attribute}: <span className="font-medium">{v.value}</span>
                  </span>
                  <Money minor={v.priceExtra} />
                </li>
              ))}
            </ul>
          )}
          {product.notes ? <p className="mt-3 whitespace-pre-wrap text-xs text-zinc-600">{product.notes}</p> : null}
        </div>
      )}
    </div>
  );
}
