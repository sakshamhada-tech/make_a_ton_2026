import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { login, requestPasswordReset, resetPassword, signupCustomer } from '@/services/auth.service';
import { randomBytes } from 'node:crypto';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    expect(await verifyPassword('Str0ng!Pass', hash)).toBe(true);
    expect(await verifyPassword('wrong!Pass', hash)).toBe(false);
  });

  it('never stores the plaintext', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    expect(hash).not.toContain('Str0ng!Pass');
    expect(hash.startsWith('$2')).toBe(true);
  });
});

describe('signup and login', () => {
  it('creates a customer account with a portal profile and lowercased email', async () => {
    const suffix = randomBytes(3).toString('hex');
    await signupCustomer({
      name: 'Test Customer',
      email: `Case.Test-${suffix}@Example.test`,
      password: 'Passw0rd!x',
      company: 'Case Test Co',
    });
    const user = await db.user.findUnique({
      where: { email: `case.test-${suffix}@example.test` },
      include: { customer: true },
    });
    expect(user).not.toBeNull();
    expect(user?.role).toBe('CUSTOMER');
    expect(user?.customer).not.toBeNull();
  });

  it('rejects duplicate emails regardless of case', async () => {
    const suffix = randomBytes(3).toString('hex');
    await signupCustomer({
      name: 'First',
      email: `dup-${suffix}@example.test`,
      password: 'Passw0rd!x',
    });
    await expect(
      signupCustomer({
        name: 'Second',
        email: `DUP-${suffix}@EXAMPLE.test`,
        password: 'Passw0rd!x',
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it('logs in with correct credentials and fails on bad ones', async () => {
    const suffix = randomBytes(3).toString('hex');
    const email = `login-${suffix}@example.test`;
    await signupCustomer({ name: 'Login User', email, password: 'Passw0rd!x' });

    const ok = await login({ email, password: 'Passw0rd!x' });
    expect(ok).not.toBeNull();

    const bad = await login({ email, password: 'wrong-pass' });
    expect(bad).toBeNull();
  });
});

describe('password reset flow', () => {
  it('sends a single-use token that expires after consumption', async () => {
    const suffix = randomBytes(3).toString('hex');
    const email = `reset-${suffix}@example.test`;
    await signupCustomer({ name: 'Reset User', email, password: 'Passw0rd!x' });

    const before = await db.outboxEmail.count();
    await requestPasswordReset(email);
    const after = await db.outboxEmail.count();
    expect(after).toBe(before + 1);

    const message = await db.outboxEmail.findFirst({
      where: { toEmail: email },
      orderBy: { createdAt: 'desc' },
    });
    const token = /token=([a-f0-9]+)/.exec(message?.body ?? '')?.[1];
    expect(token).toBeTruthy();

    // Consume once
    const result = await consumePasswordResetToken(token as string, await hashPassword('NewPassw0rd!'));
    expect(result).not.toBeNull();

    // Second use is rejected
    const replay = await consumePasswordResetToken(token as string, await hashPassword('OtherPassw0rd!'));
    expect(replay).toBeNull();
  });

  it('does not reveal whether an email exists', async () => {
    const before = await db.outboxEmail.count();
    await requestPasswordReset('definitely-missing@example.test');
    expect(await db.outboxEmail.count()).toBe(before);
  });

  it('resets through the service with an invalid token error', async () => {
    await expect(resetPassword('totally-invalid-token-value', 'NewPassw0rd!')).rejects.toThrow(/invalid|expired/i);
  });

  it('createPasswordResetToken issues a verifiable hashed token', async () => {
    const suffix = randomBytes(3).toString('hex');
    const user = await db.user.create({
      data: { email: `tok-${suffix}@example.test`, passwordHash: 'x', name: 'Token User', role: 'CUSTOMER' },
    });
    const token = await createPasswordResetToken(user.id);
    const stored = await db.passwordResetToken.findFirst({ where: { userId: user.id } });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toHaveLength(64);
  });
});
