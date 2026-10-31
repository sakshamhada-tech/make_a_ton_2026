import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertAdmin, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { productSchema, type ProductInput } from '@/validation/catalog';

export interface ProductListItem {
  id: string;
  name: string;
  type: string;
  salesPrice: number;
  costPrice: number;
  isActive: boolean;
  variantCount: number;
}

export interface ProductDetail extends ProductListItem {
  notes: string | null;
  createdAt: Date;
  variantOptions: { id: string; attribute: string; value: string; priceExtra: number }[];
  taxAssignments: { id: string; name: string; rateBps: number }[];
}

export async function listProducts(
  actor: Actor,
  params: ListParams,
  filters: { q?: string; type?: string; status?: string } = {},
) {
  assertStaff(actor);
  const where: Prisma.ProductWhereInput = {
    ...(filters.q ? { name: { contains: filters.q } } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status === 'active' ? { isActive: true } : filters.status === 'inactive' ? { isActive: false } : {}),
  };
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { [sortableColumn(params.sort)]: params.dir },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { _count: { select: { variantOptions: true } } },
    }),
    db.product.count({ where }),
  ]);
  return {
    items: items.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      salesPrice: p.salesPrice,
      costPrice: p.costPrice,
      isActive: p.isActive,
      variantCount: p._count.variantOptions,
    })) satisfies ProductListItem[],
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

function sortableColumn(sort: string): 'name' | 'salesPrice' | 'createdAt' | 'type' {
  if (sort === 'name' || sort === 'salesPrice' || sort === 'type') return sort;
  return 'createdAt';
}

export async function getProduct(actor: Actor, id: string): Promise<ProductDetail> {
  assertStaff(actor);
  const p = await db.product.findUnique({
    where: { id },
    include: {
      variantOptions: { orderBy: [{ attribute: 'asc' }, { value: 'asc' }] },
      taxProducts: { include: { tax: true } },
    },
  });
  if (!p) throw new NotFoundError('Product not found.');
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    salesPrice: p.salesPrice,
    costPrice: p.costPrice,
    isActive: p.isActive,
    notes: p.notes,
    createdAt: p.createdAt,
    variantCount: p.variantOptions.length,
    variantOptions: p.variantOptions.map((v) => ({
      id: v.id,
      attribute: v.attribute,
      value: v.value,
      priceExtra: v.priceExtra,
    })),
    taxAssignments: p.taxProducts.map((t) => ({
      id: t.tax.id,
      name: t.tax.name,
      rateBps: t.tax.rateBps,
    })),
  };
}

export async function createProduct(actor: Actor, raw: unknown): Promise<string> {
  assertAdmin(actor);
  const input = parseProduct(raw);
  const created = await db.product.create({
    data: {
      name: input.name,
      type: input.type,
      salesPrice: input.salesPrice,
      costPrice: input.costPrice,
      notes: input.notes && input.notes !== '' ? input.notes : null,
      isActive: input.isActive ?? true,
      variantOptions: {
        create: input.variantOptions.map((v) => ({
          attribute: v.attribute,
          value: v.value,
          priceExtra: v.priceExtra,
        })),
      },
    },
  });
  return created.id;
}

export async function updateProduct(actor: Actor, id: string, raw: unknown): Promise<void> {
  assertAdmin(actor);
  const input = parseProduct(raw);
  const existing = await db.product.findUnique({ where: { id }, include: { variantOptions: true } });
  if (!existing) throw new NotFoundError('Product not found.');
  const ownedIds = new Set(existing.variantOptions.map((v) => v.id));
  const keepIds = input.variantOptions
    .map((v) => v.id)
    .filter((vid): vid is string => typeof vid === 'string' && vid !== '' && ownedIds.has(vid));
  await db.$transaction([
    db.variantOption.deleteMany({ where: { productId: id, id: { notIn: keepIds } } }),
    db.product.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        salesPrice: input.salesPrice,
        costPrice: input.costPrice,
        notes: input.notes && input.notes !== '' ? input.notes : null,
        isActive: input.isActive ?? true,
      },
    }),
    ...input.variantOptions.map((v) =>
      v.id && keepIds.includes(v.id)
        ? db.variantOption.update({
            where: { id: v.id },
            data: { attribute: v.attribute, value: v.value, priceExtra: v.priceExtra },
          })
        : db.variantOption.create({
            data: { productId: id, attribute: v.attribute, value: v.value, priceExtra: v.priceExtra },
          }),
    ),
  ]);
}

function parseProduct(raw: unknown): ProductInput {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid product');
  }
  return parsed.data;
}
