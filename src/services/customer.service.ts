import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { customerSchema, type CustomerInput } from '@/validation/catalog';

export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  city: string | null;
  country: string;
  hasPortalLogin: boolean;
  subscriptionCount: number;
  outstandingMinor: number;
}

export async function listCustomers(
  actor: Actor,
  params: ListParams,
  filters: { q?: string } = {},
) {
  assertStaff(actor);
  const where: Prisma.CustomerWhereInput = filters.q
    ? {
        OR: [
          { name: { contains: filters.q } },
          { email: { contains: filters.q } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { [params.sort === 'email' ? 'email' : params.sort === 'name' ? 'name' : 'createdAt']: params.dir },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        user: { select: { id: true } },
        _count: { select: { subscriptions: true } },
        invoices: { where: { status: 'CONFIRMED' }, select: { total: true, paidTotal: true } },
      },
    }),
    db.customer.count({ where }),
  ]);
  return {
    items: items.map((c): CustomerListItem => ({
      id: c.id,
      name: c.name,
      email: c.email,
      city: c.city,
      country: c.country,
      hasPortalLogin: c.user !== null,
      subscriptionCount: c._count.subscriptions,
      outstandingMinor: c.invoices.reduce((sum, i) => sum + (i.total - i.paidTotal), 0),
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

export async function listAllCustomers(actor: Actor) {
  assertStaff(actor);
  return db.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } });
}

export async function getCustomer(actor: Actor, id: string) {
  assertStaff(actor);
  const c = await db.customer.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
  });
  if (!c) throw new NotFoundError('Customer not found.');
  return c;
}

function parseCustomer(raw: unknown): CustomerInput {
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid customer');
  }
  return parsed.data;
}

export async function createCustomer(actor: Actor, raw: unknown): Promise<string> {
  assertStaff(actor);
  const input = parseCustomer(raw);
  const existing = await db.customer.findFirst({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw new ValidationError('A customer with this email already exists.');
  }
  const c = await db.customer.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      country: input.country || 'India',
      postalCode: input.postalCode || null,
      gstin: input.gstin || null,
    },
  });
  return c.id;
}

export async function updateCustomer(actor: Actor, id: string, raw: unknown): Promise<void> {
  assertStaff(actor);
  const input = parseCustomer(raw);
  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Customer not found.');
  await db.customer.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      country: input.country || 'India',
      postalCode: input.postalCode || null,
      gstin: input.gstin || null,
    },
  });
}

/** Customer lookup scoped for the portal (never leaks other customers). */
export async function getOwnCustomer(actor: Actor) {
  if (actor.role !== 'CUSTOMER' || !actor.customerId) {
    throw new ValidationError('No customer profile is linked to this account.');
  }
  return db.customer.findUniqueOrThrow({ where: { id: actor.customerId } });
}
