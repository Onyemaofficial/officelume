import { FirebaseError } from 'firebase/app';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, isAuthFailure, toAppError } from './errors';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toAppError (user-friendly error handling)', () => {
  it('surfaces server validation messages and field errors', () => {
    const error = new FirebaseError('functions/invalid-argument', 'Enter a valid phone number.');
    (error as unknown as { details: unknown }).details = { fieldErrors: { phone: 'Enter a valid phone number.' } };
    const app = toAppError(error);
    expect(app.code).toBe('invalid-input');
    expect(app.message).toBe('Enter a valid phone number.');
    expect(app.fieldErrors).toEqual({ phone: 'Enter a valid phone number.' });
  });

  it('never leaks raw technical messages for unknown failures', () => {
    const app = toAppError(new FirebaseError('functions/internal', 'TypeError: cannot read properties of undefined at foo.js:12'));
    expect(app.message).not.toMatch(/TypeError|foo\.js/);
    expect(app.code).toBe('unknown');
    expect(toAppError(new Error('secret stack trace')).message).not.toMatch(/secret/);
  });

  it('maps unauthorized and expired-session cases', () => {
    expect(toAppError(new FirebaseError('permission-denied', 'Missing or insufficient permissions.')).code).toBe('unauthorized');
    expect(toAppError(new FirebaseError('functions/unauthenticated', 'x')).code).toBe('session-expired');
    expect(isAuthFailure(toAppError(new FirebaseError('auth/user-token-expired', 'x')))).toBe(true);
  });

  it('maps sign-in failures to a generic message (no account enumeration)', () => {
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
      expect(toAppError(new FirebaseError(code, 'x')).message).toBe('Incorrect email or password.');
    }
  });

  it('maps availability problems to a friendly retry message', () => {
    for (const code of ['functions/unavailable', 'functions/deadline-exceeded', 'unavailable']) {
      const app = toAppError(new FirebaseError(code, 'x'));
      expect(app.code).toBe('unavailable');
      expect(app.message).toMatch(/temporarily unavailable/i);
    }
  });

  it('reports rate limiting and offline states', () => {
    expect(toAppError(new FirebaseError('functions/resource-exhausted', 'Too many requests.')).code).toBe('rate-limited');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(toAppError(new FirebaseError('functions/unavailable', 'x')).code).toBe('offline');
  });

  it('passes through existing AppErrors', () => {
    const original = new AppError('not-found', 'Nope.');
    expect(toAppError(original)).toBe(original);
  });
});
