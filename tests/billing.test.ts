import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createFixture, isoDaysFromNow, type Fixture } from './helpers';
import { createSubscription, transitionSubscription } from '@/services/subscription.service';
import { generateInvoiceForSubscription } from '@/services/invoice.service';
import { runBilling } from '@/services/billing.service';
import { recordPayment } from '@/services/payment.service';
import { createDiscount } from '@/services/discount.service';
import { addBillingPeriod } from '@/lib/dates';

let fx: Fixture;

async function createActiveSubscription(daysSinceStart = 40): Promise<string> {
  const id = await createSubscription(fx.admin, {
    customerId: fx.customerIdA,
    planId: fx.planMonthly.id,
    quantity: '2',
    startDate: isoDaysFromNow(-daysSinceStart),
    endDate: isoDaysFromNow(180),
    paymentTerms: 'Net 15',
    lines: [],
  });
  await transitionSubscription(fx.admin, id, 'QUOTATION');
  await transitionSubscription(fx.admin, id, 'CONFIRMED');
  await transitionSubscription(fx.admin, id, 'ACTIVE');
  return id;
}

beforeEach(async () => {
  // Discounts are global: clear them so each test controls eligibility fully.
  await db.discount.deleteMany({});
  fx = await createFixture();
});

describe('idempotent invoice generation', () => {
  it('creates one invoice per billing period and skips duplicates', async () => {
    const subId = await createActiveSubscription(40);
    const first = await generateInvoiceForSubscription(subId, fx.admin.id);
    expect(first.outcome).toBe('created');

    const firstInvoice = await db.invoice.findUniqueOrThrow({ where: { id: first.invoiceId as string } });
    const subAfterFirst = await db.subscription.findUniqueOrThrow({ where: { id: subId } });
    expect(subAfterFirst.nextBillingDate?.getTime()).toBeGreaterThan(firstInvoice.periodStart.getTime());

    // Rewind the billing cursor to simulate a duplicate request for the
    // same period: the unique (subscription, periodStart) key must hold.
    await db.subscription.update({
      where: { id: subId },
      data: { nextBillingDate: firstInvoice.periodStart },
    });

    const second = await generateInvoiceForSubscription(subId, fx.admin.id);
    expect(second.outcome).toBe('skipped');
    expect(second.reason).toBe('already_billed');

    // No duplicate row and the billing cursor stays where the skip left it.
    const invoices = await db.invoice.findMany({ where: { subscriptionId: subId } });
    expect(invoices).toHaveLength(1);
  });

  it('is idempotent when running the billing run twice for the same date', async () => {
    const subId = await createActiveSubscription(20);
    const asOf = new Date();
    const run1 = await runBilling(fx.admin, asOf);
    const run2 = await runBilling(fx.admin, asOf);

    expect(run1.created).toBeGreaterThanOrEqual(1);
    expect(run2.created).toBe(0);
    const invoices = await db.invoice.findMany({ where: { subscriptionId: subId } });
    expect(invoices).toHaveLength(1);
  });

  it('does not bill paused subscriptions', async () => {
    const subId = await createActiveSubscription(40);
    await db.subscription.update({ where: { id: subId }, data: { pausedAt: new Date() } });
    const result = await generateInvoiceForSubscription(subId, fx.admin.id);
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('paused');
  });

  it('auto-closes past-end subscriptions on auto-close plans during billing', async () => {
    const subId = await createActiveSubscription(40);
    // Push the end date into the past.
    await db.subscription.update({
      where: { id: subId },
      data: { endDate: new Date(Date.now() - 5 * 86_400_000) },
    });
    const run = await runBilling(fx.admin, new Date());
    expect(run.autoClosed).toBeGreaterThanOrEqual(1);
    const sub = await db.subscription.findUniqueOrThrow({ where: { id: subId } });
    expect(sub.status).toBe('CLOSED');
    expect(sub.nextBillingDate).toBeNull();
  });
});

