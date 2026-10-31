'use server';

import { requireUser } from '@/lib/auth';
import { changeOwnPassword } from '@/services/auth.service';
import { toActionState, type ActionState } from '@/lib/action-state';
import { passwordSchema } from '@/validation/auth';
import { ValidationError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

export async function changePasswordAction(_state: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireUser('ADMIN', 'STAFF', 'CUSTOMER');
  const current = String(fd.get('currentPassword') ?? '');
  const next = String(fd.get('newPassword') ?? '');
  const confirm = String(fd.get('confirmPassword') ?? '');
  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { message: 'Fix the highlighted fields and try again.', errors: { newPassword: issue?.message ?? 'Invalid password.' } };
  }
  if (next !== confirm) {
    return { message: 'Fix the highlighted fields and try again.', errors: { confirmPassword: 'Passwords do not match.' } };
  }
  try {
    await changeOwnPassword(actor, current, next);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { message: error.message, errors: { currentPassword: error.message } };
    }
    return toActionState(error);
  }
  revalidatePath('/portal/profile');
  return { ok: true, message: 'Password updated.' };
}
