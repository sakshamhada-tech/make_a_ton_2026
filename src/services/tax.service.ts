import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertAdmin, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { formatBps } from '@/lib/money';
import { taxSchema, type TaxInput } from '@/validation/catalog';

export interface TaxListItem {
  id: string;
  name: string;
  rateBps: number;
  appliesTo: string;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
}

export async function listTaxes(actor: Actor, params: ListParams) {
  assertStaff(actor);
  const [items, total] = await Promise.all([
    db.tax.findMany({
      orderBy: { rateBps: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { _count: { select: { products: true } } },
    }),
    db.tax.count(),
  ]);
  return {
    items: items.map((t): TaxListItem => ({
      id: t.id,
      name: t.name,
      rateBps: t.rateBps,
      appliesTo: t.appliesTo,
      isActive: t.isActive,
      productCount: t._count.products,
      createdAt: t.createdAt,
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

export async function listAllTaxes(actor: Actor) {
  assertStaff(actor);
  return db.tax.findMany({ where: { isActive: true }, orderBy: { rateBps: 'desc' } });
}

function parseTax(raw: unknown): TaxInput {
  const parsed = taxSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid tax');
  }
  return parsed.data;
}

export async function createTax(actor: Actor, raw: unknown): Promise<string> {
  assertAdmin(actor);
  const input = parseTax(raw);
  const t = await db.tax.create({
    data: {
      name: input.name,
      rateBps: input.rate,
      appliesTo: input.appliesTo,
      isActive: input.isActive ?? true,
      products:
        input.appliesTo === 'PRODUCTS'
          ? { create: input.productIds.map((productId) => ({ product: { connect: { id: productId } } })) }
          : undefined,
    },
  });
  return t.id;
}

export async function updateTax(actor: Actor, id: string, raw: unknown): Promise<void> {
  assertAdmin(actor);
  const input = parseTax(raw);
  const existing = await db.tax.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Tax not found.');
  await db.$transaction([
    db.taxProduct.deleteMany({ where: { taxId: id } }),
    db.tax.update({
      where: { id },
      data: {
        name: input.name,
        rateBps: input.rate,
        appliesTo: input.appliesTo,
        isActive: input.isActive ?? true,
      },
    }),
    ...(input.appliesTo === 'PRODUCTS' && input.productIds.length > 0
      ? [db.taxProduct.createMany({ data: input.productIds.map((pid) => ({ taxId: id, productId: pid })) })]
      : []),
  ]);
}

export interface TaxChoice {
  id: string;
  name: string;
  rateBps: number;
  label: string;
}

/** Taxes applicable to a product, product-specific rules first. */
export async function taxesForProduct(productId: string): Promise<TaxChoice[]> {
  const [productRules, generalRules] = await Promise.all([
    db.tax.findMany({
      where: { isActive: true, appliesTo: 'PRODUCTS', products: { some: { productId } } },
      orderBy: { rateBps: 'asc' },
    }),
    db.tax.findMany({ where: { isActive: true, appliesTo: 'ALL' }, orderBy: { rateBps: 'asc' } }),
  ]);
  const seen = new Set<string>();
  const choices: TaxChoice[] = [];
  for (const t of [...productRules, ...generalRules]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    choices.push({ id: t.id, name: t.name, rateBps: t.rateBps, label: `${t.name} (${formatBps(t.rateBps)})` });
  }
  return choices;
}

/** Default tax for a product line: product-specific rule first, else broadest. */
export async function defaultTaxForProduct(productId: string): Promise<TaxChoice | null> {
  const choices = await taxesForProduct(productId);
  return choices[0] ?? null;
}
