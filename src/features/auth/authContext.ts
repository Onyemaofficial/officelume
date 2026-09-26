import { createContext } from 'react';
import type { AuthIdentity, AuthState, AuthStatus, StaffProfile, StaffRole } from './auth.types';

export interface AuthContextValue {
  status: AuthStatus;
  /** Firebase identity of the signed-in account (null when signed out). */
  user: AuthIdentity | null;
  /** Verified staff profile (only set for an authorized session). */
  profile: StaffProfile | null;
  role: StaffRole | null;
  /** True while Firebase is still working out whether someone is signed in. */
  loading: boolean;
  /** A verified, active staff member or administrator is signed in. */
  authenticated: boolean;
  isAdmin: boolean;
  /** Has at least staff-level access (staff OR admin) - administrators can do everything staff can. */
  isStaff: boolean;
  /** True when a session ended without the user asking to sign out. */
  sessionExpired: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Force-refresh the token and reload the profile (e.g. after a role change). */
  refreshUser: () => Promise<void>;
  hasRole: (...roles: StaffRole[]) => boolean;
}

export type { AuthState };

export const AuthContext = createContext<AuthContextValue | null>(null);
