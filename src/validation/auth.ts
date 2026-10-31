import { z } from 'zod';

/**
 * Password policy: more than 8 characters (min 9) with at least one
 * uppercase letter, one lowercase letter and one special character.
 */
export const passwordSchema = z
  .string()
  .min(9, 'Password must be at least 9 characters long.')
  .max(128, 'Password must be at most 128 characters long.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character.');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .max(254, 'Email must be at most 254 characters.')
  .email('Enter a valid email address.')
  .transform((v) => v.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  email: emailSchema,
  password: passwordSchema,
  company: z.string().trim().min(2, 'Company name must be at least 2 characters.').max(120).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Reset link is invalid.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
