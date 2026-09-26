import type { User as FirebaseUser } from 'firebase/auth';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authService from '../../services/authService';
import { makeProfile } from '../../test/authTestUtils';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

vi.mock('../../services/authService', () => ({
  subscribeToAuth: vi.fn(),
  loadStaffSession: vi.fn(),
  signInStaff: vi.fn(),
  signOutStaff: vi.fn(),
  requestPasswordReset: vi.fn(),
  refreshToken: vi.fn(),
  currentUser: vi.fn(),
  toIdentity: (u: { uid: string; email: string | null; displayName?: string | null }) => ({
    uid: u.uid,
    email: u.email,
    displayName: u.displayName ?? null,
  }),
}));

const mocked = vi.mocked(authService);
const firebaseUser = { uid: 'u1', email: 'pat@example.com', displayName: 'Pat Lee' } as unknown as FirebaseUser;
let emitAuth: (user: FirebaseUser | null) => void = () => undefined;

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="state">
        {[auth.status, auth.role ?? 'norole', `admin:${auth.isAdmin}`, `staff:${auth.isStaff}`, `loading:${auth.loading}`, `expired:${auth.sessionExpired}`].join('|')}
      </p>
      <p data-testid="name">{auth.profile?.displayName ?? '-'}</p>
      <p data-testid="has-admin">{String(auth.hasRole('admin'))}</p>
      <button onClick={() => void auth.login('pat@example.com', 'pw', true).catch(() => undefined)}>login</button>
      <button onClick={() => void auth.logout()}>logout</button>
      <button onClick={() => void auth.resetPassword('pat@example.com')}>reset</button>
      <button onClick={() => void auth.refreshUser()}>refresh</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const state = () => screen.getByTestId('state').textContent;

beforeEach(() => {
  vi.resetAllMocks();
  mocked.subscribeToAuth.mockImplementation((callback) => {
    emitAuth = callback;
    return () => undefined;
  });
  mocked.currentUser.mockReturnValue(firebaseUser);
  mocked.signInStaff.mockResolvedValue(undefined);
  mocked.signOutStaff.mockResolvedValue(undefined);
  mocked.requestPasswordReset.mockResolvedValue(undefined);
  mocked.refreshToken.mockResolvedValue(undefined);
});

