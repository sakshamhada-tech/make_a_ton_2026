import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export const initialActionState: ActionState = {};

/** Convert FormData into a flat string object (first value per key). */
export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string' && !(key in out)) {
      out[key] = value;
    }
  }
  return out;
}

/** Multi-select values (e.g. product ids on a discount form). */
export function formList(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === 'string');
}

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}

/** Normalise any thrown error into a user-facing ActionState. */
export function toActionState(error: unknown): ActionState {
  // Never swallow Next.js redirects thrown from inside try/catch.
  if (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  ) {
    throw error;
  }
  if (error instanceof ZodError) {
    return { message: 'Fix the highlighted fields and try again.', errors: zodFieldErrors(error) };
  }
  if (error instanceof AppError) {
    return { message: error.message };
  }
  return { message: 'Something went wrong. Please try again.' };
}
