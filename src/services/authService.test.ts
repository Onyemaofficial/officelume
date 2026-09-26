import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_MESSAGES } from '../features/auth/loginErrors';
import { AppError } from '../utils/errors';

const signInWithEmailAndPassword = vi.fn();
const firebaseSignOut = vi.fn();
const sendPasswordResetEmail = vi.fn();
const setPersistence = vi.fn();
const getDoc = vi.fn();
const callFunction = vi.fn();
const getIdToken = vi.fn();
const getIdTokenResult = vi.fn();

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: { type: 'LOCAL' },
  browserSessionPersistence: { type: 'SESSION' },
  onIdTokenChanged: vi.fn(),
  sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a),
  setPersistence: (...a: unknown[]) => setPersistence(...a),
  signInWithEmailAndPassword: (...a: unknown[]) => signInWithEmailAndPassword(...a),
  signOut: (...a: unknown[]) => firebaseSignOut(...a),
}));
vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => ({ path: a.slice(1).join('/') }),
  getDoc: (...a: unknown[]) => getDoc(...a),
}));
vi.mock('../firebase/config', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('./callables', () => ({ callFunction: (...a: unknown[]) => callFunction(...a) }));

const service = await import('./authService');

const fakeUser = () => ({ uid: 'u1', email: 'pat@example.com', displayName: 'Pat', getIdToken, getIdTokenResult });

beforeEach(() => {
  for (const fn of [signInWithEmailAndPassword, firebaseSignOut, sendPasswordResetEmail, setPersistence, getDoc, callFunction, getIdToken, getIdTokenResult]) {
    fn.mockReset();
  }
  setPersistence.mockResolvedValue(undefined);
  firebaseSignOut.mockResolvedValue(undefined);
  getIdToken.mockResolvedValue('token');
  signInWithEmailAndPassword.mockResolvedValue({ user: fakeUser() });
  callFunction.mockResolvedValue({ authorized: true });
});

describe('signInStaff', () => {
  it('uses LOCAL persistence when "Remember me" is checked and SESSION persistence otherwise', async () => {
    await service.signInStaff('pat@example.com', 'pw', true);
    expect(setPersistence.mock.calls[0]?.[1]).toEqual({ type: 'LOCAL' });
    await service.signInStaff('pat@example.com', 'pw', false);
    expect(setPersistence.mock.calls[1]?.[1]).toEqual({ type: 'SESSION' });
  });

  it('on success: refreshes the token, has the server verify + audit the login, and does not sign out', async () => {
    await service.signInStaff('pat@example.com', 'pw', false);
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(callFunction).toHaveBeenCalledWith('recordStaffLoginEvent', { outcome: 'success' });
    expect(firebaseSignOut).not.toHaveBeenCalled();
  });

  it('wrong password: friendly message, failure is recorded WITHOUT credentials, no server verification', async () => {
    signInWithEmailAndPassword.mockRejectedValue(new FirebaseError('auth/invalid-credential', 'raw'));
    callFunction.mockResolvedValue({ authorized: false });
    await expect(service.signInStaff('pat@example.com', 'wrong-password-123', false)).rejects.toMatchObject({ message: 'Email or password is incorrect.' });

    const failureCall = callFunction.mock.calls.find((c) => (c[1] as { outcome: string }).outcome === 'failure');
    expect(failureCall).toBeTruthy();
    expect(JSON.stringify(callFunction.mock.calls)).not.toContain('wrong-password-123');
    expect(JSON.stringify(callFunction.mock.calls)).not.toContain('pat@example.com');
    expect(callFunction.mock.calls.some((c) => (c[1] as { outcome: string }).outcome === 'success')).toBe(false);
  });

  it('an unauthorized Firebase account (valid credentials, not staff) is signed straight back out', async () => {
    callFunction.mockResolvedValue({ authorized: false });
    await expect(service.signInStaff('customer@example.com', 'pw', false)).rejects.toMatchObject({ message: LOGIN_MESSAGES.notAuthorized });
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('an inactive account (server refuses with permission-denied) is signed out with the not-authorized message', async () => {
    callFunction.mockRejectedValue(new AppError('unauthorized', 'You are not authorized to do that.'));
    await expect(service.signInStaff('old@example.com', 'pw', false)).rejects.toMatchObject({ message: LOGIN_MESSAGES.notAuthorized });
    expect(firebaseSignOut).toHaveBeenCalled();
  });

  it('a disabled Firebase account reports the inactive message', async () => {
    signInWithEmailAndPassword.mockRejectedValue(new FirebaseError('auth/user-disabled', 'raw'));
    await expect(service.signInStaff('old@example.com', 'pw', false)).rejects.toMatchObject({ message: LOGIN_MESSAGES.inactive });
  });

  it('a connectivity failure during verification signs out and reports the network message', async () => {
    callFunction.mockRejectedValue(new AppError('unavailable', 'x'));
    await expect(service.signInStaff('pat@example.com', 'pw', false)).rejects.toMatchObject({ message: LOGIN_MESSAGES.network });
    expect(firebaseSignOut).toHaveBeenCalled();
  });

  it('too many attempts is reported as such', async () => {
    signInWithEmailAndPassword.mockRejectedValue(new FirebaseError('auth/too-many-requests', 'raw'));
    await expect(service.signInStaff('pat@example.com', 'pw', false)).rejects.toMatchObject({ message: LOGIN_MESSAGES.tooManyAttempts });
  });
});

describe('signOutStaff', () => {
  it('records the logout and then signs out', async () => {
    callFunction.mockResolvedValue({ recorded: true });
    await service.signOutStaff();
    expect(callFunction).toHaveBeenCalledWith('recordStaffLogoutEvent', {});
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('still signs out when the audit call fails', async () => {
    callFunction.mockRejectedValue(new Error('offline'));
    await service.signOutStaff();
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('requestPasswordReset', () => {
  it('sends the reset email', async () => {
    sendPasswordResetEmail.mockResolvedValue(undefined);
    await expect(service.requestPasswordReset('pat@example.com')).resolves.toBeUndefined();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'pat@example.com');
  });

  it('resolves identically for unknown, invalid, or throttled addresses (no account discovery)', async () => {
    for (const code of ['auth/user-not-found', 'auth/invalid-email', 'auth/too-many-requests', 'auth/internal-error']) {
      sendPasswordResetEmail.mockRejectedValueOnce(new FirebaseError(code, 'raw'));
      await expect(service.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
    }
  });

  it('reports only a genuine network failure', async () => {
    sendPasswordResetEmail.mockRejectedValueOnce(new FirebaseError('auth/network-request-failed', 'raw'));
    await expect(service.requestPasswordReset('a@example.com')).rejects.toMatchObject({ message: LOGIN_MESSAGES.network });
  });
});

describe('loadStaffSession (session restoration)', () => {
  const profileSnap = (data: Record<string, unknown>) => ({ exists: () => true, id: 'u1', data: () => data });

  it('accepts a staff claim backed by an active matching profile', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { role: 'staff' } });
    getDoc.mockResolvedValue(profileSnap({ displayName: 'Pat', email: 'pat@example.com', role: 'staff', active: true }));
    const result = await service.loadStaffSession(fakeUser() as never);
    expect(result).toMatchObject({ ok: true, session: { role: 'staff' } });
  });

  it('refuses an account with no role claim without even reading the profile', async () => {
    getIdTokenResult.mockResolvedValue({ claims: {} });
    expect(await service.loadStaffSession(fakeUser() as never)).toEqual({ ok: false, reason: 'no_role' });
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('refuses an inactive profile and a role mismatch', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { role: 'admin' } });
    getDoc.mockResolvedValueOnce(profileSnap({ role: 'admin', active: false }));
    expect(await service.loadStaffSession(fakeUser() as never)).toEqual({ ok: false, reason: 'inactive' });
    getDoc.mockResolvedValueOnce(profileSnap({ role: 'staff', active: true }));
    expect(await service.loadStaffSession(fakeUser() as never)).toEqual({ ok: false, reason: 'role_mismatch' });
  });

  it('fails closed when the profile cannot be read', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { role: 'staff' } });
    getDoc.mockRejectedValue(new FirebaseError('permission-denied', 'Missing or insufficient permissions.'));
    expect(await service.loadStaffSession(fakeUser() as never)).toEqual({ ok: false, reason: 'no_profile' });
  });
});
