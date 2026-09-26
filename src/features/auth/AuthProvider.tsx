import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  currentUser,
  loadStaffSession,
  refreshToken,
  requestPasswordReset,
  signInStaff,
  signOutStaff,
  subscribeToAuth,
  toIdentity,
} from '../../services/authService';
import { LOADING_STATE, type AuthState, type StaffRole } from './auth.types';
import { AuthContext, type AuthContextValue } from './authContext';
import { roleAllowed } from './session';

/**
 * Tracks Firebase sign-in state and resolves it into a verified staff session (role claim + active,
 * matching profile). This drives the UI only - Firestore rules and Cloud Functions independently
 * enforce authorization.
 *
 * Nothing is decided until Firebase has finished restoring the persisted session, so a page refresh
 * never bounces a signed-in user to the login page.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(LOADING_STATE);
  const manualSignOut = useRef(false);
  const generation = useRef(0); // ignores results from superseded lookups

  const applyUser = useCallback(async (user: FirebaseUser | null, forceRefresh = false) => {
    const mine = ++generation.current;

    if (!user) {
      // Read and reset the flag NOW: React runs the updater below later, after this function returns.
      const signedOutOnPurpose = manualSignOut.current;
      manualSignOut.current = false;
      setState((previous) => ({
        status: 'unauthenticated',
        user: null,
        profile: null,
        role: null,
        // Signed out without asking to (token expired/revoked, account disabled) -> tell the user why.
        sessionExpired: previous.status === 'authenticated' && !signedOutOnPurpose,
      }));
      return;
    }

    let result;
    try {
      result = await loadStaffSession(user, forceRefresh);
    } catch {
      result = { ok: false as const, reason: 'no_profile' as const };
    }
    if (mine !== generation.current) return;

    const identity = toIdentity(user);
    setState(
      result.ok
        ? { status: 'authenticated', user: identity, profile: result.session.profile, role: result.session.role, sessionExpired: false }
        : { status: 'forbidden', user: identity, profile: null, role: null, sessionExpired: false },
    );
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      void applyUser(user);
    });
    return unsubscribe;
  }, [applyUser]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      await signInStaff(email, password, remember);
      // Load the verified session before the caller navigates, so the guard never sees a stale state.
      await applyUser(currentUser(), true);
    },
    [applyUser],
  );

  const logout = useCallback(async () => {
    manualSignOut.current = true;
    await signOutStaff();
  }, []);

  const refreshUser = useCallback(async () => {
    await refreshToken();
    await applyUser(currentUser(), true);
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(() => {
    const authenticated = state.status === 'authenticated';
    return {
      status: state.status,
      user: state.user,
      profile: state.profile,
      role: state.role,
      loading: state.status === 'loading',
      authenticated,
      isAdmin: authenticated && state.role === 'admin',
      isStaff: authenticated && (state.role === 'staff' || state.role === 'admin'),
      sessionExpired: state.sessionExpired,
      login,
      logout,
      resetPassword: requestPasswordReset,
      refreshUser,
      hasRole: (...roles: StaffRole[]) => authenticated && roleAllowed(state.role, roles),
    };
  }, [state, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