describe('AuthProvider', () => {
  it('stays in a loading state until Firebase reports (no premature redirect on refresh)', () => {
    renderProvider();
    expect(state()).toContain('loading|');
    expect(state()).toContain('loading:true');
  });

  it('restores a valid staff session after a page refresh', async () => {
    mocked.loadStaffSession.mockResolvedValue({ ok: true, session: { role: 'staff', profile: makeProfile({ role: 'staff' }) } });
    renderProvider();
    act(() => emitAuth(firebaseUser));

    await waitFor(() => expect(state()).toContain('authenticated|staff|admin:false|staff:true'));
    expect(screen.getByTestId('name').textContent).toBe('Pat Lee');
    expect(screen.getByTestId('has-admin').textContent).toBe('false');
  });

  it('restores an administrator session with admin permissions', async () => {
    mocked.loadStaffSession.mockResolvedValue({ ok: true, session: { role: 'admin', profile: makeProfile({ role: 'admin', displayName: 'Alex Admin' }) } });
    renderProvider();
    act(() => emitAuth(firebaseUser));

    await waitFor(() => expect(state()).toContain('authenticated|admin|admin:true|staff:true'));
    expect(screen.getByTestId('has-admin').textContent).toBe('true');
  });

  it.each(['no_role', 'no_profile', 'inactive', 'role_mismatch'] as const)('treats a %s account as NOT authorized', async (reason) => {
    mocked.loadStaffSession.mockResolvedValue({ ok: false, reason });
    renderProvider();
    act(() => emitAuth(firebaseUser));

    await waitFor(() => expect(state()).toContain('forbidden|norole|admin:false|staff:false'));
    expect(screen.getByTestId('name').textContent).toBe('-');
  });

  it('is signed out when there is no Firebase user', async () => {
    renderProvider();
    act(() => emitAuth(null));
    await waitFor(() => expect(state()).toContain('unauthenticated|norole'));
    expect(state()).toContain('expired:false');
  });

  it('flags an expired session when the user disappears without signing out', async () => {
    mocked.loadStaffSession.mockResolvedValue({ ok: true, session: { role: 'staff', profile: makeProfile() } });
    renderProvider();
    act(() => emitAuth(firebaseUser));
    await waitFor(() => expect(state()).toContain('authenticated|staff'));

    act(() => emitAuth(null)); // token expired / revoked / account disabled
    await waitFor(() => expect(state()).toContain('unauthenticated|norole'));
    expect(state()).toContain('expired:true');
  });

  it('logout signs out, audits it, and is not reported as an expired session', async () => {
    mocked.loadStaffSession.mockResolvedValue({ ok: true, session: { role: 'staff', profile: makeProfile() } });
    renderProvider();
    act(() => emitAuth(firebaseUser));
    await waitFor(() => expect(state()).toContain('authenticated|staff'));

    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(mocked.signOutStaff).toHaveBeenCalledTimes(1));
    act(() => emitAuth(null));
    await waitFor(() => expect(state()).toContain('unauthenticated|norole'));
    expect(state()).toContain('expired:false');
  });

  it('login signs in (with the remember flag) and loads the verified session before returning', async () => {
    mocked.loadStaffSession.mockResolvedValue({ ok: true, session: { role: 'admin', profile: makeProfile({ role: 'admin' }) } });
    renderProvider();
    act(() => emitAuth(null));
    await waitFor(() => expect(state()).toContain('unauthenticated'));

    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(state()).toContain('authenticated|admin'));
    expect(mocked.signInStaff).toHaveBeenCalledWith('pat@example.com', 'pw', true);
    expect(mocked.loadStaffSession).toHaveBeenLastCalledWith(firebaseUser, true);
  });

  it('login leaves the user signed out when the server rejects the account', async () => {
    mocked.signInStaff.mockRejectedValue(new Error('not authorized'));
    renderProvider();
    act(() => emitAuth(null));
    await waitFor(() => expect(state()).toContain('unauthenticated'));

    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(mocked.signInStaff).toHaveBeenCalled());
    expect(state()).toContain('unauthenticated');
    expect(mocked.loadStaffSession).not.toHaveBeenCalled();
  });

  it('refreshUser force-refreshes the token and reloads the profile (e.g. after a role change)', async () => {
    mocked.loadStaffSession.mockResolvedValueOnce({ ok: true, session: { role: 'staff', profile: makeProfile({ role: 'staff' }) } });
    renderProvider();
    act(() => emitAuth(firebaseUser));
    await waitFor(() => expect(state()).toContain('authenticated|staff'));

    mocked.loadStaffSession.mockResolvedValueOnce({ ok: true, session: { role: 'admin', profile: makeProfile({ role: 'admin' }) } });
    fireEvent.click(screen.getByText('refresh'));
    await waitFor(() => expect(state()).toContain('authenticated|admin'));
    expect(mocked.refreshToken).toHaveBeenCalled();
  });

  it('delegates password reset to the service', async () => {
    renderProvider();
    act(() => emitAuth(null));
    fireEvent.click(screen.getByText('reset'));
    await waitFor(() => expect(mocked.requestPasswordReset).toHaveBeenCalledWith('pat@example.com'));
  });

  it('treats a failing profile lookup as not authorized (fails closed)', async () => {
    mocked.loadStaffSession.mockRejectedValue(new Error('network'));
    renderProvider();
    act(() => emitAuth(firebaseUser));
    await waitFor(() => expect(state()).toContain('forbidden|norole'));
  });
});
