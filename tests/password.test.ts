import { describe, expect, it } from 'vitest';
import { passwordSchema, emailSchema, signupSchema } from '@/validation/auth';

describe('password policy', () => {
  it('accepts a strong password of 9+ characters', () => {
    expect(passwordSchema.safeParse('Str0ng!Pass').success).toBe(true);
    expect(passwordSchema.safeParse('Customer@12345').success).toBe(true);
  });

  it('rejects passwords of 8 characters or fewer', () => {
    const result = passwordSchema.safeParse('Ab!defgh');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/at least 9 characters/i);
    }
  });

  it('rejects passwords without an uppercase letter', () => {
    expect(passwordSchema.safeParse('lowercase!1').success).toBe(false);
  });

  it('rejects passwords without a lowercase letter', () => {
    expect(passwordSchema.safeParse('UPPERCASE!1').success).toBe(false);
  });

  it('rejects passwords without a special character', () => {
    expect(passwordSchema.safeParse('NoSpecial12').success).toBe(false);
  });

  it('rejects empty and whitespace passwords', () => {
    expect(passwordSchema.safeParse('').success).toBe(false);
    expect(passwordSchema.safeParse('         ').success).toBe(false);
  });
});

describe('email handling', () => {
  it('lowercases emails so uniqueness is case-insensitive', () => {
    const parsed = emailSchema.parse('Ishita.Rao@ZenithWorks.example');
    expect(parsed).toBe('ishita.rao@zenithworks.example');
  });

  it('rejects malformed emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('signup schema', () => {
  it('validates a complete signup', () => {
    const result = signupSchema.safeParse({
      name: 'Ishita Rao',
      email: 'ishita@zenithworks.example',
      password: 'Zenith@2026',
      company: 'Zenith Works',
    });
    expect(result.success).toBe(true);
  });
});
