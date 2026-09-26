import { FirebaseError } from 'firebase/app';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/errors';
import { LOGIN_MESSAGES, mapLoginError } from './loginErrors';

afterEach(() => vi.restoreAllMocks());

describe('mapLoginError - friendly, non-revealing sign-in messages', () => {
  it.each(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'])(
    'maps %s to the same generic message (cannot reveal whether an email is a staff account)',
    (code) => {
      expect(mapLoginError(new FirebaseError(code, 'Firebase: raw internal text')).message).toBe('Email or password is incorrect.');
    },
  );

  it('reports rate limiting', () => {
    const error = mapLoginError(new FirebaseError('auth/too-many-requests', 'raw'));
    expect(error.message).toBe('Too many unsuccessful sign-in attempts. Please try again later.');
    expect(error.code).toBe('rate-limited');
  });

  it('reports network problems', () => {
    expect(mapLoginError(new FirebaseError('auth/network-request-failed', 'raw')).message).toBe(
      'Unable to connect. Check your internet connection and try again.',
    );
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(mapLoginError(new FirebaseError('auth/invalid-credential', 'raw')).message).toBe(LOGIN_MESSAGES.network);
  });

  it('reports a disabled Firebase account', () => {
    expect(mapLoginError(new FirebaseError('auth/user-disabled', 'raw')).message).toBe(
      'This account is currently inactive. Contact an administrator.',
    );
  });

  it('never leaks raw or unknown errors', () => {
    for (const thrown of [new FirebaseError('auth/internal-error', 'stack: at foo.js:12'), new Error('TypeError: x is undefined'), 'boom', null]) {
      const mapped = mapLoginError(thrown);
      expect(mapped.message).toBe('Unable to sign in at this time. Please try again.');
      expect(mapped.message).not.toMatch(/foo\.js|TypeError|undefined/);
    }
  });

  it('passes through our own AppErrors (e.g. the not-authorized message)', () => {
    const own = new AppError('unauthorized', LOGIN_MESSAGES.notAuthorized);
    expect(mapLoginError(own)).toBe(own);
    expect(LOGIN_MESSAGES.notAuthorized).toBe('This account is not authorized to access the OfficeLume staff portal.');
  });
});
