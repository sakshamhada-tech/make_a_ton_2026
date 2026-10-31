/**
 * End-to-end journey check against the seeded database.
 *
 * Walks the full business flow through the service layer (the same code the
 * UI invokes): signup → catalog setup → template → subscription statuses →
 * billing run twice → send invoice → payments → dashboard → portal scoping.
 * Run with `npm run journey` after `npm run setup`.
 */
import { randomBytes } from 'node:crypto';
import { signupCustomer, login } from '../src/services/auth.service';
import { createProduct } from '../src/services/product.service';
import { createPlan } from '../src/services/plan.service';
import { createTax } from '../src/services/tax.service';
import { createDiscount } from '../src/services/discount.service';
import { createTemplate } from '../src/services/template.service';
import {
  createSubscription,
  transitionSubscription,
  listSubscriptions,
} from '../src/services/subscription.service';
import { runBilling } from '../src/services/billing.service';
import { sendInvoice, listInvoices } from '../src/services/invoice.service';
import { recordPayment } from '../src/services/payment.service';
import { getDashboardData } from '../src/services/report.service';
import { db } from '../src/lib/db';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`JOURNEY FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ok — ${message}`);
}

function iso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  console.log('Journey: full subscription lifecycle\n');
  const adminRow = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const admin = { id: adminRow.id, role: 'ADMIN' as const, customerId: null };

  const suffix = randomBytes(3).toString('hex');
  const customerEmail = `journey-${suffix}@example.test`;

  console.log('1. Customer signup + login');
  await signupCustomer({
    name: 'Journey Customer',
    email: customerEmail,
    password: 'J0urney!Pass',
    company: `Journey Co ${suffix}`,
  });
  const session = await login({ email: customerEmail, password: 'J0urney!Pass' });
  assert(session !== null, 'customer can log in after signup');
  const customerRow = await db.customer.findFirstOrThrow({ where: { email: customerEmail } });
  const customerActor = { id: session!.userId, role: 'CUSTOMER' as const, customerId: customerRow.id };

  console.log('2. Admin catalog: product + variant, plan, tax, discount');
  const productId = await createProduct(admin, {
    name: `Journey Workspace ${suffix}`,
    type: 'license',
    salesPrice: '1200.00',
    costPrice: '300.00',
    notes: 'Seeded through the journey check.',
    isActive: true,
    variantOptions: [{ attribute: 'Brand', value: 'Odoo', priceExtra: '560.00' }],
  });
  const planId = await createPlan(admin, {
    name: `Journey Monthly ${suffix}`,
    price: '2500.00',
    period: 'MONTHLY',
    minQuantity: '1',
    availableFrom: iso(-7),
    availableTo: '',
    autoClose: true,
    allowEarlyClose: true,
    allowPause: true,
    allowRenew: true,
    isActive: true,
  });
  const taxId = await createTax(admin, {
    name: `Journey GST 18 ${suffix}`,
    rate: '18',
    appliesTo: 'ALL',
    productIds: [],
    isActive: true,
  });
  const discountId = await createDiscount(admin, {
    name: `Journey offer ${suffix}`,
    type: 'PERCENT',
    valueRaw: '10',
    minPurchaseRaw: '',
    minQuantityRaw: '',
    usageLimitRaw: '100',
    startsAt: iso(-1),
    endsAt: iso(60),
    scope: 'SUBSCRIPTION',
    productIds: [],
    isActive: true,
  });
  assert(productId && planId && taxId && discountId, 'product, plan, tax and discount created');

  console.log('3. Quotation template');
  const templateId = await createTemplate(admin, {
    name: `Journey template ${suffix}`,
    planId,
    validityDays: '15',
    lines: [{ productId, variantOptionId: undefined, quantity: '2', taxId }],
  });
  assert(templateId, 'template created');

  console.log('4. Subscription through every status');
  const subId = await createSubscription(admin, {
    customerId: customerRow.id,
    planId,
    quantity: '2',
    startDate: iso(0),
    endDate: iso(365),
    paymentTerms: 'Net 15',
    templateId,
    lines: [{ productId, variantOptionId: undefined, quantity: '2', taxId }],
  });
  await transitionSubscription(admin, subId, 'QUOTATION');
  await transitionSubscription(admin, subId, 'CONFIRMED');
  await transitionSubscription(admin, subId, 'ACTIVE');
  const subDetail = await listSubscriptions(admin, { page: 1, pageSize: 5, sort: 'createdAt', dir: 'desc' }, { q: undefined });
  assert(subDetail.items.some((s) => s.id === subId && s.status === 'ACTIVE'), 'subscription reached ACTIVE');

  console.log('5. Billing run twice — no duplicates');
  const run1 = await runBilling(admin, new Date());
  const run2 = await runBilling(admin, new Date());
  const invoices = await db.invoice.findMany({ where: { subscriptionId: subId } });
  assert(invoices.length === 1, `exactly one invoice after two runs (created ${run1.created}/${run2.created})`);
  const invoice = invoices[0];
  assert(invoice.discountTotal > 0, 'eligible discount applied to the invoice');
  assert(invoice.total === invoice.subtotal - invoice.discountTotal + invoice.taxTotal, 'totals = subtotal - discount + tax');

  console.log('6. Confirm, send (outbox), record payments');
  await db.invoice.update({ where: { id: invoice.id }, data: { status: 'CONFIRMED' } });
  await sendInvoice(admin, invoice.id);
  const mail = await db.outboxEmail.findFirst({ where: { entityId: invoice.id }, orderBy: { createdAt: 'desc' } });
  assert(mail !== null, 'invoice email written to the Outbox');
  const firstPayment = Math.floor(invoice.total / 200); // half in rupees
  await recordPayment(admin, {
    invoiceId: invoice.id,
    method: 'UPI',
    amount: firstPayment.toFixed(2),
    paidAt: iso(0),
    note: 'Journey partial payment',
  });
  let after = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert(after.status === 'CONFIRMED' && after.paidTotal === firstPayment * 100, 'partial payment recorded');
  await recordPayment(admin, {
    invoiceId: invoice.id,
    method: 'BANK_TRANSFER',
    amount: ((after.total - after.paidTotal) / 100).toFixed(2),
    paidAt: iso(0),
    note: 'Journey final payment',
  });
  after = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert(after.status === 'PAID' && after.paidTotal === after.total, 'invoice settles to PAID');

  console.log('7. Dashboard reflects numbers');
  const dash = await getDashboardData(admin, {});
  assert(dash.activeSubscriptions > 0, `active subscriptions = ${dash.activeSubscriptions}`);
  assert(dash.mrrMinor > 0, `MRR = ${dash.mrrMinor} minor units`);
  assert(dash.revenueCollectedMinor >= after.total, 'revenue collected includes the payments');

  console.log('8. Customer portal scoping');
  const own = await listSubscriptions(customerActor, { page: 1, pageSize: 50, sort: 'createdAt', dir: 'desc' });
  assert(own.items.every((s) => s.customerId === customerRow.id), 'portal subscriptions are scoped to the owner');
  const ownInvoices = await listInvoices(customerActor, { page: 1, pageSize: 50, sort: 'issueDate', dir: 'desc' });
  assert(ownInvoices.items.every((i) => i.customerId === customerRow.id), 'portal invoices are scoped to the owner');

  console.log('\nJourney complete — all checks passed.');
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
