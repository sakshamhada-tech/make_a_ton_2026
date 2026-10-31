/**
 * Brightloop Billing seed.
 *
 * Creates demo staff/customer logins, a realistic catalog, and a large
 * transactional dataset (5,000 subscriptions, ~15,000 invoices & payments)
 * using a deterministic PRNG so reseeding produces the same data.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(path.join(root, '.env'));
  } catch {
    // fall back to default below
  }
}

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
const fileUrl = url.startsWith('file:')
  ? `file:${path.isAbsolute(url.slice(5)) ? url.slice(5) : path.resolve(root, 'prisma', url.slice(5))}`
  : url;

const adapter = new PrismaLibSQL({ url: fileUrl });
const db = new PrismaClient({ adapter });

// --- deterministic PRNG ----------------------------------------------------
let seed = 0x5eed1234;
function rand(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
function daysAgo(min: number, max: number): Date {
  return new Date(Date.now() - randInt(min, max) * 86_400_000);
}
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const target = new Date(d.getTime());
  target.setUTCMonth(target.getUTCMonth() + months);
  return target;
}
function addPeriod(date: Date, period: string): Date {
  switch (period) {
    case 'DAILY':
      return new Date(date.getTime() + 86_400_000);
    case 'WEEKLY':
      return new Date(date.getTime() + 7 * 86_400_000);
    case 'MONTHLY':
      return addMonths(date, 1);
    default:
      return addMonths(date, 12);
  }
}

const COUNTERS = new Map<string, number>();
function nextNumber(prefix: 'SUB' | 'INV'): string {
  const value = (COUNTERS.get(prefix) ?? 0) + 1;
  COUNTERS.set(prefix, value);
  return `${prefix}-${String(value).padStart(6, '0')}`;
}

function cuid(prefix: string, n: number): string {
  return `${prefix}_${String(n).padStart(8, '0')}${Math.floor(rand() * 1e6).toString(36)}`;
}

async function createMany<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 800): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

// --- catalog data ----------------------------------------------------------

const CUSTOMERS: { name: string; email: string; city: string; state: string; country: string; gstin?: string }[] = [
  { name: 'Zenith Works', email: 'billing@zenithworks.example', city: 'Bengaluru', state: 'Karnataka', country: 'India', gstin: '29AABCZ1234F1Z5' },
  { name: 'Meridian Analytics', email: 'ap@meridiananalytics.example', city: 'Mumbai', state: 'Maharashtra', country: 'India', gstin: '27AABCM5678G1Z2' },
  { name: 'Northwind Logistics', email: 'accounts@northwindlog.example', city: 'Pune', state: 'Maharashtra', country: 'India', gstin: '27AABCN9012H1Z8' },
  { name: 'Sunrise Retail Group', email: 'finance@sunriseretail.example', city: 'Delhi', state: 'Delhi', country: 'India', gstin: '07AABCS3456J1Z1' },
  { name: 'Cauvery Textiles', email: 'orders@cauverytex.example', city: 'Coimbatore', state: 'Tamil Nadu', country: 'India', gstin: '33AABCC7890K1Z4' },
  { name: 'Vayu Drone Systems', email: 'payables@vayudrones.example', city: 'Hyderabad', state: 'Telangana', country: 'India', gstin: '36AABCV2345L1Z7' },
  { name: 'Maple Ridge Consulting', email: 'invoices@mapleridge.example', city: 'Toronto', state: 'Ontario', country: 'Canada' },
  { name: 'Hanseatic Digital', email: 'rechnung@hanseatic.example', city: 'Hamburg', state: 'Hamburg', country: 'Germany' },
  { name: 'Southern Cross Media', email: 'ap@southerncross.example', city: 'Sydney', state: 'NSW', country: 'Australia' },
  { name: 'Clearwater Health Partners', email: 'billing@clearwaterhealth.example', city: 'Austin', state: 'Texas', country: 'United States' },
  { name: 'Bluepeak Engineering', email: 'accounts@bluepeakeng.example', city: 'Ahmedabad', state: 'Gujarat', country: 'India', gstin: '24AABCB4567M1Z9' },
  { name: 'Konkan Agro Foods', email: 'purchase@konkanagro.example', city: 'Ratnagiri', state: 'Maharashtra', country: 'India', gstin: '27AABCK8901N1Z3' },
  { name: 'Aurora Fintech', email: 'billing@aurorafintech.example', city: 'Gurugram', state: 'Haryana', country: 'India', gstin: '06AABCA1234P1Z6' },
  { name: 'Sundara Hospitality', email: 'ap@sundarahospitality.example', city: 'Jaipur', state: 'Rajasthan', country: 'India', gstin: '08AABCS5678Q1Z0' },
  { name: 'Kestrel Software', email: 'finance@kestrelsw.example', city: 'Dublin', state: 'Leinster', country: 'Ireland' },
  { name: 'Tanjore Heritage Crafts', email: 'orders@tanjorecrafts.example', city: 'Thanjavur', state: 'Tamil Nadu', country: 'India', gstin: '33AABCT9012R1Z5' },
  { name: 'Fjord Data AS', email: 'billing@fjorddata.example', city: 'Oslo', state: 'Oslo', country: 'Norway' },
  { name: 'Pragati Pharma', email: 'accounts@pragatipharma.example', city: 'Nashik', state: 'Maharashtra', country: 'India', gstin: '27AABCP3456S1Z8' },
  { name: 'Lumen Education Trust', email: 'billing@lumenedu.example', city: 'Kolkata', state: 'West Bengal', country: 'India', gstin: '19AABCL7890T1Z2' },
  { name: 'Sakura Trading KK', email: 'keiri@sakura-trading.example', city: 'Osaka', state: 'Osaka', country: 'Japan' },
  { name: 'Deccan Solar Power', email: 'payables@deccansolar.example', city: 'Nagpur', state: 'Maharashtra', country: 'India', gstin: '27AABCD1234U1Z7' },
  { name: 'Highland Brewing Co', email: 'invoices@highlandbrew.example', city: 'Edinburgh', state: 'Scotland', country: 'United Kingdom' },
  { name: 'Nandi Freight Movers', email: 'accounts@nandifreight.example', city: 'Chennai', state: 'Tamil Nadu', country: 'India', gstin: '33AABCN5678V1Z1' },
  { name: 'Verdant Organic Farms', email: 'billing@verdantfarms.example', city: 'Kochi', state: 'Kerala', country: 'India', gstin: '32AABCV9012W1Z4' },
  { name: 'Atlas Surveying Ltd', email: 'ap@atlassurvey.example', city: 'Leeds', state: 'England', country: 'United Kingdom' },
  { name: 'Rasoi Kitchen Chains', email: 'finance@rasoikitchen.example', city: 'Indore', state: 'Madhya Pradesh', country: 'India', gstin: '23AABCR3456X1Z9' },
  { name: 'Polaris Aviation Services', email: 'billing@polarisavia.example', city: 'Bengaluru', state: 'Karnataka', country: 'India', gstin: '29AABCP7890Y1Z3' },
  { name: 'Gulf Coast Petrochem', email: 'ap@gulfcoastpetro.example', city: 'Houston', state: 'Texas', country: 'United States' },
  { name: 'Shanti Educational Supplies', email: 'orders@shantiedu.example', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', gstin: '23AABCS1234Z1Z6' },
  { name: 'Emerald Coast Resorts', email: 'billing@emeraldcoast.example', city: 'Goa', state: 'Goa', country: 'India', gstin: '30AABCE5678A1Z0' },
  { name: 'Quantum Legal LLP', email: 'accounts@quantumlegal.example', city: 'Mumbai', state: 'Maharashtra', country: 'India', gstin: '27AABBQ9012B1Z5' },
  { name: 'Bright Harbour Shipping', email: 'payables@brightharbour.example', city: 'Kandla', state: 'Gujarat', country: 'India', gstin: '24AABCB3456C1Z8' },
  { name: 'Maple Ridge Advisory', email: 'billing@mapleridgeadv.example', city: 'Vancouver', state: 'BC', country: 'Canada' },
  { name: 'Aster Biotech', email: 'ap@asterbiotech.example', city: 'Chandigarh', state: 'Chandigarh', country: 'India', gstin: '04AABCA7890D1Z2' },
  { name: 'Windmere Properties', email: 'finance@windmere.example', city: 'Pune', state: 'Maharashtra', country: 'India', gstin: '27AABCW1234E1Z7' },
  { name: 'Solstice Events', email: 'billing@solsticeevents.example', city: 'Udaipur', state: 'Rajasthan', country: 'India', gstin: '08AABCS5678F1Z1' },
  { name: 'Nordwind Energie GmbH', email: 'buchhaltung@nordwind.example', city: 'Munich', state: 'Bavaria', country: 'Germany' },
  { name: 'Trident Security Services', email: 'accounts@tridentsec.example', city: 'Noida', state: 'Uttar Pradesh', country: 'India', gstin: '09AABCT9012G1Z4' },
  { name: 'Ananda Wellness Clinics', email: 'billing@anandawellness.example', city: 'Mysuru', state: 'Karnataka', country: 'India', gstin: '29AABCA3456H1Z9' },
  { name: 'Coral Reef Divers', email: 'ap@coralreefdivers.example', city: 'Galle', state: 'Southern', country: 'Sri Lanka' },
  { name: 'Steelhead Manufacturing', email: 'payables@steelheadmfg.example', city: 'Jamshedpur', state: 'Jharkhand', country: 'India', gstin: '20AABCS7890J1Z3' },
  { name: 'Willow Creek Vineyards', email: 'invoices@willowcreek.example', city: 'Nashik', state: 'Maharashtra', country: 'India', gstin: '27AABCW1234K1Z8' },
  { name: 'Zephyr Travel Experiences', email: 'billing@zephyrtravel.example', city: 'Shimla', state: 'Himachal Pradesh', country: 'India', gstin: '02AABCZ5678L1Z2' },
  { name: 'Harbourview Insurance', email: 'ap@harbourviewins.example', city: 'Chennai', state: 'Tamil Nadu', country: 'India', gstin: '33AABCH9012M1Z6' },
  { name: 'Orient Spice Traders', email: 'orders@orientspice.example', city: 'Kochi', state: 'Kerala', country: 'India', gstin: '32AABCO3456N1Z0' },
];

interface SeedProduct {
  id: string;
  name: string;
  type: string;
  salesPrice: number;
  costPrice: number;
  notes: string;
  variants: { id: string; attribute: string; value: string; priceExtra: number }[];
}

async function main(): Promise<void> {
  const started = Date.now();
  console.log('Seeding Brightloop demo data…');

  // Fresh slate (order does not matter: no FK constraints are enforced).
  const tables = [
    'OutboxEmail', 'Counter', 'BillingRun', 'Payment', 'InvoiceLine', 'Invoice',
    'SubscriptionStatusHistory', 'AuditLog', 'SubscriptionLine', 'Subscription',
    'DiscountProduct', 'Discount', 'TemplateLine', 'QuoteTemplate', 'TaxProduct',
    'Tax', 'VariantOption', 'Product', 'Plan', 'PasswordResetToken', 'Session',
    'User', 'Customer',
  ];
  for (const t of tables) {
    await db.$executeRawUnsafe(`DELETE FROM "${t}"`);
  }

  // --- users -------------------------------------------------------------
  const adminHash = await bcrypt.hash('Admin@12345!', 10);
  const staffHash = await bcrypt.hash('Staff@12345!', 10);
  const customerHash = await bcrypt.hash('Customer@12345!', 10);

  const users: { id: string; email: string; name: string; role: string; customerId: string | null }[] = [
    { id: cuid('usr', 1), email: 'admin@brightloop.example', name: 'Ananya Iyer', role: 'ADMIN', customerId: null },
    { id: cuid('usr', 2), email: 'staff@brightloop.example', name: 'Rohit Menon', role: 'STAFF', customerId: null },
    { id: cuid('usr', 3), email: 'finance@brightloop.example', name: 'Kavita Rao', role: 'ADMIN', customerId: null },
  ];

  const customers = CUSTOMERS.map((c, i) => ({
    id: cuid('cus', i + 1),
    name: c.name,
    email: c.email,
    phone: `+91-${randInt(70000, 99999)}${randInt(10000, 99999)}`.slice(0, 15),
    address: `${randInt(1, 220)}, ${pick(['MG Road', 'Station Road', 'Industrial Area', 'Link Road', 'Market Street'])}`,
    city: c.city,
    state: c.state,
    country: c.country,
    postalCode: String(randInt(100000, 699999)),
    gstin: c.gstin ?? null,
  }));

  // Give the first six customers portal logins (demo accounts).
  const portalEmails = [
    'ishita.rao@zenithworks.example',
    'ap@meridiananalytics.example',
    'accounts@northwindlog.example',
  ];
  for (let i = 0; i < 3; i += 1) {
    users.push({
      id: cuid('usr', 10 + i),
      email: portalEmails[i],
      name: pick(['Ishita Rao', 'Sameer Kulkarni', 'Divya Nair']),
      role: 'CUSTOMER',
      customerId: customers[i].id,
    });
  }

  await db.user.createMany({
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      passwordHash:
        u.role === 'ADMIN' ? adminHash : u.role === 'STAFF' ? staffHash : customerHash,
      name: u.name,
      role: u.role,
      customerId: u.customerId,
    })),
  });
  await db.customer.createMany({ data: customers });

  // --- products ----------------------------------------------------------
  const products: SeedProduct[] = [
    {
      id: cuid('prd', 1), name: 'Workspace Suite', type: 'license', salesPrice: 149900, costPrice: 42000,
      notes: 'Core team collaboration and document workspace.',
      variants: [
        { id: cuid('var', 1), attribute: 'Deployment', value: 'Cloud', priceExtra: 0 },
        { id: cuid('var', 2), attribute: 'Deployment', value: 'On-premise', priceExtra: 56000 },
      ],
    },
    {
      id: cuid('prd', 2), name: 'Analytics Add-on', type: 'addon', salesPrice: 89900, costPrice: 26000,
      notes: 'Dashboards, scheduled reports and export pipelines.',
      variants: [
        { id: cuid('var', 3), attribute: 'Data residency', value: 'India', priceExtra: 0 },
        { id: cuid('var', 4), attribute: 'Data residency', value: 'EU', priceExtra: 12000 },
      ],
    },
    {
      id: cuid('prd', 3), name: 'Support Pack — Business', type: 'support', salesPrice: 49900, costPrice: 18000,
      notes: '8x5 support with 4-hour first response.',
      variants: [
        { id: cuid('var', 5), attribute: 'Response SLA', value: '4 hours', priceExtra: 0 },
        { id: cuid('var', 6), attribute: 'Response SLA', value: '1 hour', priceExtra: 35000 },
      ],
    },
    {
      id: cuid('prd', 4), name: 'CRM Module', type: 'license', salesPrice: 119900, costPrice: 38000,
      notes: 'Lead pipeline, deals and activity tracking.',
      variants: [],
    },
    {
      id: cuid('prd', 5), name: 'Onboarding Service', type: 'service', salesPrice: 75000, costPrice: 30000,
      notes: 'One-time guided setup and data import.',
      variants: [
        { id: cuid('var', 7), attribute: 'Package', value: 'Standard', priceExtra: 0 },
        { id: cuid('var', 8), attribute: 'Package', value: 'White-glove', priceExtra: 45000 },
      ],
    },
    {
      id: cuid('prd', 6), name: 'API Gateway Add-on', type: 'addon', salesPrice: 69900, costPrice: 21000,
      notes: 'Rate-limited public API access with audit logs.',
      variants: [],
    },
    {
      id: cuid('prd', 7), name: 'Training Credits (10 hrs)', type: 'service', salesPrice: 35000, costPrice: 12000,
      notes: 'Instructor hours redeemable within the term.',
      variants: [],
    },
    {
      id: cuid('prd', 8), name: 'Data Migration Service', type: 'service', salesPrice: 98000, costPrice: 40000,
      notes: 'Schema mapping and one-time migration run.',
      variants: [],
    },
    {
      id: cuid('prd', 9), name: 'Compliance Reporter', type: 'addon', salesPrice: 54900, costPrice: 17000,
      notes: 'GST-ready exports and retention policies.',
      variants: [],
    },
    {
      id: cuid('prd', 10), name: 'Support Pack — Enterprise', type: 'support', salesPrice: 129900, costPrice: 48000,
      notes: '24x7 support with dedicated manager.',
      variants: [],
    },
  ];
  await db.product.createMany({
    data: products.map((p) => ({
      id: p.id, name: p.name, type: p.type, salesPrice: p.salesPrice,
      costPrice: p.costPrice, notes: p.notes,
    })),
  });
  await db.variantOption.createMany({
    data: products.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id }))),
  });

  // --- taxes -------------------------------------------------------------
  const gst18 = cuid('tax', 1);
  const gst5 = cuid('tax', 2);
  await db.tax.createMany({
    data: [
      { id: gst18, name: 'GST 18%', rateBps: 1800, appliesTo: 'ALL' },
      { id: gst5, name: 'GST 5%', rateBps: 500, appliesTo: 'PRODUCTS' },
    ],
  });
  await db.taxProduct.createMany({
    data: [
      { taxId: gst5, productId: products[2].id },
      { taxId: gst5, productId: products[6].id },
    ],
  });

  // --- plans -------------------------------------------------------------
  const now = new Date();
  const availableFrom = new Date(Date.UTC(now.getUTCFullYear() - 2, 0, 1));
  interface SeedPlan { id: string; name: string; price: number; period: string; minQuantity: number; autoClose: boolean; allowEarlyClose: boolean; allowPause: boolean; allowRenew: boolean }
  const plans: SeedPlan[] = [
    { id: cuid('pln', 1), name: 'Starter Monthly', price: 99900, period: 'MONTHLY', minQuantity: 1, autoClose: true, allowEarlyClose: true, allowPause: true, allowRenew: true },
    { id: cuid('pln', 2), name: 'Growth Monthly', price: 499900, period: 'MONTHLY', minQuantity: 5, autoClose: true, allowEarlyClose: false, allowPause: true, allowRenew: true },
    { id: cuid('pln', 3), name: 'Growth Yearly', price: 4999900, period: 'YEARLY', minQuantity: 5, autoClose: true, allowEarlyClose: true, allowPause: false, allowRenew: true },
    { id: cuid('pln', 4), name: 'Enterprise Monthly', price: 1999900, period: 'MONTHLY', minQuantity: 25, autoClose: false, allowEarlyClose: false, allowPause: true, allowRenew: true },
    { id: cuid('pln', 5), name: 'Enterprise Yearly', price: 19999900, period: 'YEARLY', minQuantity: 25, autoClose: true, allowEarlyClose: false, allowPause: false, allowRenew: true },
    { id: cuid('pln', 6), name: 'Sandbox Daily', price: 4900, period: 'DAILY', minQuantity: 1, autoClose: true, allowEarlyClose: true, allowPause: false, allowRenew: true },
    { id: cuid('pln', 7), name: 'Pilot Weekly', price: 29900, period: 'WEEKLY', minQuantity: 1, autoClose: true, allowEarlyClose: true, allowPause: true, allowRenew: false },
    { id: cuid('pln', 8), name: 'Analytics Monthly', price: 199900, period: 'MONTHLY', minQuantity: 1, autoClose: true, allowEarlyClose: true, allowPause: true, allowRenew: true },
  ];
  await db.plan.createMany({
    data: plans.map((p) => ({
      ...p, availableFrom, availableTo: null,
    })),
  });

  // --- templates ---------------------------------------------------------
  const templateRows = [
    { id: cuid('tpl', 1), name: 'Standard starter package', validityDays: 15, planId: plans[1].id },
    { id: cuid('tpl', 2), name: 'Enterprise evaluation', validityDays: 30, planId: plans[3].id },
    { id: cuid('tpl', 3), name: 'Analytics pilot', validityDays: 14, planId: plans[7].id },
  ];
  await db.quoteTemplate.createMany({ data: templateRows });
  await db.templateLine.createMany({
    data: [
      { id: cuid('trl', 1), templateId: templateRows[0].id, productId: products[0].id, variantOptionId: products[0].variants[0].id, quantity: 5, taxId: gst18, sortOrder: 0 },
      { id: cuid('trl', 2), templateId: templateRows[0].id, productId: products[2].id, variantOptionId: null, quantity: 1, taxId: gst5, sortOrder: 1 },
      { id: cuid('trl', 3), templateId: templateRows[1].id, productId: products[0].id, variantOptionId: products[0].variants[1].id, quantity: 25, taxId: gst18, sortOrder: 0 },
      { id: cuid('trl', 4), templateId: templateRows[1].id, productId: products[1].id, variantOptionId: null, quantity: 3, taxId: gst18, sortOrder: 1 },
      { id: cuid('trl', 5), templateId: templateRows[1].id, productId: products[9].id, variantOptionId: null, quantity: 1, taxId: gst18, sortOrder: 2 },
      { id: cuid('trl', 6), templateId: templateRows[2].id, productId: products[1].id, variantOptionId: null, quantity: 2, taxId: gst18, sortOrder: 0 },
    ],
  });

  // --- discounts ---------------------------------------------------------
  const day = 86_400_000;
  const discounts = [
    { id: cuid('dsc', 1), name: 'Monsoon growth offer', type: 'PERCENT', value: 1000, minPurchase: null, minQuantity: null, startsAt: new Date(Date.now() - 30 * day), endsAt: new Date(Date.now() + 60 * day), usageLimit: 500, usedCount: 42, scope: 'SUBSCRIPTION', isActive: true },
    { id: cuid('dsc', 2), name: 'Annual prepay credit', type: 'FIXED', value: 50000, minPurchase: 400000, minQuantity: null, startsAt: new Date(Date.now() - 60 * day), endsAt: new Date(Date.now() + 90 * day), usageLimit: null, usedCount: 18, scope: 'SUBSCRIPTION', isActive: true },
    { id: cuid('dsc', 3), name: 'Workspace launch discount', type: 'PERCENT', value: 1500, minPurchase: null, minQuantity: null, startsAt: new Date(Date.now() - 200 * day), endsAt: new Date(Date.now() - 110 * day), usageLimit: 100, usedCount: 63, scope: 'PRODUCTS', isActive: true },
    { id: cuid('dsc', 4), name: 'Pilot programme credit', type: 'FIXED', value: 10000, minPurchase: null, minQuantity: 1, startsAt: new Date(Date.now() - 90 * day), endsAt: new Date(Date.now() + 30 * day), usageLimit: 25, usedCount: 25, scope: 'SUBSCRIPTION', isActive: true },
  ];
  await db.discount.createMany({ data: discounts });
  await db.discountProduct.createMany({
    data: [
      { discountId: discounts[2].id, productId: products[0].id },
      { discountId: discounts[2].id, productId: products[3].id },
    ],
  });

  // --- subscriptions, invoices, payments ---------------------------------
  const subscriptionRows: Record<string, unknown>[] = [];
  const subscriptionLineRows: Record<string, unknown>[] = [];
  const historyRows: Record<string, unknown>[] = [];
  const invoiceRows: Record<string, unknown>[] = [];
  const invoiceLineRows: Record<string, unknown>[] = [];
  const paymentRows: Record<string, unknown>[] = [];
  const outboxRows: Record<string, unknown>[] = [];

  const paymentMethods = ['CARD', 'BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE'];
  const paymentTerms = ['Net 7', 'Net 15', 'Net 30'];
  const STATUS_WEIGHTS: [string, number][] = [
    ['ACTIVE', 55], ['CLOSED', 16], ['CONFIRMED', 10], ['DRAFT', 10], ['QUOTATION', 9],
  ];
  function weightedStatus(): string {
    const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [status, w] of STATUS_WEIGHTS) {
      r -= w;
      if (r <= 0) return status;
    }
    return 'ACTIVE';
  }

  const SUBSCRIPTION_COUNT = 5000;
  let invoiceSeq = 0;

  for (let i = 0; i < SUBSCRIPTION_COUNT; i += 1) {
    const subId = cuid('sub', i + 1);
    const number = nextNumber('SUB');
    const customer = pick(customers);
    const plan = pick(plans);
    const quantity = plan.minQuantity + (plan.minQuantity >= 25 ? randInt(0, 10) : randInt(0, 30));
    const status = weightedStatus();
    const startDate = daysAgo(1, 700);
    const termMonths = plan.period === 'YEARLY' ? randInt(1, 2) : plan.period === 'MONTHLY' ? randInt(2, 14) : 0;
    let endDate = addMonths(startDate, Math.max(termMonths, 1));
    if (plan.period === 'DAILY') endDate = new Date(startDate.getTime() + randInt(10, 60) * day);
    if (plan.period === 'WEEKLY') endDate = new Date(startDate.getTime() + randInt(4, 26) * 7 * day);
    if (endDate.getTime() < Date.now() && status === 'ACTIVE' && plan.autoClose) {
      // keep some active subs past their end so auto-close has work to do
      if (rand() < 0.7) endDate = new Date(Date.now() + randInt(5, 90) * day);
    }
    const paused = status === 'ACTIVE' && plan.allowPause && rand() < 0.05 ? daysAgo(1, 30) : null;
    const createdById = pick([users[0].id, users[1].id, users[2].id]);

    // lines: plan line + 0-3 product lines
    const lines: {
      kind: string; productId: string | null; variantId: string | null; description: string;
      quantity: number; unitPrice: number; taxId: string | null; amount: number; taxAmount: number;
    }[] = [];
    lines.push({
      kind: 'PLAN', productId: null, variantId: null, description: plan.name,
      quantity, unitPrice: plan.price, taxId: null,
      amount: quantity * plan.price, taxAmount: 0,
    });
    const extraCount = randInt(0, 3);
    for (let j = 0; j < extraCount; j += 1) {
      const product = pick(products);
      const variant = product.variants.length > 0 && rand() < 0.5 ? pick(product.variants) : null;
      const lineQty = randInt(1, 5);
      const unitPrice = product.salesPrice + (variant?.priceExtra ?? 0);
      const taxId = product.type === 'support' ? gst5 : gst18;
      const rate = taxId === gst5 ? 500 : 1800;
      const amount = lineQty * unitPrice;
      lines.push({
        kind: 'PRODUCT', productId: product.id, variantId: variant?.id ?? null,
        description: variant ? `${product.name} — ${variant.attribute}: ${variant.value}` : product.name,
        quantity: lineQty, unitPrice, taxId, amount,
        taxAmount: Math.round((amount * rate) / 10_000),
      });
    }
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = subtotal + taxTotal;
    const term = pick(paymentTerms);

    let nextBillingDate: Date | null = null;
    if (status === 'ACTIVE') {
      let cursor = addPeriod(startDate, plan.period);
      // advance to the next future-or-near billing date; ~35% are due (past)
      while (cursor.getTime() < Date.now() - 400 * day) cursor = addPeriod(cursor, plan.period);
      if (rand() < 0.35) {
        // due: pull back into the past
        nextBillingDate = new Date(Math.min(cursor.getTime(), Date.now() - randInt(0, 20) * day));
      } else {
        nextBillingDate = cursor.getTime() > Date.now() ? cursor : addPeriod(new Date(), plan.period);
      }
    }

    const createdAt = startDate.getTime() < Date.now() - 2 * day ? startDate : daysAgo(2, 30);
    subscriptionRows.push({
      id: subId, number, customerId: customer.id, planId: plan.id, quantity, status,
      startDate, endDate,
      quoteExpiresAt: status === 'QUOTATION' ? new Date(startDate.getTime() + 15 * day) : null,
      nextBillingDate,
      paymentTerms: term,
      pausedAt: paused,
      closedAt: status === 'CLOSED' ? daysAgo(1, 200) : null,
      createdById,
      subtotal, discountTotal: 0, taxTotal, total,
      createdAt, updatedAt: createdAt,
    });
    lines.forEach((l, idx) => {
      subscriptionLineRows.push({
        id: cuid('sol', subscriptionLineRows.length + 1),
        subscriptionId: subId, kind: l.kind, productId: l.productId, variantOptionId: l.variantId,
        description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxId: l.taxId,
        amount: l.amount, taxAmount: l.taxAmount, sortOrder: idx,
      });
    });
    // status history trail
    const trail: (string | null)[] = ['DRAFT'];
    if (status !== 'DRAFT') trail.push('QUOTATION');
    if (status === 'CONFIRMED' || status === 'ACTIVE' || status === 'CLOSED') trail.push('CONFIRMED');
    if (status === 'ACTIVE' || status === 'CLOSED') trail.push('ACTIVE');
    if (status === 'CLOSED') trail.push('CLOSED');
    for (let h = 0; h < trail.length; h += 1) {
      historyRows.push({
        id: cuid('hst', historyRows.length + 1),
        subscriptionId: subId,
        fromStatus: h === 0 ? null : trail[h - 1],
        toStatus: trail[h],
        userId: createdById,
        note: h === 0 ? 'Subscription created as draft.' : null,
        createdAt: new Date(createdAt.getTime() + h * 3 * day),
      });
    }

    // invoices: only bill ACTIVE and CONFIRMED subscriptions
    if (status === 'ACTIVE' || status === 'CONFIRMED') {
      const periodCount =
        status === 'ACTIVE'
          ? Math.min(randInt(2, 22), Math.max(1, Math.floor((Date.now() - startDate.getTime()) / (35 * day))))
          : randInt(1, 4);
      let periodStart = addPeriod(startDate, plan.period);
      for (let k = 0; k < periodCount; k += 1) {
        if (periodStart.getTime() > Date.now()) break;
        const periodEnd = addPeriod(periodStart, plan.period);
        const invId = cuid('inv', ++invoiceSeq);
        const number2 = nextNumber('INV');
        const termDays = term === 'Net 7' ? 7 : term === 'Net 30' ? 30 : 15;
        const dueDate = new Date(periodStart.getTime() + termDays * day);

        // outcome mix: mostly paid, some overdue/partial/draft/cancelled
        const roll = rand();
        let invStatus: string;
        let paidTotal = 0;
        if (roll < 0.62) invStatus = 'PAID';
        else if (roll < 0.78) invStatus = 'CONFIRMED'; // unpaid, may be overdue
        else if (roll < 0.86) invStatus = 'DRAFT';
        else if (roll < 0.92) invStatus = 'CANCELLED';
        else invStatus = 'CONFIRMED'; // partial payments handled below

        const discountId = rand() < 0.12 ? discounts[0].id : null;
        const discountTotal = discountId ? Math.round(total * 0.1) : 0;
        const grandTotal = total - discountTotal;

        if (invStatus === 'PAID') paidTotal = grandTotal;
        else if (invStatus === 'CONFIRMED' && rand() < 0.35) paidTotal = Math.round(grandTotal * (rand() < 0.5 ? 0.3 : 0.6));

        invoiceRows.push({
          id: invId, number: number2, subscriptionId: subId, customerId: customer.id,
          status: invStatus, issueDate: periodStart, dueDate, periodStart, periodEnd,
          subtotal, discountTotal, taxTotal, total: grandTotal, paidTotal,
          discountId, sentAt: invStatus === 'DRAFT' ? null : daysAgo(0, 200),
          createdById, createdAt: periodStart, updatedAt: periodStart,
        });
        // mirror lines; apply discount to the first line for simplicity
        let remainingDiscount = discountTotal;
        lines.forEach((l, idx) => {
          const share = idx === 0 ? remainingDiscount : 0;
          if (idx === 0) remainingDiscount = 0;
          const rate = l.taxId === gst5 ? 500 : l.taxId === gst18 ? 1800 : 0;
          const base = l.amount - share;
          const taxAmount = Math.round((base * rate) / 10_000);
          invoiceLineRows.push({
            id: cuid('ivl', invoiceLineRows.length + 1),
            invoiceId: invId, productId: l.productId, variantOptionId: l.variantId,
            description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
            discountAmount: share, taxId: l.taxId, taxRateBps: rate,
            amount: l.amount, taxAmount, lineTotal: base + taxAmount,
          });
        });

        if (paidTotal > 0) {
          const parts = paidTotal === grandTotal && rand() < 0.2 ? 2 : 1;
          let left = paidTotal;
          for (let pay = 0; pay < parts; pay += 1) {
            const amount = pay === parts - 1 ? left : Math.round(paidTotal * 0.5);
            left -= amount;
            paymentRows.push({
              id: cuid('pay', paymentRows.length + 1),
              invoiceId: invId, method: pick(paymentMethods), amount,
              paidAt: new Date(periodStart.getTime() + randInt(1, termDays + 10) * day),
              note: rand() < 0.15 ? pick(['NEFT transfer', 'UPI reference recorded', 'Cheque collected by RM']) : null,
              createdById, createdAt: periodStart,
            });
          }
        }
        if (invStatus === 'CONFIRMED' && rand() < 0.25) {
          outboxRows.push({
            id: cuid('out', outboxRows.length + 1),
            toEmail: customer.email,
            subject: `Invoice ${number2} from Brightloop Software`,
            body: `Hello ${customer.name},\n\nInvoice ${number2} for ${plan.name} is ready.\nAmount: ${(grandTotal / 100).toLocaleString('en-IN')}\nDue: ${dueDate.toISOString().slice(0, 10)}\n\n— Brightloop Software billing`,
            entityType: 'invoice', entityId: invId,
            createdAt: periodStart,
          });
        }
        periodStart = periodEnd;
      }
    }
  }

  console.log(`Inserting ${subscriptionRows.length} subscriptions…`);
  await createMany(subscriptionRows, (c) => db.subscription.createMany({ data: c as never }));
  console.log(`Inserting ${subscriptionLineRows.length} subscription lines…`);
  await createMany(subscriptionLineRows, (c) => db.subscriptionLine.createMany({ data: c as never }));
  console.log(`Inserting ${historyRows.length} history rows…`);
  await createMany(historyRows, (c) => db.subscriptionStatusHistory.createMany({ data: c as never }));
  console.log(`Inserting ${invoiceRows.length} invoices…`);
  await createMany(invoiceRows, (c) => db.invoice.createMany({ data: c as never }));
  console.log(`Inserting ${invoiceLineRows.length} invoice lines…`);
  await createMany(invoiceLineRows, (c) => db.invoiceLine.createMany({ data: c as never }));
  console.log(`Inserting ${paymentRows.length} payments…`);
  await createMany(paymentRows, (c) => db.payment.createMany({ data: c as never }));
  console.log(`Inserting ${outboxRows.length} outbox messages…`);
  await createMany(outboxRows, (c) => db.outboxEmail.createMany({ data: c as never }));

  await db.counter.createMany({
    data: [
      { key: 'next_SUB', value: COUNTERS.get('SUB') ?? 0 },
      { key: 'next_INV', value: COUNTERS.get('INV') ?? 0 },
    ],
  });

  const [subCount, invCount, payCount] = await Promise.all([
    db.subscription.count(),
    db.invoice.count(),
    db.payment.count(),
  ]);
  console.log(
    `Seed complete in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `${subCount} subscriptions, ${invCount} invoices, ${payCount} payments.`,
  );
  console.log('Demo logins: admin@brightloop.example / Admin@12345! · staff@brightloop.example / Staff@12345! · ishita.rao@zenithworks.example / Customer@12345!');
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
