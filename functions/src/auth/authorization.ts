import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, STAFF_ROLES } from '../shared/constants';
import type { StaffRole } from '../shared/types';

export interface StaffContext {
  uid: string;
  email: string | null;
  role: StaffRole;
}

export type AccessDenialReason = 'unauthenticated' | 'no_role' | 'no_profile' | 'inactive' | 'role_mismatch';
export type AccessDecision = { allowed: true; role: StaffRole } | { allowed: false; reason: AccessDenialReason };

interface UserProfile {
  role?: unknown;
  active?: unknown;
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * Pure authorization rule. A staff member or administrator must hold BOTH:
 *   1. a `role` custom claim of "staff" or "admin" (set only via the Admin SDK, never by browsers), and
 *   2. an ACTIVE `users/{uid}` profile whose role matches the claim.
 *
 * The profile check lets access be revoked immediately (active=false) without waiting for the ID
 * token to expire, and makes a role change fail closed: until the user's token refreshes, the stale
 * claim no longer matches the profile, so nothing is allowed.
 */
export function evaluateStaffAccess(tokenRole: unknown, authenticated: boolean, profile: UserProfile | undefined): AccessDecision {
  if (!authenticated) return { allowed: false, reason: 'unauthenticated' };
  if (!isStaffRole(tokenRole)) return { allowed: false, reason: 'no_role' };
  if (!profile) return { allowed: false, reason: 'no_profile' };
  if (profile.active !== true) return { allowed: false, reason: 'inactive' };
  if (profile.role !== tokenRole) return { allowed: false, reason: 'role_mismatch' };
  return { allowed: true, role: tokenRole };
}

/** Throws unless the caller is an active staff member or administrator. */
export async function requireStaff(request: Pick<CallableRequest, 'auth'>, db: Firestore): Promise<StaffContext> {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Please sign in to continue.');
  }

  const snap = await db.collection(COLLECTIONS.users).doc(auth.uid).get();
  const decision = evaluateStaffAccess(auth.token['role'], true, snap.exists ? (snap.data() as UserProfile) : undefined);

  if (!decision.allowed) {
    throw new HttpsError('permission-denied', 'You are not authorized to perform this action.');
  }
  return { uid: auth.uid, email: typeof auth.token.email === 'string' ? auth.token.email : null, role: decision.role };
}

/** Throws unless the caller is an active administrator. Call at the top of every admin-only function. */
export async function requireAdmin(request: Pick<CallableRequest, 'auth'>, db: Firestore): Promise<StaffContext> {
  const staff = await requireStaff(request, db);
  if (staff.role !== 'admin') {
    throw new HttpsError('permission-denied', 'You are not authorized to perform this action.');
  }
  return staff;
}
