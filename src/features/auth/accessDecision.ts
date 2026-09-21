import type { AuthState } from './authContext';

export type RouteAccess = 'wait' | 'allow' | 'login';

/**
 * Pure routing decision for admin pages. Anything that is not a confirmed administrator is
 * sent to the login page; nothing renders until the auth state is known.
 */
export function resolveAdminAccess(state: AuthState): RouteAccess {
  switch (state.status) {
    case 'loading':
      return 'wait';
    case 'admin':
      return 'allow';
    case 'unauthenticated':
    case 'forbidden':
      return 'login';
  }
}
