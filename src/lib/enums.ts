export const ROLES = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

export const SUBSCRIPTION_STATUSES = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const BILLING_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const PRODUCT_TYPES = ['license', 'addon', 'service', 'support'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PAYMENT_METHODS = ['CARD', 'BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DISCOUNT_TYPES = ['FIXED', 'PERCENT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_SCOPES = ['SUBSCRIPTION', 'PRODUCTS'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];

export const LINE_KINDS = ['PLAN', 'PRODUCT'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const PAYMENT_TERMS = ['Net 7', 'Net 15', 'Net 30', 'Due on receipt'] as const;

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  DRAFT: 'Draft',
  QUOTATION: 'Quotation',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export const PERIOD_LABELS: Record<BillingPeriod, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  UPI: 'UPI',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
};
