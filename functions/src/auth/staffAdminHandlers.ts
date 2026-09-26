import { randomBytes } from 'node:crypto';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import type { Auth } from 'firebase-admin/auth';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { writeAuditLogInTransaction } from '../audit/audit';
import { COLLECTIONS } from '../shared/constants';
import { parseInput } from '../shared/errors';
import type { StaffRole } from '../shared/types';
import { createStaffSchema, setStaffActiveSchema, updateStaffRoleSchema } from '../shared/validation';
import { isStaffRole, requireAdmin, type StaffContext } from './authorization';
import { validateActiveChange, validateRoleChange } from './staffRules';

type AdminRequest = Pick<CallableRequest<unknown>, 'data' | 'auth' | 'rawRequest'>;

interface StoredProfile {
  role?: unknown;
  active?: unknown;
  email?: unknown;
}

function requireProfileState(data: StoredProfile | undefined): { role: StaffRole; active: boolean } {
  if (!data || !isStaffRole(data.role)) throw new HttpsError('not-found', 'Staff member not found.');
  return { role: data.role, active: data.active === true };
}

const actorFields = (admin: StaffContext) => ({
  actorType: 'staff' as const,
  actorUid: admin.uid,
  actorEmail: admin.email,
  actorRole: admin.role,
});

/**
 * Provision a staff member. The account is created with a random, never-disclosed password; the
 * caller (admin browser) then triggers Firebase's own password-setup email so the employee chooses
 * their own password. Passwords are never returned, logged, or stored in Firestore.
 */
export async function createStaffUser(db: Firestore, auth: Auth, request: AdminRequest): Promise<{ uid: string }> {
  const admin = await requireAdmin(request, db);
  const input = parseInput(createStaffSchema, request.data);

  try {
    await auth.getUserByEmail(input.email);
    throw new HttpsError('already-exists', 'An account with that email address already exists.');
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }

  const created = await auth.createUser({
    email: input.email,
    displayName: input.displayName,
    password: randomBytes(32).toString('base64url'),
    emailVerified: false,
    disabled: false,
  });

  try {
    await auth.setCustomUserClaims(created.uid, { role: input.role });
    const ref = db.collection(COLLECTIONS.users).doc(created.uid);
    await db.runTransaction(async (tx) => {
      tx.create(ref, {
        uid: created.uid,
        displayName: input.displayName,
        email: input.email,
        role: input.role,
        active: true,
        createdBy: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeAuditLogInTransaction(db, tx, {
        eventType: 'STAFF_CREATED',
        ...actorFields(admin),
        targetType: 'staff',
        targetId: created.uid,
        action: 'create',
        metadata: { role: input.role },
      });
    });
  } catch (error) {
    // Do not leave a half-provisioned login behind.
    await auth.deleteUser(created.uid).catch((cleanupError: unknown) => {
      logger.error('Failed to roll back staff user', { message: cleanupError instanceof Error ? cleanupError.message : 'unknown' });
    });
    throw error;
  }

  return { uid: created.uid };
}

async function countActiveAdmins(db: Firestore, tx: Transaction): Promise<number> {
  const snap = await tx.get(db.collection(COLLECTIONS.users).where('role', '==', 'admin').where('active', '==', true));
  return snap.size;
}

/** Change a staff member's role. Blocks self-changes and removal of the last administrator. */
export async function updateStaffRole(db: Firestore, auth: Auth, request: AdminRequest): Promise<{ role: StaffRole }> {
  const admin = await requireAdmin(request, db);
  const input = parseInput(updateStaffRoleSchema, request.data);
  const ref = db.collection(COLLECTIONS.users).doc(input.uid);

  const previous = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const target = requireProfileState(snap.exists ? (snap.data() as StoredProfile) : undefined);
    const result = validateRoleChange(
      { actorUid: admin.uid, targetUid: input.uid, target, activeAdminCount: await countActiveAdmins(db, tx) },
      input.role,
    );
    if (!result.ok) throw new HttpsError('failed-precondition', result.message);

    tx.update(ref, { role: input.role, updatedAt: FieldValue.serverTimestamp() });
    writeAuditLogInTransaction(db, tx, {
      eventType: 'STAFF_ROLE_CHANGED',
      ...actorFields(admin),
      targetType: 'staff',
      targetId: input.uid,
      action: 'role_change',
      metadata: { fromRole: target.role, toRole: input.role },
    });
    return target.role;
  });

  // Claims follow the profile. Until the token refreshes, the stale claim no longer matches the
  // profile role, so authorization fails closed; revoking refresh tokens forces a fresh sign-in.
  try {
    const user = await auth.getUser(input.uid);
    await auth.setCustomUserClaims(input.uid, { ...(user.customClaims ?? {}), role: input.role });
    await auth.revokeRefreshTokens(input.uid);
  } catch (error) {
    logger.error('Role claim sync failed', { previous, message: error instanceof Error ? error.message : 'unknown' });
    throw new HttpsError('internal', 'The role was saved but could not be fully applied. Please try again.');
  }
  return { role: input.role };
}

/** Deactivate or reactivate a staff account. Blocks self-deactivation and removing the last admin. */
export async function setStaffActiveStatus(db: Firestore, auth: Auth, request: AdminRequest): Promise<{ active: boolean }> {
  const admin = await requireAdmin(request, db);
  const input = parseInput(setStaffActiveSchema, request.data);
  const ref = db.collection(COLLECTIONS.users).doc(input.uid);

  // Reactivation: validate first (no side effects), then enable the login, then flip the profile.
  // That way the profile never says "active" while sign-in is impossible, and an unknown or
  // non-staff uid can never have its Firebase login enabled by this function.
  if (input.active) {
    const [profileSnap, adminsSnap] = await Promise.all([
      ref.get(),
      db.collection(COLLECTIONS.users).where('role', '==', 'admin').where('active', '==', true).get(),
    ]);
    const target = requireProfileState(profileSnap.exists ? (profileSnap.data() as StoredProfile) : undefined);
    const check = validateActiveChange(
      { actorUid: admin.uid, targetUid: input.uid, target, activeAdminCount: adminsSnap.size },
      true,
    );
    if (!check.ok) throw new HttpsError('failed-precondition', check.message);
    await auth.updateUser(input.uid, { disabled: false });
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const target = requireProfileState(snap.exists ? (snap.data() as StoredProfile) : undefined);
    const result = validateActiveChange(
      { actorUid: admin.uid, targetUid: input.uid, target, activeAdminCount: await countActiveAdmins(db, tx) },
      input.active,
    );
    if (!result.ok) throw new HttpsError('failed-precondition', result.message);

    tx.update(ref, { active: input.active, updatedAt: FieldValue.serverTimestamp() });
    writeAuditLogInTransaction(db, tx, {
      eventType: input.active ? 'STAFF_REACTIVATED' : 'STAFF_DEACTIVATED',
      ...actorFields(admin),
      targetType: 'staff',
      targetId: input.uid,
      action: input.active ? 'reactivate' : 'deactivate',
      metadata: { role: target.role },
    });
  });

  if (!input.active) {
    // Profile is already inactive (rules + functions deny immediately); now cut the login itself.
    await auth.updateUser(input.uid, { disabled: true });
    await auth.revokeRefreshTokens(input.uid);
  }
  return { active: input.active };
}