describe('discount application on invoices', () => {
  it('applies an eligible discount and increments usage in the same transaction', async () => {
    const discountId = await createDiscount(fx.admin, {
      name: 'Seeded test offer',
      type: 'PERCENT',
      valueRaw: '10',
      minPurchaseRaw: '',
      minQuantityRaw: '',
      usageLimitRaw: '10',
      startsAt: isoDaysFromNow(-30),
      endsAt: isoDaysFromNow(30),
      scope: 'SUBSCRIPTION',
      productIds: [],
      isActive: true,
    });
    const subId = await createActiveSubscription(5);
    const result = await generateInvoiceForSubscription(subId, fx.admin.id);
    expect(result.outcome).toBe('created');

    const invoice = await db.invoice.findUniqueOrThrow({
      where: { id: result.invoiceId as string },
    });
    expect(invoice.discountId).toBe(discountId);
    expect(invoice.discountTotal).toBeGreaterThan(0);
    expect(invoice.total).toBe(invoice.subtotal - invoice.discountTotal + invoice.taxTotal);

    const discount = await db.discount.findUniqueOrThrow({ where: { id: discountId } });
    expect(discount.usedCount).toBe(1);
  });

  it('stops applying once the usage limit is exhausted', async () => {
    const discountId = await createDiscount(fx.admin, {
      name: 'Exhausted offer',
      type: 'FIXED',
      valueRaw: '100.00',
      minPurchaseRaw: '',
      minQuantityRaw: '',
      usageLimitRaw: '1',
      startsAt: isoDaysFromNow(-30),
      endsAt: isoDaysFromNow(30),
      scope: 'SUBSCRIPTION',
      productIds: [],
      isActive: true,
    });

    const sub1 = await createActiveSubscription(5);
    const inv1 = await generateInvoiceForSubscription(sub1, fx.admin.id);
    const created1 = await db.invoice.findUniqueOrThrow({ where: { id: inv1.invoiceId as string } });
    expect(created1.discountId).toBe(discountId);

    // Second subscription: limit reached, no discount.
    const fx2 = await createFixture();
    fx.customerIdA = fx2.customerIdA;
    fx.planMonthly.id = fx2.planMonthly.id;
    const sub2 = await createActiveSubscription(5);
    const inv2 = await generateInvoiceForSubscription(sub2, fx.admin.id);
    const created2 = await db.invoice.findUniqueOrThrow({ where: { id: inv2.invoiceId as string } });
    expect(created2.discountId).toBeNull();
    expect(created2.discountTotal).toBe(0);

    const discount = await db.discount.findUniqueOrThrow({ where: { id: discountId } });
    expect(discount.usedCount).toBe(1);
  });

  it('does not apply expired discounts', async () => {
    await createDiscount(fx.admin, {
      name: 'Expired offer',
      type: 'PERCENT',
      valueRaw: '50',
      minPurchaseRaw: '',
      minQuantityRaw: '',
      usageLimitRaw: '',
      startsAt: isoDaysFromNow(-60),
      endsAt: isoDaysFromNow(-30),
      scope: 'SUBSCRIPTION',
      productIds: [],
      isActive: true,
    });
    const subId = await createActiveSubscription(5);
    const result = await generateInvoiceForSubscription(subId, fx.admin.id);
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: result.invoiceId as string } });
    expect(invoice.discountId).toBeNull();
  });
});

describe('payments settle invoices', () => {
  it('marks the invoice PAID when fully settled and supports partial payments', async () => {
    const subId = await createActiveSubscription(40);
    const result = await generateInvoiceForSubscription(subId, fx.admin.id);
    const invoiceId = result.invoiceId as string;
    await db.invoice.update({ where: { id: invoiceId }, data: { status: 'CONFIRMED' } });
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    // Partial payment first (half, rounded down to whole rupees)
    const halfRupees = Math.floor(invoice.total / 200);
    await recordPayment(fx.staff, {
      invoiceId,
      method: 'UPI',
      amount: halfRupees.toFixed(2),
      paidAt: isoDaysFromNow(0),
      note: '',
    });
    let after = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(after.status).toBe('CONFIRMED');
    expect(after.paidTotal).toBe(halfRupees * 100);

    // Settle the rest
    const outstanding = after.total - after.paidTotal;
    await recordPayment(fx.staff, {
      invoiceId,
      method: 'BANK_TRANSFER',
      amount: (outstanding / 100).toFixed(2),
      paidAt: isoDaysFromNow(0),
      note: '',
    });
    after = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(after.status).toBe('PAID');
    expect(after.paidTotal).toBe(after.total);
  });

  it('rejects overpayment', async () => {
    const subId = await createActiveSubscription(40);
    const result = await generateInvoiceForSubscription(subId, fx.admin.id);
    await db.invoice.update({ where: { id: result.invoiceId as string }, data: { status: 'CONFIRMED' } });
    await expect(
      recordPayment(fx.staff, {
        invoiceId: result.invoiceId,
        method: 'CARD',
        amount: '999999.00',
        paidAt: isoDaysFromNow(0),
        note: '',
      }),
    ).rejects.toThrow(/exceeds/i);
  });
});

describe('plan minimum quantity', () => {
  it('rejects activation below the plan minimum', async () => {
    const id = await createSubscription(fx.admin, {
      customerId: fx.customerIdA,
      planId: fx.planMonthly.id,
      quantity: '2',
      startDate: isoDaysFromNow(-1),
      endDate: isoDaysFromNow(180),
      paymentTerms: 'Net 15',
      lines: [],
    });
    await transitionSubscription(fx.admin, id, 'QUOTATION');
    await transitionSubscription(fx.admin, id, 'CONFIRMED');
    // Force the quantity below the minimum, then try to activate.
    await db.subscription.update({ where: { id }, data: { quantity: 1 } });
    await expect(transitionSubscription(fx.admin, id, 'ACTIVE')).rejects.toThrow(/minimum quantity/i);
  });

  it('rejects creating a subscription below the plan minimum', async () => {
    await expect(
      createSubscription(fx.admin, {
        customerId: fx.customerIdA,
        planId: fx.planMonthly.id,
        quantity: '1',
        startDate: isoDaysFromNow(0),
        endDate: isoDaysFromNow(180),
        paymentTerms: 'Net 15',
        lines: [],
      }),
    ).rejects.toThrow(/minimum/i);
  });
});

describe('billing period arithmetic', () => {
  it('advances dates per period', () => {
    const d = new Date('2026-01-31T00:00:00.000Z');
    expect(addBillingPeriod(d, 'MONTHLY').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(addBillingPeriod(d, 'YEARLY').toISOString()).toBe('2027-01-31T00:00:00.000Z');
    expect(addBillingPeriod(d, 'WEEKLY').toISOString()).toBe('2026-02-07T00:00:00.000Z');
    expect(addBillingPeriod(d, 'DAILY').toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});
