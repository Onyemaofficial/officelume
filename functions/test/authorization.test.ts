import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { evaluateAdminAccess, requireAdmin } from '../src/auth/authorization';
import { canTransitionEscalation, canTransitionRequest } from '../src/shared/statusRules';

/** Minimal Firestore stand-in: only what requireAdmin touches. */
function fakeDb(profile: Record<string, unknown> | undefined): Firestore {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: profile !== undefined, data: () => profile }),
      }),
    }),
  } as unknown as Firestore;
}

function requestWith(role: unknown, uid = 'u1') {
  return { auth: { uid, token: { role, email: 'admin@example.com' } } } as never;
}

describe('evaluateAdminAccess', () => {
  it('allows only authenticated users with the admin claim and an active admin profile', () => {
    expect(evaluateAdminAccess('admin', true, { role: 'admin', active: true })).toEqual({ allowed: true });
  });

  it('denies unauthenticated callers', () => {
    expect(evaluateAdminAccess(undefined, false, undefined)).toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  it('denies signed-in users without the admin claim (customers, other roles)', () => {
    expect(evaluateAdminAccess(undefined, true, { role: 'admin', active: true })).toMatchObject({ allowed: false, reason: 'no_role' });
    expect(evaluateAdminAccess('customer', true, { role: 'admin', active: true })).toMatchObject({ allowed: false });
  });

  it('denies admins whose profile is missing or deactivated (immediate revocation)', () => {
    expect(evaluateAdminAccess('admin', true, undefined)).toMatchObject({ allowed: false, reason: 'no_profile' });
    expect(evaluateAdminAccess('admin', true, { role: 'admin', active: false })).toMatchObject({ allowed: false, reason: 'inactive' });
    expect(evaluateAdminAccess('admin', true, { role: 'staff', active: true })).toMatchObject({ allowed: false });
  });

  it('does not treat truthy-but-not-true active flags as active', () => {
    expect(evaluateAdminAccess('admin', true, { role: 'admin', active: 'yes' })).toMatchObject({ allowed: false });
  });
});

describe('requireAdmin', () => {
  it('rejects unauthenticated requests with `unauthenticated`', async () => {
    await expect(requireAdmin({ auth: undefined }, fakeDb(undefined))).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects a signed-in non-admin with `permission-denied`', async () => {
    const error = await requireAdmin(requestWith(undefined), fakeDb({ role: 'admin', active: true })).catch((e) => e);
    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe('permission-denied');
  });

  it('rejects a deactivated admin even with a valid claim', async () => {
    await expect(requireAdmin(requestWith('admin'), fakeDb({ role: 'admin', active: false }))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('returns the admin context for an active admin', async () => {
    await expect(requireAdmin(requestWith('admin', 'abc'), fakeDb({ role: 'admin', active: true }))).resolves.toEqual({
      uid: 'abc',
      email: 'admin@example.com',
    });
  });
});

describe('status transitions', () => {
  it('permits sensible request workflow moves', () => {
    expect(canTransitionRequest('new', 'reviewing')).toBe(true);
    expect(canTransitionRequest('scheduled', 'completed')).toBe(true);
  });

  it('blocks skipping straight to completed and changing terminal states', () => {
    expect(canTransitionRequest('new', 'completed')).toBe(false);
    expect(canTransitionRequest('completed', 'scheduled')).toBe(false);
    expect(canTransitionRequest('cancelled', 'reviewing')).toBe(true);
  });

  it('applies the same discipline to escalations', () => {
    expect(canTransitionEscalation('new', 'resolved')).toBe(true);
    expect(canTransitionEscalation('resolved', 'contacted')).toBe(false);
    expect(canTransitionEscalation('resolved', 'reviewing')).toBe(true);
  });
});
