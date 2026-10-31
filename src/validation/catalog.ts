import { z } from 'zod';
import {
  BILLING_PERIODS,
  DISCOUNT_SCOPES,
  DISCOUNT_TYPES,
  PAYMENT_TERMS,
  PRODUCT_TYPES,
} from '@/lib/enums';
import { bpsFromDecimalString, moneyFromInput } from '@/lib/money';
import { parseDateInput } from '@/lib/dates';
import { emailSchema as emailLikeSchema, passwordSchema } from '@/validation/auth';

export const moneyString = z
  .string()
  .trim()
  .min(1, 'Amount is required.')
  .refine((v) => {
    try {
      moneyFromInput(v);
      return true;
    } catch {
      return false;
    }
  }, 'Enter a valid amount, e.g. 1499.00')
  .transform((v) => moneyFromInput(v));

export const percentString = z
  .string()
  .trim()
  .min(1, 'Rate is required.')
  .refine((v) => {
    try {
      bpsFromDecimalString(v);
      return true;
    } catch {
      return false;
    }
  }, 'Enter a valid percentage, e.g. 18 or 7.5')
  .transform((v) => bpsFromDecimalString(v));

export const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
  .refine((v) => parseDateInput(v) !== null, 'Enter a valid date.')
  .transform((v) => parseDateInput(v) as Date);

export const optionalDateString = z
  .string()
  .trim()
  .optional()
  .refine((v) => v === undefined || v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date.')
  .transform((v) => (v ? parseDateInput(v) : null));

export const positiveIntString = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Enter a whole number.')
  .transform((v) => Number.parseInt(v, 10));

export const idSchema = z.string().trim().min(1, 'Required.');

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const variantOptionInputSchema = z.object({
  id: z.string().trim().optional(),
  attribute: z.string().trim().min(1, 'Attribute is required.').max(60),
  value: z.string().trim().min(1, 'Value is required.').max(60),
  priceExtra: moneyString,
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  type: z.enum(PRODUCT_TYPES, { errorMap: () => ({ message: 'Choose a product type.' }) }),
  salesPrice: moneyString,
  costPrice: moneyString,
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  isActive: z.coerce.boolean().optional(),
  variantOptions: z.array(variantOptionInputSchema).max(20).default([]),
});
export type ProductInput = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const planSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
    price: moneyString,
    period: z.enum(BILLING_PERIODS, { errorMap: () => ({ message: 'Choose a billing period.' }) }),
    minQuantity: positiveIntString.refine((v) => v >= 1, 'Minimum quantity must be at least 1.'),
    availableFrom: dateString,
    availableTo: optionalDateString,
    autoClose: z.coerce.boolean().optional(),
    allowEarlyClose: z.coerce.boolean().optional(),
    allowPause: z.coerce.boolean().optional(),
    allowRenew: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .refine((v) => !v.availableTo || v.availableTo.getTime() >= v.availableFrom.getTime(), {
    message: 'Available-to date must be after the available-from date.',
    path: ['availableTo'],
  });
export type PlanInput = z.infer<typeof planSchema>;

// ---------------------------------------------------------------------------
// Taxes
// ---------------------------------------------------------------------------

export const taxSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  rate: percentString.refine((v) => v > 0 && v <= 100_00, 'Rate must be between 0 and 100.'),
  appliesTo: z.enum(['ALL', 'PRODUCTS']),
  productIds: z.array(idSchema).max(200).default([]),
  isActive: z.coerce.boolean().optional(),
});
export type TaxInput = z.infer<typeof taxSchema>;

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

