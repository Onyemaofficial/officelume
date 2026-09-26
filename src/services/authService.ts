import { FirebaseError } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onIdTokenChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import type { AuthIdentity, SessionResult } from '../features/auth/auth.types';
import { LOGIN_MESSAGES, mapLoginError } from '../features/auth/loginErrors';
import { evaluateSession } from '../features/auth/session';
import { AppError, toAppError } from '../utils/errors';
import { callFunction } from './callables';
import { mapStaffProfile } from './mappers';

/**
 * All Firebase Authentication access for the staff portal lives here, so pages and components never
 * call Firebase Auth directly. Roles come from a custom claim (set only by the Admin SDK) and are
 * cross-checked against the user's Firestore profile.
 */

export type LoginFailureReason = 'invalid_credentials' | 'not_authorized' | 'too_many_attempts' | 'other';

export function toIdentity(user: FirebaseUser): AuthIdentity {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

/** Subscribe to sign-in state (also fires on token refresh, so claim changes are picked up). */
export function subscribeToAuth(callback: (user: FirebaseUser | null) => void): () => void {
  return onIdTokenChanged(auth, callback, () => callback(null));
}

export function currentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Resolve the signed-in user into a verified staff session: read the role claim, load the profile,
 * and apply the same rule the server and Firestore rules use.
 */
export async function loadStaffSession(user: FirebaseUser, forceRefresh = false): Promise<SessionResult> {
  const token = await user.getIdTokenResult(forceRefresh);
  const claimRole = token.claims['role'];
  if (claimRole !== 'staff' && claimRole !== 'admin') return { ok: false, reason: 'no_role' };

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return evaluateSession(claimRole, snap.exists() ? mapStaffProfile(snap) : null);
  } catch {
    // Rules refused the profile read: treat as not authorized.
    return { ok: false, reason: 'no_profile' };
  }
}

/** Record a failed attempt (best effort, unauthenticated, server-side rate limited). Never logs credentials. */
function recordLoginFailure(reason: LoginFailureReason): void {
  void callFunction('recordStaffLoginEvent', { outcome: 'failure', reason }).catch(() => undefined);
}

/**
 * Sign in with email/password, then have the server confirm the account is an active staff member
 * or administrator (and write the audit event / lastLoginAt). Any account that fails the check is
 * signed straight back out.
 */
export async function signInStaff(email: string, password: string, remember: boolean): Promise<void> {
  // "Remember me" -> survive browser restarts; otherwise the session ends with the tab.
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

  let user: FirebaseUser;
  try {
    user = (await signInWithEmailAndPassword(auth, email, password)).user;
  } catch (error) {
    const mapped = mapLoginError(error);
    recordLoginFailure(mapped.code === 'rate-limited' ? 'too_many_attempts' : 'invalid_credentials');
    throw mapped;
  }

  try {
    await user.getIdToken(true); // pick up the latest custom claims
    const result = await callFunction<{ outcome: string }, { authorized: boolean }>('recordStaffLoginEvent', { outcome: 'success' });
    if (!result.authorized) throw new AppError('unauthorized', LOGIN_MESSAGES.notAuthorized);
  } catch (error) {
    await firebaseSignOut(auth).catch(() => undefined);
    if (error instanceof AppError && (error.code === 'unavailable' || error.code === 'offline')) {
      throw new AppError(error.code, LOGIN_MESSAGES.network);
    }
    if (error instanceof AppError && error.message === LOGIN_MESSAGES.notAuthorized) throw error;
    // Permission errors from the server mean "not staff"; anything else is a generic failure.
    const mapped = toAppError(error);
    throw mapped.code === 'unauthorized' || mapped.code === 'session-expired'
      ? new AppError('unauthorized', LOGIN_MESSAGES.notAuthorized)
      : new AppError('unknown', LOGIN_MESSAGES.unknown);
  }
}

/** Record the sign-out (best effort), then end the Firebase session. */
export async function signOutStaff(): Promise<void> {
  try {
    await callFunction('recordStaffLogoutEvent', {});
  } catch {
    // An audit failure must never trap someone in a signed-in state.
  }
  await firebaseSignOut(auth);
}

/**
 * Password-reset email for the staff login page. Always resolves the same way for unknown, non-staff
 * and staff addresses so the response cannot be used to discover accounts. Only a genuine
 * connectivity failure is reported.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/network-request-failed') {
      throw new AppError('unavailable', LOGIN_MESSAGES.network);
    }
    // user-not-found, invalid-email, too-many-requests, ...: indistinguishable to the caller.
  }
}

/** Password-setup email for a newly provisioned staff member (errors are reported to the admin). */
export async function sendPasswordSetupEmail(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw toAppError(error);
  }
}

/** Force a token refresh so a newly granted (or revoked) role claim takes effect. */
export async function refreshToken(): Promise<void> {
  await auth.currentUser?.getIdToken(true);
}
