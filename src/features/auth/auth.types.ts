import type { StaffRole } from '../../types';

export type { StaffRole };

/**
 * Non-sensitive staff profile metadata from `users/{uid}`. Passwords and tokens are never stored
 * here - Firebase Authentication owns credentials.
 */
export interface StaffProfile {
  uid: string;
  displayName: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastLoginAt: Date | null;
}

export interface AuthIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/** A verified staff session: a valid role claim backed by an active, matching profile. */
export interface StaffSession {
  role: StaffRole;
  profile: StaffProfile;
}

export type SessionDenialReason = 'no_role' | 'no_profile' | 'inactive' | 'role_mismatch';
export type SessionResult = { ok: true; session: StaffSession } | { ok: false; reason: SessionDenialReason };

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'forbidden';

export interface AuthState {
  status: AuthStatus;
  user: AuthIdentity | null;
  profile: StaffProfile | null;
  role: StaffRole | null;
  /** True when a signed-in session ended without the user asking to sign out. */
  sessionExpired: boolean;
}

export const LOADING_STATE: AuthState = { status: 'loading', user: null, profile: null, role: null, sessionExpired: false };
