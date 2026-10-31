'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import {
  portalCloseSubscription,
  portalPauseSubscription,
  portalRenewSubscription,
  portalResumeSubscription,
} from '@/services/subscription.service';

export async function portalPauseAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('CUSTOMER');
  await portalPauseSubscription(actor, subscriptionId);
  revalidatePath('/portal');
  revalidatePath(`/portal/subscriptions/${subscriptionId}`);
}

export async function portalResumeAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('CUSTOMER');
  await portalResumeSubscription(actor, subscriptionId);
  revalidatePath('/portal');
  revalidatePath(`/portal/subscriptions/${subscriptionId}`);
}

export async function portalRenewAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('CUSTOMER');
  await portalRenewSubscription(actor, subscriptionId);
  revalidatePath('/portal');
  revalidatePath(`/portal/subscriptions/${subscriptionId}`);
}

export async function portalCloseAction(subscriptionId: string): Promise<void> {
  const actor = await requireUser('CUSTOMER');
  await portalCloseSubscription(actor, subscriptionId);
  revalidatePath('/portal');
  revalidatePath(`/portal/subscriptions/${subscriptionId}`);
}
