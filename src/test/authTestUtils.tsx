import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { StaffProfile, StaffRole } from '../features/auth/auth.types';
import { AuthContext, type AuthContextValue } from '../features/auth/authContext';

export function makeProfile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    uid: 'u1',
    displayName: 'Pat Lee',
    email: 'pat@example.com',
    role: 'staff',
    active: true,
    createdAt: new Date('2026-01-05T10:00:00Z'),
    updatedAt: new Date('2026-01-05T10:00:00Z'),
    lastLoginAt: null,
    ...overrides,
  };
}

/** A complete AuthContext value for tests. `role: null` means signed out. */
export function makeAuth(role: StaffRole | null, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const signedIn = role !== null;
  const profile = signedIn ? makeProfile({ role, displayName: role === 'admin' ? 'Alex Admin' : 'Pat Lee', email: role === 'admin' ? 'alex@example.com' : 'pat@example.com' }) : null;
  return {
    status: signedIn ? 'authenticated' : 'unauthenticated',
    user: profile ? { uid: profile.uid, email: profile.email, displayName: profile.displayName } : null,
    profile,
    role,
    loading: false,
    authenticated: signedIn,
    isAdmin: role === 'admin',
    isStaff: signedIn,
    sessionExpired: false,
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
    hasRole: (...roles: StaffRole[]) => role !== null && roles.includes(role),
    ...overrides,
  };
}

export function AuthTestProvider({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
