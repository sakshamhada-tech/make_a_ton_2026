import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  createSession,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { sendMail } from '@/lib/mail';
import { assertAdmin, type Actor } from '@/lib/rbac';
import type { LoginInput, SignupInput } from '@/validation/auth';
import { staffCreateSchema } from '@/validation/catalog';

async function emailTaken(email: string): Promise<boolean> {
  const existing = await db.user.findUnique({ where: { email } });
  return existing !== null;
}

export async function signupCustomer(input: SignupInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (await emailTaken(email)) {
    throw new ValidationError('An account with this email already exists.');
  }
  const hash = await hashPassword(input.password);
  await db.user.create({
    data: {
      email,
      passwordHash: hash,
      name: input.name,
      role: 'CUSTOMER',
      customer: {
        create: {
          name: input.company ? input.company : input.name,
          email,
        },
      },
    },
    include: { customer: true },
  });
  await sendMail({
    to: email,
    subject: 'Welcome to Brightloop Software customer portal',
    body: [
      `Hello ${input.name},`,
      '',
      'Your Brightloop Software portal account has been created.',
      'You can sign in to view your subscriptions and invoices at /login.',
      '',
      '— Brightloop Software billing',
    ].join('\n'),
  });
}

export async function login(input: LoginInput): Promise<{ userId: string; token: string; role: string } | null> {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) return null;
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) return null;
  const token = await createSession(user.id);
  return { userId: user.id, token, role: user.role };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return; // do not reveal whether the address exists
  const token = await createPasswordResetToken(user.id);
  const link = `/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your Brightloop billing password',
    body: [
      `Hello ${user.name},`,
      '',
      'We received a request to reset your password.',
      `Open this link within 30 minutes to choose a new password: ${link}`,
      'The link can be used once. If you did not request this, ignore this message.',
      '',
      '— Brightloop Software billing',
    ].join('\n'),
    entityType: 'user',
    entityId: user.id,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  const result = await consumePasswordResetToken(token, hash);
  if (!result) {
    throw new ValidationError('This reset link is invalid or has expired. Request a new one.');
  }
}

export async function changeOwnPassword(actor: Actor, currentPassword: string, newPassword: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new ValidationError('Current password is incorrect.');
  }
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

// ---------------------------------------------------------------------------
// Staff accounts (admin only)
// ---------------------------------------------------------------------------

export interface StaffListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export async function listStaff(actor: Actor): Promise<StaffListItem[]> {
  assertAdmin(actor);
  return db.user.findMany({
    where: { role: { in: ['ADMIN', 'STAFF'] } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
}

export async function createStaffAccount(actor: Actor, raw: unknown): Promise<StaffListItem> {
  assertAdmin(actor);
  const input = staffCreateSchema.parse(raw);
  if (await emailTaken(input.email)) {
    throw new ValidationError('An account with this email already exists.');
  }
  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      role: input.role,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  await sendMail({
    to: user.email,
    subject: 'Your Brightloop billing staff account',
    body: [
      `Hello ${user.name},`,
      '',
      `An account with the role ${user.role.toLowerCase()} has been created for you.`,
      `Sign in with your email and the password that was shared with you.`,
      '',
      '— Brightloop Software billing',
    ].join('\n'),
    entityType: 'user',
    entityId: user.id,
  });
  return user;
}

export async function setStaffActive(actor: Actor, userId: string, isActive: boolean): Promise<void> {
  assertAdmin(actor);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('Staff account not found.');
  if (user.role === 'CUSTOMER') throw new ValidationError('That account is a customer account.');
  if (user.id === actor.id && !isActive) {
    throw new ValidationError('You cannot deactivate your own account.');
  }
  await db.user.update({ where: { id: userId }, data: { isActive } });
}
