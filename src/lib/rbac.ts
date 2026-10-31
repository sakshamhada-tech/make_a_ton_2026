import type { Role } from '@/lib/enums';
import { ForbiddenError } from '@/lib/errors';

/** The acting user for service calls; never derived from client input. */
export interface Actor {
  id: string;
  role: Role;
  customerId?: string | null;
}

export function isStaff(actor: Actor): boolean {
  return actor.role === 'ADMIN' || actor.role === 'STAFF';
}

export function assertStaff(actor: Actor): void {
  if (!isStaff(actor)) {
    throw new ForbiddenError('This action is limited to staff accounts.');
  }
}

export function assertAdmin(actor: Actor): void {
  if (actor.role !== 'ADMIN') {
    throw new ForbiddenError('This action is limited to administrators.');
  }
}

/** Customers may only act on their own records; staff act on any. */
export function assertCustomerAccess(actor: Actor, customerId: string | null): void {
  if (isStaff(actor)) return;
  if (actor.role !== 'CUSTOMER' || !actor.customerId || actor.customerId !== customerId) {
    throw new ForbiddenError('You can only access your own records.');
  }
}
