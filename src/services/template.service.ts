import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertAdmin, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { templateSchema, type TemplateInput } from '@/validation/catalog';

export interface TemplateListItem {
  id: string;
  name: string;
  validityDays: number;
  planName: string;
  lineCount: number;
  isActive: boolean;
  createdAt: Date;
}

export async function listTemplates(actor: Actor, params: ListParams) {
  assertStaff(actor);
  const [items, total] = await Promise.all([
    db.quoteTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { plan: { select: { name: true } }, _count: { select: { lines: true } } },
    }),
    db.quoteTemplate.count(),
  ]);
  return {
    items: items.map((t): TemplateListItem => ({
      id: t.id,
      name: t.name,
      validityDays: t.validityDays,
      planName: t.plan.name,
      lineCount: t._count.lines,
      isActive: t.isActive,
      createdAt: t.createdAt,
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

export interface TemplateDetail {
  id: string;
  name: string;
  validityDays: number;
  planId: string;
  planName: string;
  isActive: boolean;
  lines: {
    id: string;
    productId: string | null;
    productName: string | null;
    variantOptionId: string | null;
    variantLabel: string | null;
    quantity: number;
    taxId: string | null;
    taxName: string | null;
  }[];
}

export async function getTemplate(actor: Actor, id: string): Promise<TemplateDetail> {
  assertStaff(actor);
  const t = await db.quoteTemplate.findUnique({
    where: { id },
    include: {
      plan: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { product: true, variantOption: true, tax: true },
      },
    },
  });
  if (!t) throw new NotFoundError('Template not found.');
  return {
    id: t.id,
    name: t.name,
    validityDays: t.validityDays,
    planId: t.planId,
    planName: t.plan.name,
    isActive: t.isActive,
    lines: t.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name ?? null,
      variantOptionId: l.variantOptionId,
      variantLabel: l.variantOption ? `${l.variantOption.attribute}: ${l.variantOption.value}` : null,
      quantity: l.quantity,
      taxId: l.taxId,
      taxName: l.tax ? `${l.tax.name}` : null,
    })),
  };
}

export async function listActiveTemplates(actor: Actor): Promise<TemplateDetail[]> {
  assertStaff(actor);
  const templates = await db.quoteTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      plan: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { product: true, variantOption: true, tax: true },
      },
    },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    validityDays: t.validityDays,
    planId: t.planId,
    planName: t.plan.name,
    isActive: t.isActive,
    lines: t.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name ?? null,
      variantOptionId: l.variantOptionId,
      variantLabel: l.variantOption ? `${l.variantOption.attribute}: ${l.variantOption.value}` : null,
      quantity: l.quantity,
      taxId: l.taxId,
      taxName: l.tax?.name ?? null,
    })),
  }));
}

function parseTemplate(raw: unknown): TemplateInput {
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid template');
  }
  return parsed.data;
}

export async function createTemplate(actor: Actor, raw: unknown): Promise<string> {
  assertAdmin(actor);
  const input = parseTemplate(raw);
  const plan = await db.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new ValidationError('Selected plan does not exist.');
  const productIds = input.lines.map((l) => l.productId);
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== new Set(productIds).size) {
    throw new ValidationError('One or more selected products no longer exist.');
  }
  const t = await db.quoteTemplate.create({
    data: {
      name: input.name,
      validityDays: input.validityDays,
      planId: input.planId,
      lines: {
        create: input.lines.map((l, i) => ({
          productId: l.productId,
          variantOptionId: l.variantOptionId || null,
          quantity: l.quantity,
          taxId: l.taxId || null,
          sortOrder: i,
        })),
      },
    },
  });
  return t.id;
}
