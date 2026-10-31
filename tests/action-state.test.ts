import { describe, expect, it } from 'vitest';
import { toActionState } from '@/lib/action-state';
import { ValidationError } from '@/lib/errors';

describe('toActionState', () => {
  it('rethrows Next.js redirect digests instead of swallowing them', () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;push;/dashboard;303;',
    });
    expect(() => toActionState(redirectError)).toThrow(redirectError);
  });

  it('maps validation errors to a message state', () => {
    const state = toActionState(new ValidationError('Name is required.'));
    expect(state).toEqual({ message: 'Name is required.' });
  });

  it('maps unknown errors to the generic message', () => {
    expect(toActionState(new Error('boom'))).toEqual({
      message: 'Something went wrong. Please try again.',
    });
  });
});
