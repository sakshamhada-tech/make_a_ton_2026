'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { formValues, toActionState, type ActionState } from '@/lib/action-state';
import {
  addSubscriptionLine,
  closeSubscription,
  createSubscription,
  deleteSubscription,
  pauseSubscription,
  removeSubscriptionLine,
  renewSubscription,
  resumeSubscription,
  transitionSubscription,
  updateSubscription,
} from '@/services/subscription.service';
import { createInvoiceFromSubscription } from '@/services/invoice.service';

export async function createSubscriptionAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF');
  const values = formValues(fd);
  const productIds = fd.getAll('line_productId').filter((v): v is string => typeof v === 'string');
  const quantities = fd.getAll('line_quantity').filter((v): v is string => typeof v === 'string');
  const variantIds = fd.getAll('line_variantOptionId').filter((v): v is string => typeof v === 'string');
  const taxIds = fd.getAll('line_taxId').filter((v): v is string => typeof v === 'string');
  const lines = productIds
    .map((productId, i) => ({
      productId,
      variantOptionId: variantIds[i] || undefined,
      quantity: quantities[i] || '1',
      taxId: taxIds[i] || undefined,
    }))
    .filter((l) => l.productId !== '');
  try {
    const id = await createSubscription(actor, {
      customerId: values.customerId,
      planId: values.planId,
      quantity: values.quantity,
      startDate: values.startDate,
      endDate: values.endDate,
      paymentTerms: values.paymentTerms,
      templateId: values.templateId || undefined,
      lines,
    });
    revalidatePath('/subscriptions');
    redirect(`/subscriptions/${id}?created=1`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateSubscriptionAction(subscriptionId: string, _state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF');
  const values = formValues(fd);
  try {
    await updateSubscription(actor, subscriptionId, {
      paymentTerms: values.paymentTerms,
      startDate: values.startDate,
      endDate: values.endDate,
      quantity: values.quantity,
    });
    revalidatePath(`/subscriptions/${subscriptionId}`);
    redirect(`/subscriptions/${subscriptionId}?saved=1`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function transitionSubscriptionAction(subscriptionId: string, toStatus: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await transitionSubscription(actor, subscriptionId, toStatus);
  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath('/subscriptions');
}

export async function pauseSubscriptionAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await pauseSubscription(actor, subscriptionId);
  revalidatePath(`/subscriptions/${subscriptionId}`);
}

export async function resumeSubscriptionAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await resumeSubscription(actor, subscriptionId);
  revalidatePath(`/subscriptions/${subscriptionId}`);
}

export async function closeSubscriptionAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await closeSubscription(actor, subscriptionId);
  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath('/subscriptions');
}

export async function renewSubscriptionAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await renewSubscription(actor, subscriptionId);
  revalidatePath(`/subscriptions/${subscriptionId}`);
}

export async function deleteSubscriptionAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await deleteSubscription(actor, subscriptionId);
  revalidatePath('/subscriptions');
}

export async function addSubscriptionLineAction(subscriptionId: string, _state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF');
  const values = formValues(fd);
  try {
    await addSubscriptionLine(actor, subscriptionId, {
      productId: values.productId,
      variantOptionId: values.variantOptionId || undefined,
      quantity: values.quantity,
      taxId: values.taxId || undefined,
    });
    revalidatePath(`/subscriptions/${subscriptionId}`);
    redirect(`/subscriptions/${subscriptionId}?lineAdded=1`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function removeSubscriptionLineAction(subscriptionId: string, lineId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await removeSubscriptionLine(actor, subscriptionId, lineId);
  revalidatePath(`/subscriptions/${subscriptionId}`);
}

export async function generateInvoiceAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('ADMIN', 'STAFF');
  await createInvoiceFromSubscription(actor, subscriptionId);
  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath('/invoices');
}
