'use server';

import { redirect } from 'next/navigation';
import { clearSessionCookie, destroySession, getSessionToken, setSessionCookie } from '@/lib/auth';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/validation/auth';
import {
  login as loginService,
  requestPasswordReset,
  resetPassword,
  signupCustomer,
} from '@/services/auth.service';
import { formValues, toActionState, zodFieldErrors, type ActionState } from '@/lib/action-state';

function homeFor(role: string): string {
  if (role === 'CUSTOMER') return '/portal';
  return '/dashboard';
}

export async function signupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { message: 'Fix the highlighted fields and try again.', errors: zodFieldErrors(parsed.error) };
  }
  try {
    await signupCustomer(parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  redirect('/login?signedup=1');
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { message: 'Fix the highlighted fields and try again.', errors: zodFieldErrors(parsed.error) };
  }
  const result = await loginService(parsed.data);
  if (!result) {
    return { message: 'Email or password is incorrect.' };
  }
  await setSessionCookie(result.token);
  redirect(homeFor(result.role));
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    await destroySession(token);
  }
  await clearSessionCookie();
  redirect('/login');
}

export async function forgotPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { message: 'Fix the highlighted fields and try again.', errors: zodFieldErrors(parsed.error) };
  }
  await requestPasswordReset(parsed.data.email);
  redirect('/forgot-password?sent=1');
}

export async function resetPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = resetPasswordSchema.safeParse({
    token: values.token,
    password: values.password,
    confirmPassword: values.confirmPassword,
  });
  if (!parsed.success) {
    return { message: 'Fix the highlighted fields and try again.', errors: zodFieldErrors(parsed.error) };
  }
  try {
    await resetPassword(parsed.data.token, parsed.data.password);
  } catch (error) {
    return toActionState(error);
  }
  redirect('/login?reset=1');
}
