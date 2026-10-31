import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/enums';
import { moneyString } from '@/validation/catalog';
import { dateString, idSchema } from '@/validation/catalog';

export const paymentCreateSchema = z.object({
  invoiceId: idSchema,
  method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Choose a payment method.' }) }),
  amount: moneyString.refine((v) => v > 0, 'Amount must be greater than zero.'),
  paidAt: dateString,
  note: z.string().trim().max(500).optional(),
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const billingRunSchema = z.object({
  asOfDate: dateString,
});
export type BillingRunInput = z.infer<typeof billingRunSchema>;

export const invoiceActionSchema = z.object({
  id: idSchema,
});

export const generateInvoiceSchema = z.object({
  subscriptionId: idSchema,
});
