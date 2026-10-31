import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createFixture, isoDaysFromNow, type Fixture } from './helpers';
import { assertAdmin, assertCustomerAccess, assertStaff } from '@/lib/rbac';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { getSubscription, listSubscriptions, createSubscription } from '@/services/subscription.service';
import { getInvoice, listInvoices } from '@/services/invoice.service';
import { createProduct } from '@/services/product.service';
import { createStaffAccount } from '@/services/auth.service';
import { generateInvoiceForSubscription } from '@/services/invoice.service';
import { transitionSubscription } from '@/services/subscription.service';

let fx: Fixture;

async function subscriptionFor(customerId: string): Promise<string> {
  const id = await createSubscription(fx.admin, {
    customerId,
    planId: fx.planMonthly.id,
    quantity: '2',
    startDate: isoDaysFromNow(-5),
    endDate: isoDaysFromNow(200),
    paymentTerms: 'Net 15',
    lines: [],
  });
  return id;
}

beforeEach(async () => {
  await db.discount.deleteMany({});
  fx = await createFixture();
});

describe('role guards', () => {
  it('staff cannot perform admin-only actions', () => {
    expect(() => assertAdmin(fx.staff)).toThrow(ForbiddenError);
    expect(() => assertAdmin(fx.admin)).not.toThrow();
  });

  it('customers cannot perform staff actions', () => {
    expect(() => assertStaff(fx.customerA)).toThrow(ForbiddenError);
    expect(() => assertStaff(fx.staff)).not.toThrow();
  });

  it('product creation is rejected for staff and customers', async () => {
    const payload = {
      name: 'Unauthorized Product',
      type: 'license',
      salesPrice: '100.00',
      costPrice: '40.00',
      notes: '',
      isActive: true,
      variantOptions: [],
    };
    await expect(createProduct(fx.staff, payload)).rejects.toThrow(ForbiddenError);
    await expect(createProduct(fx.customerA, payload)).rejects.toThrow(ForbiddenError);
    await expect(createProduct(fx.admin, payload)).resolves.toBeTruthy();
  });

  it('only admins can create staff accounts', async () => {
    const payload = { name: 'New Staff', email: 'newstaff@example.test', password: 'Str0ng!Pass', role: 'STAFF' };
    await expect(createStaffAccount(fx.staff, payload)).rejects.toThrow(ForbiddenError);
    await expect(createStaffAccount(fx.customerA, payload)).rejects.toThrow(ForbiddenError);
    const created = await createStaffAccount(fx.admin, payload);
    expect(created.role).toBe('STAFF');
  });

  it('assertCustomerAccess allows staff but blocks mismatched customers', () => {
    expect(() => assertCustomerAccess(fx.staff, fx.customerIdB)).not.toThrow();
    expect(() => assertCustomerAccess(fx.customerA, fx.customerIdA)).not.toThrow();
    expect(() => assertCustomerAccess(fx.customerA, fx.customerIdB)).toThrow(ForbiddenError);
    expect(() => assertCustomerAccess(fx.admin, fx.customerIdB)).not.toThrow(); // staff-role bypass
  });
});

describe('customer data isolation', () => {
  it('a customer cannot read another customer’s subscription', async () => {
    const subA = await subscriptionFor(fx.customerIdA);

    // Owner can read it.
    const owned = await getSubscription(fx.customerA, subA);
    expect(owned.id).toBe(subA);

    // Another customer gets forbidden, surfaced as not-found style error.
    await expect(getSubscription(fx.customerB, subA)).rejects.toThrow(ForbiddenError);
  });

  it('a customer’s subscription list only contains their own records', async () => {
    await subscriptionFor(fx.customerIdA);
    await subscriptionFor(fx.customerIdB);

    const listA = await listSubscriptions(fx.customerA, { page: 1, pageSize: 100, sort: 'createdAt', dir: 'desc' });
    expect(listA.items.length).toBeGreaterThan(0);
    for (const item of listA.items) {
      expect(item.customerId).toBe(fx.customerIdA);
    }

    const listB = await listSubscriptions(fx.customerB, { page: 1, pageSize: 100, sort: 'createdAt', dir: 'desc' });
    for (const item of listB.items) {
      expect(item.customerId).toBe(fx.customerIdB);
    }
  });

  it('a customer cannot read another customer’s invoice', async () => {
    const subA = await subscriptionFor(fx.customerIdA);
    await transitionSubscription(fx.admin, subA, 'QUOTATION');
    await transitionSubscription(fx.admin, subA, 'CONFIRMED');
    await transitionSubscription(fx.admin, subA, 'ACTIVE');
    const result = await generateInvoiceForSubscription(subA, fx.admin.id);
    expect(result.outcome).toBe('created');

    const invoiceId = result.invoiceId as string;
    const owned = await getInvoice(fx.customerA, invoiceId);
    expect(owned.id).toBe(invoiceId);
    await expect(getInvoice(fx.customerB, invoiceId)).rejects.toThrow(ForbiddenError);
  });

  it('customers cannot list all invoices', async () => {
    const subA = await subscriptionFor(fx.customerIdA);
    await transitionSubscription(fx.admin, subA, 'QUOTATION');
    await transitionSubscription(fx.admin, subA, 'CONFIRMED');
    await transitionSubscription(fx.admin, subA, 'ACTIVE');
    await generateInvoiceForSubscription(subA, fx.admin.id);

    const ownList = await listInvoices(fx.customerA, { page: 1, pageSize: 50, sort: 'issueDate', dir: 'desc' });
    for (const item of ownList.items) {
      expect(item.customerId).toBe(fx.customerIdA);
    }

    const otherList = await listInvoices(fx.customerB, { page: 1, pageSize: 50, sort: 'issueDate', dir: 'desc' });
    for (const item of otherList.items) {
      expect(item.customerId).toBe(fx.customerIdB);
    }
  });

  it('portal lifecycle actions reject other customers’ subscriptions', async () => {
    const subA = await subscriptionFor(fx.customerIdA);
    await transitionSubscription(fx.admin, subA, 'QUOTATION');
    await transitionSubscription(fx.admin, subA, 'CONFIRMED');
    await transitionSubscription(fx.admin, subA, 'ACTIVE');
    const { portalPauseSubscription } = await import('@/services/subscription.service');
    await expect(portalPauseSubscription(fx.customerB, subA)).rejects.toThrow(ForbiddenError);
    // Owner can pause (plan allows pause).
    await expect(portalPauseSubscription(fx.customerA, subA)).resolves.toBeUndefined();
  });
});

describe('server-side validation errors', () => {
  it('rejects malformed inputs with validation errors', async () => {
    await expect(
      createSubscription(fx.admin, {
        customerId: fx.customerIdA,
        planId: 'missing-plan',
        quantity: '0',
        startDate: 'not-a-date',
        endDate: '2026-01-01',
        paymentTerms: 'Net 15',
        lines: [],
      }),
    ).rejects.toThrow(ValidationError);
  });
});
