import type { SessionResult, StaffProfile, StaffRole } from './auth.types';

export function isStaffRole(value: unknown): value is StaffRole {
  return value === 'staff' || value === 'admin';
}

/**
 * Pure rule for accepting a session (mirrors the server and Firestore rules):
 * a `role` claim of staff/admin, an existing ACTIVE profile, and a profile role that matches the
 * claim. Anything else - including a stale claim after a role change - is refused.
 */
export function evaluateSession(claimRole: unknown, profile: StaffProfile | null): SessionResult {
  if (!isStaffRole(claimRole)) return { ok: false, reason: 'no_role' };
  if (!profile) return { ok: false, reason: 'no_profile' };
  if (!profile.active) return { ok: false, reason: 'inactive' };
  if (profile.role !== claimRole) return { ok: false, reason: 'role_mismatch' };
  return { ok: true, session: { role: claimRole, profile } };
}

/** Does this role satisfy a route/permission that allows the given roles? */
export function roleAllowed(role: StaffRole | null, allowed: readonly StaffRole[]): boolean {
  return role !== null && allowed.includes(role);
}
