import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readIsAdmin, signInAdmin, signOutAdmin, subscribeToAuth, toIdentity } from '../../services/authService';
import { AuthContext, type AuthContextValue, type AuthState } from './authContext';

/**
 * Tracks Firebase sign-in state and whether the signed-in account carries the admin claim.
 * This drives the UI only - Firestore rules and Cloud Functions independently enforce authorization.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const manualSignOut = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeToAuth((user) => {
      if (!user) {
        // Signed out without asking to (e.g. token expired or revoked) -> tell the user why.
        setState((previous) => ({
          status: 'unauthenticated',
          sessionExpired: previous.status === 'admin' && !manualSignOut.current,
        }));
        manualSignOut.current = false;
        return;
      }
      void readIsAdmin(user)
        .catch(() => false)
        .then((isAdmin) => {
          if (cancelled) return;
          const identity = toIdentity(user);
          setState(isAdmin ? { status: 'admin', identity } : { status: 'forbidden', identity });
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback((email: string, password: string) => signInAdmin(email, password), []);
  const signOut = useCallback(async () => {
    manualSignOut.current = true;
    await signOutAdmin();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
