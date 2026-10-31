import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

export interface Fixture {
  admin: { id: string; role: 'ADMIN'; customerId: null };
  staff: { id: string; role: 'STAFF'; customerId: null };
  customerA: { id: string; role: 'CUSTOMER'; customerId: string };
  customerB: { id: string; role: 'CUSTOMER'; customerId: string };
  planMonthly: { id: string; period: string; price: number; minQuantity: number; allowPause: boolean; allowEarlyClose: boolean; allowRenew: boolean };
  product: { id: string; salesPrice: number };
  customerIdA: string;
  customerIdB: string;
}

/** Create minimal test fixtures directly in the database. */
export async function createFixture(): Promise<Fixture> {
  const suffix = randomBytes(4).toString('hex');
  const now = new Date();

  const customerA = await db.customer.create({
    data: { name: `Alpha Labs ${suffix}`, email: `alpha-${suffix}@example.test` },
  });
  const customerB = await db.customer.create({
    data: { name: `Beta Industries ${suffix}`, email: `beta-${suffix}@example.test` },
  });

  const admin = await db.user.create({
    data: {
      email: `admin-${suffix}@example.test`,
      passwordHash: 'x',
      name: 'Test Admin',
      role: 'ADMIN',
    },
  });
  const staff = await db.user.create({
    data: {
      email: `staff-${suffix}@example.test`,
      passwordHash: 'x',
      name: 'Test Staff',
      role: 'STAFF',
    },
  });
  const userA = await db.user.create({
    data: {
      email: `user-a-${suffix}@example.test`,
      passwordHash: 'x',
      name: 'Alpha User',
      role: 'CUSTOMER',
      customerId: customerA.id,
    },
  });
  const userB = await db.user.create({
    data: {
      email: `user-b-${suffix}@example.test`,
      passwordHash: 'x',
      name: 'Beta User',
      role: 'CUSTOMER',
      customerId: customerB.id,
    },
  });

  const plan = await db.plan.create({
    data: {
      name: `Test Monthly ${suffix}`,
      price: 100_000,
      period: 'MONTHLY',
      minQuantity: 2,
      availableFrom: new Date(now.getTime() - 30 * 86_400_000),
      autoClose: true,
      allowEarlyClose: true,
      allowPause: true,
      allowRenew: true,
    },
  });
  const product = await db.product.create({
    data: { name: `Test Add-on ${suffix}`, type: 'addon', salesPrice: 50_000, costPrice: 20_000 },
  });
  await db.tax.create({
    data: { name: `GST 18 ${suffix}`, rateBps: 1800, appliesTo: 'ALL' },
  });

  return {
    admin: { id: admin.id, role: 'ADMIN', customerId: null },
    staff: { id: staff.id, role: 'STAFF', customerId: null },
    customerA: { id: userA.id, role: 'CUSTOMER', customerId: customerA.id },
    customerB: { id: userB.id, role: 'CUSTOMER', customerId: customerB.id },
    planMonthly: {
      id: plan.id,
      period: plan.period,
      price: plan.price,
      minQuantity: plan.minQuantity,
      allowPause: plan.allowPause,
      allowEarlyClose: plan.allowEarlyClose,
      allowRenew: plan.allowRenew,
    },
    product: { id: product.id, salesPrice: product.salesPrice },
    customerIdA: customerA.id,
    customerIdB: customerB.id,
  };
}

export function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
