'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { formValues, toActionState, type ActionState } from '@/lib/action-state';
import { cancelInvoice, confirmInvoice, sendInvoice } from '@/services/invoice.service';
import { deletePayment, recordPayment } from '@/services/payment.service';
import { runBilling } from '@/services/billing.service';
import { parseDateInput } from '@/lib/dates';
import { ValidationError } from '@/lib/errors';

export async function confirmInvoiceAction(invoiceId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await confirmInvoice(actor, invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath('/invoices');
}

export async function cancelInvoiceAction(invoiceId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await cancelInvoice(actor, invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath('/invoices');
}

export async function sendInvoiceAction(invoiceId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await sendInvoice(actor, invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function recordPaymentAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF');
  const values = formValues(fd);
  try {
    await recordPayment(actor, {
      invoiceId: values.invoiceId,
      method: values.method,
      amount: values.amount,
      paidAt: values.paidAt,
      note: values.note ?? '',
    });
    revalidatePath(`/invoices/${values.invoiceId}`);
    revalidatePath('/invoices');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Payment recorded.' };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deletePaymentAction(paymentId: string, invoiceId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await deletePayment(actor, paymentId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function runBillingAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF');
  const values = formValues(fd);
  const asOf = parseDateInput(values.asOfDate);
  if (!asOf) {
    return { message: 'Choose a valid billing date.' };
  }
  try {
    const summary = await runBilling(actor, asOf);
    revalidatePath('/billing');
    revalidatePath('/dashboard');
    revalidatePath('/invoices');
    revalidatePath('/subscriptions');
    return {
      ok: true,
      message: `Billing run complete: ${summary.created} created, ${summary.skipped} skipped, ${summary.failed} failed, ${summary.autoClosed} auto-closed.`,
    };
  } catch (error) {
    if (error instanceof ValidationError) return { message: error.message };
    return toActionState(error);
  }
}
