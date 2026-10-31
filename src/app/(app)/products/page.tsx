import { requireUser } from '@/lib/auth';
import { listProducts } from '@/services/product.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { StatusBadge } from '@/components/ui/badge';
import { FilterBar, FilterSelect, FilterText } from '@/components/ui/filter-bar';
import Link from 'next/link';
import { PRODUCT_TYPES } from '@/lib/enums';

export const metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'name', defaultDir: 'asc' });
  const filters = {
    q: str(params, 'q'),
    type: str(params, 'type'),
    status: str(params, 'status'),
  };
  const { items, meta } = await listProducts(actor, listParams, filters);
  const canEdit = actor.role === 'ADMIN';
  const query = { ...filters, page: undefined, sort: listParams.sort, dir: listParams.dir };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Billable products, variants and unit prices."
        actions={
          canEdit ? (
            <ButtonLink href="/products/new" variant="primary">
              New product
            </ButtonLink>
          ) : undefined
        }
      />

      <FilterBar action="/products" resetHref="/products">
        <FilterText label="Search" name="q" value={filters.q} placeholder="Product name" />
        <FilterSelect
          label="Type"
          name="type"
          value={filters.type}
          options={PRODUCT_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <FilterSelect
          label="Status"
          name="status"
          value={filters.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Adjust the filters or create your first product."
          action={canEdit ? <ButtonLink href="/products/new" variant="primary">New product</ButtonLink> : undefined}
        />
      ) : (
        <>
          <Table>
            <THead>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Name" field="name" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/products" query={query} />
              </th>
              <TH>Type</TH>
              <th scope="col" className="group px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Sales price" field="salesPrice" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/products" query={query} align="right" />
              </th>
              <TH align="right">Cost price</TH>
              <TH align="right">Variants</TH>
              <TH>Status</TH>
            </THead>
            <tbody>
              {items.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/products/${p.id}`} className="font-medium text-accent-text hover:underline">
                      {p.name}
                    </Link>
                  </TD>
                  <TD className="capitalize text-zinc-600">{p.type}</TD>
                  <TD align="right">
                    <Money minor={p.salesPrice} />
                  </TD>
                  <TD align="right">
                    <Money minor={p.costPrice} muted />
                  </TD>
                  <TD align="right" className="tabular-nums text-zinc-600">
                    {p.variantCount > 0 ? p.variantCount : '—'}
                  </TD>
                  <TD>
                    <StatusBadge label={p.isActive ? 'Active' : 'Inactive'} tone={p.isActive ? 'emerald' : 'zinc'} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/products" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
