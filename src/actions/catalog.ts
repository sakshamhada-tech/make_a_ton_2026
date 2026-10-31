'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { formList, formValues, toActionState, type ActionState } from '@/lib/action-state';
import { createProduct, updateProduct } from '@/services/product.service';
import { createPlan, updatePlan } from '@/services/plan.service';
import { createTax, updateTax } from '@/services/tax.service';
import { createDiscount, updateDiscount } from '@/services/discount.service';
import { createTemplate } from '@/services/template.service';
import { createCustomer, updateCustomer } from '@/services/customer.service';
import { createStaffAccount, setStaffActive } from '@/services/auth.service';

function productPayload(fd: FormData) {
  const values = formValues(fd);
  return {
    name: values.name,
    type: values.type,
    salesPrice: values.salesPrice,
    costPrice: values.costPrice,
    notes: values.notes ?? '',
    isActive: values.isActive === 'on' || values.isActive === 'true',
    variantOptions: collectVariants(fd),
  };
}

function collectVariants(fd: FormData): { id?: string; attribute: string; value: string; priceExtra: string }[] {
  const attributes = formList(fd, 'var_attribute');
  const values = formList(fd, 'var_value');
  const extras = formList(fd, 'var_priceExtra');
  const ids = formList(fd, 'var_id');
  const out: { id?: string; attribute: string; value: string; priceExtra: string }[] = [];
  for (let i = 0; i < attributes.length; i += 1) {
    if (!attributes[i] || !values[i]) continue;
    out.push({
      id: ids[i] || undefined,
      attribute: attributes[i],
      value: values[i],
      priceExtra: extras[i] || '0',
    });
  }
  return out;
}

export async function createProductAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  try {
    const id = await createProduct(actor, productPayload(fd));
    revalidatePath('/products');
    redirect(`/products/${id}?created=1`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateProductAction(productId: string, _state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  try {
    await updateProduct(actor, productId, productPayload(fd));
    revalidatePath(`/products/${productId}`);
    redirect(`/products/${productId}?saved=1`);
  } catch (error) {
    return toActionState(error);
  }
}

function planPayload(fd: FormData) {
  const values = formValues(fd);
  return {
    name: values.name,
    price: values.price,
    period: values.period,
    minQuantity: values.minQuantity ?? '1',
    availableFrom: values.availableFrom,
    availableTo: values.availableTo ?? '',
    autoClose: values.autoClose === 'on',
    allowEarlyClose: values.allowEarlyClose === 'on',
    allowPause: values.allowPause === 'on',
    allowRenew: values.allowRenew === 'on',
    isActive: values.isActive === 'on',
  };
}

export async function createPlanAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  try {
    const id = await createPlan(actor, planPayload(fd));
    revalidatePath('/plans');
    redirect(`/plans/${id}?created=1`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function updatePlanAction(planId: string, _state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  try {
    await updatePlan(actor, planId, planPayload(fd));
    revalidatePath(`/plans/${planId}`);
    redirect(`/plans/${planId}?saved=1`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function createTaxAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  const values = formValues(fd);
  try {
    const id = await createTax(actor, {
      name: values.name,
      rate: values.rate,
      appliesTo: values.appliesTo,
      productIds: formList(fd, 'productIds'),
      isActive: values.isActive === 'on',
    });
    revalidatePath('/taxes');
    redirect(`/taxes?created=${id}`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateTaxAction(taxId: string, _state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  const values = formValues(fd);
  try {
    await updateTax(actor, taxId, {
      name: values.name,
      rate: values.rate,
      appliesTo: values.appliesTo,
      productIds: formList(fd, 'productIds'),
      isActive: values.isActive === 'on',
    });
    revalidatePath('/taxes');
    redirect(`/taxes?saved=${taxId}`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function createDiscountAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  const values = formValues(fd);
  try {
    const id = await createDiscount(actor, {
      name: values.name,
      type: values.type,
      valueRaw: values.valueRaw,
      minPurchaseRaw: values.minPurchaseRaw ?? '',
      minQuantityRaw: values.minQuantityRaw ?? '',
      usageLimitRaw: values.usageLimitRaw ?? '',
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      scope: values.scope,
      productIds: formList(fd, 'productIds'),
      isActive: values.isActive === 'on',
    });
    revalidatePath('/discounts');
    redirect(`/discounts?created=${id}`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateDiscountAction(discountId: string, _state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  const values = formValues(fd);
  try {
    await updateDiscount(actor, discountId, {
      name: values.name,
      type: values.type,
      valueRaw: values.valueRaw,
      minPurchaseRaw: values.minPurchaseRaw ?? '',
      minQuantityRaw: values.minQuantityRaw ?? '',
      usageLimitRaw: values.usageLimitRaw ?? '',
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      scope: values.scope,
      productIds: formList(fd, 'productIds'),
      isActive: values.isActive === 'on',
    });
    revalidatePath('/discounts');
    redirect(`/discounts?saved=${discountId}`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function createTemplateAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  const values = formValues(fd);
  const productIds = formList(fd, 'line_productId');
  const quantities = formList(fd, 'line_quantity');
  const taxIds = formList(fd, 'line_taxId');
  const variantIds = formList(fd, 'line_variantOptionId');
  const lines = productIds
    .map((productId, i) => ({
      productId,
      variantOptionId: variantIds[i] || undefined,
      quantity: quantities[i] || '1',
      taxId: taxIds[i] || undefined,
    }))
    .filter((l) => l.productId !== '');
  try {
    const id = await createTemplate(actor, {
      name: values.name,
      planId: values.planId,
      validityDays: values.validityDays,
      lines,
    });
    revalidatePath('/templates');
    redirect(`/templates?created=${id}`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function createCustomerAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF');
  const values = formValues(fd);
  try {
    const id = await createCustomer(actor, values);
    revalidatePath('/customers');
    redirect(`/customers?created=${id}`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateCustomerAction(customerId: string, _state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF');
  const values = formValues(fd);
  try {
    await updateCustomer(actor, customerId, values);
    revalidatePath(`/customers/${customerId}`);
    redirect(`/customers/${customerId}?saved=1`);
  } catch (error) {
    return toActionState(error);
  }
}

export async function createStaffAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN');
  const values = formValues(fd);
  try {
    await createStaffAccount(actor, values);
    revalidatePath('/staff');
    redirect('/staff?created=1');
  } catch (error) {
    return toActionState(error);
  }
}

export async function setStaffActiveAction(userId: string, isActive: boolean): Promise<void> {
  const actor = await requireUser('ADMIN');
  await setStaffActive(actor, userId, isActive);
  revalidatePath('/staff');
}
