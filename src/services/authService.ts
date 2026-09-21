import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { toAppError, AppError } from '../utils/errors';
import { callFunction } from './callables';

export type LoginFailureReason = 'invalid_credentials' | 'not_authorized' | 'too_many_attempts' | 'other';

export interface AdminIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/** The role comes from a custom claim set only by the Admin SDK - never from client-supplied data. */
export async function readIsAdmin(user: FirebaseUser): Promise<boolean> {
  const token = await user.getIdTokenResult();
  return token.claims['role'] === 'admin';
}

export function toIdentity(user: FirebaseUser): AdminIdentity {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

/** Subscribe to sign-in state (also fires on token refresh, so claim changes are picked up). */
export function subscribeToAuth(callback: (user: FirebaseUser | null) => void): () => void {
  return onIdTokenChanged(auth, callback, () => callback(null));
}

async function recordLoginEvent(outcome: 'success' | 'failure', reason?: LoginFailureReason): Promise<boolean> {
  try {
    const result = await callFunction<{ outcome: string; reason?: string }, { authorized: boolean }>(
      'recordAdminLoginEvent',
      { outcome, ...(reason ? { reason } : {}) },
    );
    return result.authorized;
  } catch {
    return false;
  }
}

/**
 * Sign in with email/password, then have the server confirm the account is an active administrator
 * (and write the audit event). A valid customer/non-admin account is signed straight back out.
 */
export async function signInAdmin(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    const appError = toAppError(error);
    void recordLoginEvent('failure', appError.code === 'rate-limited' ? 'too_many_attempts' : 'invalid_credentials');
    throw appError;
  }

  const authorized = await recordLoginEvent('success');
  if (!authorized) {
    await firebaseSignOut(auth);
    throw new AppError('unauthorized', 'This account is not authorized to use the admin area.');
  }
}

export async function signOutAdmin(): Promise<void> {
  await firebaseSignOut(auth);
}

/** Force a token refresh so a newly granted (or revoked) admin claim takes effect. */
export async function refreshSession(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    await user.getIdToken(true);
    return await readIsAdmin(user);
  } catch {
    return false;
  }
}
