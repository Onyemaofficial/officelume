import { FirebaseError } from 'firebase/app';
import { AppError } from '../../utils/errors';

/** User-facing sign-in messages. Raw Firebase errors are never shown. */
export const LOGIN_MESSAGES = {
  invalidCredentials: 'Email or password is incorrect.',
  tooManyAttempts: 'Too many unsuccessful sign-in attempts. Please try again later.',
  network: 'Unable to connect. Check your internet connection and try again.',
  notAuthorized: 'This account is not authorized to access the OfficeLume staff portal.',
  inactive: 'This account is currently inactive. Contact an administrator.',
  unknown: 'Unable to sign in at this time. Please try again.',
} as const;

export const RESET_CONFIRMATION =
  'If an eligible account exists for that email address, a password reset email has been sent.';

/**
 * Map anything thrown while signing in to a friendly AppError.
 * Deliberately gives the same answer for "no such account" and "wrong password" so the form cannot
 * be used to discover which email addresses belong to staff.
 */
export function mapLoginError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new AppError('offline', LOGIN_MESSAGES.network);
  }

  if (error instanceof FirebaseError) {
    switch (error.code.replace(/^auth\//, '')) {
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
      case 'invalid-email':
      case 'missing-password':
        return new AppError('unauthorized', LOGIN_MESSAGES.invalidCredentials);
      case 'too-many-requests':
        return new AppError('rate-limited', LOGIN_MESSAGES.tooManyAttempts);
      case 'network-request-failed':
        return new AppError('unavailable', LOGIN_MESSAGES.network);
      case 'user-disabled':
        return new AppError('unauthorized', LOGIN_MESSAGES.inactive);
      default:
        return new AppError('unknown', LOGIN_MESSAGES.unknown);
    }
  }
  return new AppError('unknown', LOGIN_MESSAGES.unknown);
}
