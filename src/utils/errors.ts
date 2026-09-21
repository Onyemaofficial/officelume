import { FirebaseError } from 'firebase/app';

export type AppErrorCode =
  | 'invalid-input'
  | 'unauthorized'
  | 'session-expired'
  | 'not-found'
  | 'rate-limited'
  | 'conflict'
  | 'offline'
  | 'unavailable'
  | 'unknown';

/** A user-presentable error. `message` is always safe to show; raw errors are never surfaced. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fieldErrors: Record<string, string> | undefined;

  constructor(code: AppErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const MESSAGES = {
  offline: "You appear to be offline. Check your internet connection and try again.",
  unavailable: 'OfficeLume is temporarily unavailable. Please try again in a moment.',
  unauthorized: 'You are not authorized to do that.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  notFound: 'We could not find that record.',
  rateLimited: 'Too many requests in a short time. Please wait a moment and try again.',
  unknown: 'Something went wrong. Please try again.',
} as const;

function extractFieldErrors(details: unknown): Record<string, string> | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (typeof fieldErrors !== 'object' || fieldErrors === null) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (typeof value === 'string') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Map any thrown value (Firebase Auth / Firestore / Functions / network) to a friendly AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new AppError('offline', MESSAGES.offline);
  }

  if (error instanceof FirebaseError) {
    const code = error.code.replace(/^(functions|auth|firestore)\//, '');
    switch (code) {
      case 'invalid-argument':
        // Server validation messages are written for end users.
        return new AppError('invalid-input', error.message, extractFieldErrors((error as { details?: unknown }).details));
      case 'unauthenticated':
      case 'user-token-expired':
      case 'id-token-expired':
      case 'requires-recent-login':
        return new AppError('session-expired', MESSAGES.sessionExpired);
      case 'permission-denied':
        return new AppError('unauthorized', MESSAGES.unauthorized);
      case 'not-found':
        return new AppError('not-found', error.message || MESSAGES.notFound);
      case 'resource-exhausted':
        // Our own function messages are user-friendly.
        return new AppError('rate-limited', error.message || MESSAGES.rateLimited);
      case 'too-many-requests':
        return new AppError('rate-limited', 'Too many sign-in attempts. Please wait a few minutes and try again.');
      case 'failed-precondition':
      case 'aborted':
        return new AppError('conflict', error.message || MESSAGES.unknown);
      case 'unavailable':
      case 'deadline-exceeded':
      case 'network-request-failed':
        return new AppError('unavailable', MESSAGES.unavailable);
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
      case 'invalid-email':
        return new AppError('unauthorized', 'Incorrect email or password.');
      case 'user-disabled':
        return new AppError('unauthorized', 'This account has been disabled.');
      default:
        return new AppError('unknown', MESSAGES.unknown);
    }
  }

  return new AppError('unknown', MESSAGES.unknown);
}

/** True for errors that mean "sign in again" rather than "retry". */
export function isAuthFailure(error: AppError): boolean {
  return error.code === 'session-expired' || error.code === 'unauthorized';
}
