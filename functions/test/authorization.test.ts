import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { evaluateStaffAccess, requireAdmin, requireStaff } from '../src/auth/authorization';
import { validateActiveChange, validateRoleChange } from '../src/auth/staffRules';
import { canTransitionEscalation, canTransitionRequest } from '../src/shared/statusRules';
import { createStaffSchema, setStaffActiveSchema, updateStaffRoleSchema } from '../src/shared/validation';

/** Minimal Firestore stand-in: only what requireStaff/requireAdmin touch. */
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
  return { auth: { uid, token: { role, email: 'person@example.com' } } } as never;
}

describe('evaluateStaffAccess', () => {
  it('allows staff and admins that hold a matching claim and an active profile', () => {
    expect(evaluateStaffAccess('admin', true, { role: 'admin', active: true })).toEqual({ allowed: true, role: 'admin' });
    expect(evaluateStaffAccess('staff', true, { role: 'staff', active: true })).toEqual({ allowed: true, role: 'staff' });
  });

  it('denies unauthenticated callers', () => {
    expect(evaluateStaffAccess(undefined, false, undefined)).toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  it('denies signed-in users without a staff/admin claim (customers, unknown roles)', () => {
    expect(evaluateStaffAccess(undefined, true, { role: 'admin', active: true })).toMatchObject({ allowed: false, reason: 'no_role' });
    expect(evaluateStaffAccess('customer', true, { role: 'admin', active: true })).toMatchObject({ allowed: false, reason: 'no_role' });
    expect(evaluateStaffAccess('superuser', true, { role: 'admin', active: true })).toMatchObject({ allowed: false });
  });

  it('denies accounts whose profile is missing or deactivated (immediate revocation)', () => {
    expect(evaluateStaffAccess('admin', true, undefined)).toMatchObject({ allowed: false, reason: 'no_profile' });
    expect(evaluateStaffAccess('staff', true, { role: 'staff', active: false })).toMatchObject({ allowed: false, reason: 'inactive' });
  });

  it('fails closed when the claim and the profile disagree (stale token after a role change)', () => {
    expect(evaluateStaffAccess('admin', true, { role: 'staff', active: true })).toMatchObject({ allowed: false, reason: 'role_mismatch' });
    expect(evaluateStaffAccess('staff', true, { role: 'admin', active: true })).toMatchObject({ allowed: false, reason: 'role_mismatch' });
  });

  it('does not treat truthy-but-not-true active flags as active', () => {
    expect(evaluateStaffAccess('admin', true, { role: 'admin', active: 'yes' })).toMatchObject({ allowed: false });
  });
});

describe('requireStaff / requireAdmin', () => {
  it('rejects unauthenticated requests with `unauthenticated`', async () => {
    await expect(requireStaff({ auth: undefined }, fakeDb(undefined))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(requireAdmin({ auth: undefined }, fakeDb(undefined))).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects a signed-in non-staff user with `permission-denied`', async () => {
    const error = await requireStaff(requestWith(undefined), fakeDb({ role: 'admin', active: true })).catch((e) => e);
    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe('permission-denied');
  });

  it('rejects a deactivated staff member even with a valid claim', async () => {
    await expect(requireStaff(requestWith('staff'), fakeDb({ role: 'staff', active: false }))).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('lets an active staff member through requireStaff but NOT requireAdmin', async () => {
    const db = fakeDb({ role: 'staff', active: true });
    await expect(requireStaff(requestWith('staff', 'abc'), db)).resolves.toEqual({ uid: 'abc', email: 'person@example.com', role: 'staff' });
    await expect(requireAdmin(requestWith('staff', 'abc'), db)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('lets an active administrator through both', async () => {
    const db = fakeDb({ role: 'admin', active: true });
    await expect(requireStaff(requestWith('admin', 'abc'), db)).resolves.toMatchObject({ role: 'admin' });
    await expect(requireAdmin(requestWith('admin', 'abc'), db)).resolves.toMatchObject({ role: 'admin', uid: 'abc' });
  });

  it('a staff claim cannot be upgraded by a profile that says admin', async () => {
    await expect(requireAdmin(requestWith('staff'), fakeDb({ role: 'admin', active: true }))).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('staff account rules (self-service, last admin)', () => {
  const target = (role: 'staff' | 'admin', active = true) => ({ role, active });

  it('blocks changing your own role or status', () => {
    const ctx = { actorUid: 'a', targetUid: 'a', target: target('admin'), activeAdminCount: 3 };
    expect(validateRoleChange(ctx, 'staff')).toMatchObject({ ok: false });
    expect(validateActiveChange(ctx, false)).toMatchObject({ ok: false });
  });

  it('blocks removing or deactivating the last active administrator', () => {
    const ctx = { actorUid: 'a', targetUid: 'b', target: target('admin'), activeAdminCount: 1 };
    expect(validateRoleChange(ctx, 'staff')).toEqual({ ok: false, message: 'At least one active administrator must remain.' });
    expect(validateActiveChange(ctx, false)).toEqual({ ok: false, message: 'At least one active administrator must remain.' });
  });

  it('allows the same changes when another administrator remains', () => {
    const ctx = { actorUid: 'a', targetUid: 'b', target: target('admin'), activeAdminCount: 2 };
    expect(validateRoleChange(ctx, 'staff')).toEqual({ ok: true });
    expect(validateActiveChange(ctx, false)).toEqual({ ok: true });
  });

  it('allows promoting staff and reactivating accounts', () => {
    expect(validateRoleChange({ actorUid: 'a', targetUid: 'b', target: target('staff'), activeAdminCount: 1 }, 'admin')).toEqual({ ok: true });
    expect(validateActiveChange({ actorUid: 'a', targetUid: 'b', target: target('staff', false), activeAdminCount: 1 }, true)).toEqual({ ok: true });
  });

  it('rejects no-op changes', () => {
    expect(validateRoleChange({ actorUid: 'a', targetUid: 'b', target: target('staff'), activeAdminCount: 2 }, 'staff')).toMatchObject({ ok: false });
    expect(validateActiveChange({ actorUid: 'a', targetUid: 'b', target: target('staff'), activeAdminCount: 2 }, true)).toMatchObject({ ok: false });
  });
});

describe('staff management input validation', () => {
  it('validates a new staff member and normalises the email', () => {
    const result = createStaffSchema.safeParse({ displayName: '  Pat Lee ', email: ' Pat.Lee@Example.COM ', role: 'staff' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ displayName: 'Pat Lee', email: 'pat.lee@example.com', role: 'staff' });
  });

  it('rejects unknown roles, bad emails, and markup in names', () => {
    expect(createStaffSchema.safeParse({ displayName: 'Pat', email: 'pat@example.com', role: 'owner' }).success).toBe(false);
    expect(createStaffSchema.safeParse({ displayName: 'Pat', email: 'nope', role: 'staff' }).success).toBe(false);
    expect(createStaffSchema.safeParse({ displayName: '<b>Pat</b>', email: 'pat@example.com', role: 'staff' }).success).toBe(false);
  });

  it('rejects role/active updates with path-like ids or wrong types', () => {
    expect(updateStaffRoleSchema.safeParse({ uid: 'a/b', role: 'admin' }).success).toBe(false);
    expect(updateStaffRoleSchema.safeParse({ uid: 'abc123', role: 'root' }).success).toBe(false);
    expect(setStaffActiveSchema.safeParse({ uid: 'abc123', active: 'no' }).success).toBe(false);
    expect(setStaffActiveSchema.safeParse({ uid: 'abc123', active: false }).success).toBe(true);
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
