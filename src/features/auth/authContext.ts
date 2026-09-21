import { createContext } from 'react';
import type { AdminIdentity } from '../../services/authService';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated'; sessionExpired: boolean }
  | { status: 'forbidden'; identity: AdminIdentity }
  | { status: 'admin'; identity: AdminIdentity };

export interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
