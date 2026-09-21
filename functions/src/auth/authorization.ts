import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../shared/constants';

export interface AdminContext {
  uid: string;
  email: string | null;
}

export type AccessDecision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'no_role' | 'no_profile' | 'inactive' };

interface UserProfile {
  role?: unknown;
  active?: unknown;
}

/**
 * Pure authorization rule. An administrator must hold BOTH:
 *   1. the `role: "admin"` custom claim (set only via the Admin SDK, never by browser code), and
 *   2. an active `users/{uid}` profile with role admin (so access can be revoked immediately,
 *      without waiting for the ID token to expire).
 */
export function evaluateAdminAccess(
  tokenRole: unknown,
  authenticated: boolean,
  profile: UserProfile | undefined,
): AccessDecision {
  if (!authenticated) return { allowed: false, reason: 'unauthenticated' };
  if (tokenRole !== 'admin') return { allowed: false, reason: 'no_role' };
  if (!profile) return { allowed: false, reason: 'no_profile' };
  if (profile.role !== 'admin' || profile.active !== true) return { allowed: false, reason: 'inactive' };
  return { allowed: true };
}

/** Throws unless the caller is an active administrator. Call at the top of every admin function. */
export async function requireAdmin(request: Pick<CallableRequest, 'auth'>, db: Firestore): Promise<AdminContext> {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Please sign in to continue.');
  }

  const snap = await db.collection(COLLECTIONS.users).doc(auth.uid).get();
  const decision = evaluateAdminAccess(auth.token['role'], true, snap.exists ? (snap.data() as UserProfile) : undefined);

  if (!decision.allowed) {
    throw new HttpsError('permission-denied', 'You are not authorized to perform this action.');
  }
  return { uid: auth.uid, email: typeof auth.token.email === 'string' ? auth.token.email : null };
}
