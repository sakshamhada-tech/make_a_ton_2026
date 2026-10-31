import { z } from 'zod';
import { PAYMENT_TERMS } from '@/lib/enums';
import { dateString, idSchema, positiveIntString } from '@/validation/catalog';

export const subscriptionLineInputSchema = z.object({
  productId: idSchema,
  variantOptionId: z.string().trim().optional(),
  quantity: positiveIntString.refine((v) => v >= 1, 'Quantity must be at least 1.'),
  taxId: z.string().trim().optional(),
});

export const subscriptionCreateSchema = z
  .object({
    customerId: idSchema,
    planId: idSchema,
    quantity: positiveIntString.refine((v) => v >= 1, 'Quantity must be at least 1.'),
    startDate: dateString,
    endDate: dateString,
    paymentTerms: z.enum(PAYMENT_TERMS),
    templateId: z.string().trim().optional(),
    lines: z.array(subscriptionLineInputSchema).max(50).default([]),
  })
  .refine((v) => v.endDate.getTime() > v.startDate.getTime(), {
    message: 'Expiry date must be after the start date.',
    path: ['endDate'],
  });
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;

export const subscriptionAddLineSchema = z.object({
  productId: idSchema,
  variantOptionId: z.string().trim().optional(),
  quantity: positiveIntString.refine((v) => v >= 1, 'Quantity must be at least 1.'),
  taxId: z.string().trim().optional(),
});

export const subscriptionUpdateSchema = z.object({
  paymentTerms: z.enum(PAYMENT_TERMS),
  startDate: dateString,
  endDate: dateString,
  quantity: positiveIntString.refine((v) => v >= 1, 'Quantity must be at least 1.'),
});

export const subscriptionStatusSchema = z.object({
  id: idSchema,
  note: z.string().trim().max(500).optional(),
});

export const portalActionSchema = z.object({
  id: idSchema,
});