export const discountSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
    type: z.enum(DISCOUNT_TYPES),
    valueRaw: z.string().trim().min(1, 'Value is required.'),
    minPurchaseRaw: z.string().trim().optional(),
    minQuantityRaw: z.string().trim().optional(),
    usageLimitRaw: z.string().trim().optional(),
    startsAt: dateString,
    endsAt: dateString,
    scope: z.enum(DISCOUNT_SCOPES),
    productIds: z.array(idSchema).max(200).default([]),
    isActive: z.coerce.boolean().optional(),
  })
  .refine((v) => v.endsAt.getTime() > v.startsAt.getTime(), {
    message: 'End date must be after the start date.',
    path: ['endsAt'],
  })
  .refine((v) => v.scope !== 'PRODUCTS' || v.productIds.length > 0, {
    message: 'Select at least one product for a product-scoped discount.',
    path: ['productIds'],
  })
  .superRefine((v, ctx) => {
    if (v.type === 'PERCENT') {
      try {
        const bps = bpsFromDecimalString(v.valueRaw);
        if (bps <= 0 || bps > 10_000) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valueRaw'], message: 'Percentage must be between 0 and 100.' });
        }
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valueRaw'], message: 'Enter a valid percentage, e.g. 10 or 7.5.' });
      }
    } else {
      try {
        if (moneyFromInput(v.valueRaw) <= 0) throw new Error('non-positive');
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valueRaw'], message: 'Enter a valid amount greater than zero.' });
      }
    }
    if (v.minPurchaseRaw) {
      try {
        moneyFromInput(v.minPurchaseRaw);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minPurchaseRaw'], message: 'Enter a valid amount.' });
      }
    }
    for (const [raw, label, field] of [
      [v.minQuantityRaw, 'quantity', 'minQuantityRaw'],
      [v.usageLimitRaw, 'usage limit', 'usageLimitRaw'],
    ] as const) {
      if (raw !== undefined && raw !== '' && !/^\d+$/.test(raw)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `Enter a valid ${label}.` });
      }
    }
  });
export type DiscountForm = z.infer<typeof discountSchema>;

/** Parsed discount values after raw-string conversion. */
export interface DiscountData {
  name: string;
  type: 'FIXED' | 'PERCENT';
  value: number; // minor units when FIXED, basis points when PERCENT
  minPurchase: number | null;
  minQuantity: number | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  scope: 'SUBSCRIPTION' | 'PRODUCTS';
  productIds: string[];
  isActive: boolean;
}

export function parseDiscountForm(input: DiscountForm): DiscountData {
  return {
    name: input.name,
    type: input.type,
    value: input.type === 'PERCENT' ? bpsFromDecimalString(input.valueRaw) : moneyFromInput(input.valueRaw),
    minPurchase: input.minPurchaseRaw ? moneyFromInput(input.minPurchaseRaw) : null,
    minQuantity: input.minQuantityRaw ? Number.parseInt(input.minQuantityRaw, 10) : null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    usageLimit: input.usageLimitRaw ? Number.parseInt(input.usageLimitRaw, 10) : null,
    scope: input.scope,
    productIds: input.productIds,
    isActive: input.isActive ?? true,
  };
}

// ---------------------------------------------------------------------------
// Quotation templates
// ---------------------------------------------------------------------------

export const templateLineSchema = z.object({
  productId: z.string().trim().min(1, 'Choose a product.'),
  variantOptionId: z.string().trim().optional(),
  quantity: positiveIntString.refine((v) => v >= 1, 'Quantity must be at least 1.'),
  taxId: z.string().trim().optional(),
});

export const templateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  planId: idSchema,
  validityDays: positiveIntString.refine((v) => v >= 1 && v <= 365, 'Validity must be between 1 and 365 days.'),
  lines: z.array(templateLineSchema).min(1, 'Add at least one product line.'),
});
export type TemplateInput = z.infer<typeof templateSchema>;

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  email: emailLikeSchema,
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  gstin: z.string().trim().max(20).optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;

// ---------------------------------------------------------------------------
// Staff accounts (admin only)
// ---------------------------------------------------------------------------

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.')
    .transform((v) => v.toLowerCase()),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'STAFF']),
});
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;

export const paymentTermsSchema = z.enum(PAYMENT_TERMS);
