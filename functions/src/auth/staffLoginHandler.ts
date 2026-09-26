import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { writeAuditLog } from '../audit/audit';
import { COLLECTIONS } from '../shared/constants';
import { parseInput } from '../shared/errors';
import { RATE_LIMITS, enforceRateLimit } from '../shared/rateLimit';
import type { StaffRole } from '../shared/types';
import { recordStaffLoginSchema } from '../shared/validation';
import { isStaffRole, requireStaff } from './authorization';

type LoginRequest = Pick<CallableRequest<unknown>, 'data' | 'auth' | 'rawRequest'>;

/**
 * Records staff sign-in outcomes and tells the client whether the signed-in account is genuinely an
 * active staff member / administrator. On success it also stamps `lastLoginAt`.
 *
 * Failed sign-ins arrive from unauthenticated callers (a failed sign-in has no session), so that
 * path is rate limited and stores no credentials and no email address.
 */
export async function recordStaffLogin(db: Firestore, request: LoginRequest): Promise<{ authorized: boolean; role: StaffRole | null }> {
  const input = parseInput(recordStaffLoginSchema, request.data);

  if (input.outcome === 'success') {
    try {
      const staff = await requireStaff(request, db);
      await db.collection(COLLECTIONS.users).doc(staff.uid).set({ lastLoginAt: FieldValue.serverTimestamp() }, { merge: true });
      await writeAuditLog(db, {
        eventType: 'STAFF_LOGIN_SUCCESS',
        actorType: 'staff',
        actorUid: staff.uid,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetType: 'session',
        targetId: staff.uid,
        action: 'login',
      });
      return { authorized: true, role: staff.role };
    } catch (error) {
      if (!(error instanceof HttpsError)) throw error;
      await enforceRateLimit(db, request, RATE_LIMITS.loginFailure);
      // Never log the email of a non-staff account - only that an authenticated non-staff account was refused.
      await writeAuditLog(db, {
        eventType: 'STAFF_LOGIN_FAILURE',
        actorType: 'system',
        actorUid: request.auth?.uid ?? 'anonymous',
        targetType: 'session',
        targetId: request.auth?.uid ?? 'anonymous',
        action: 'login_denied',
        metadata: { reason: 'not_authorized' },
      });
      return { authorized: false, role: null };
    }
  }

  await enforceRateLimit(db, request, RATE_LIMITS.loginFailure);
  await writeAuditLog(db, {
    eventType: 'STAFF_LOGIN_FAILURE',
    actorType: 'system',
    actorUid: 'anonymous',
    targetType: 'session',
    targetId: 'anonymous',
    action: 'login_failed',
    metadata: { reason: input.reason ?? 'other' },
  });
  return { authorized: false, role: null };
}

/** Best-effort audit of an explicit sign-out. Silently ignores callers that are not staff. */
export async function recordStaffLogout(db: Firestore, request: Pick<CallableRequest<unknown>, 'auth'>): Promise<{ recorded: boolean }> {
  const auth = request.auth;
  const role = auth?.token['role'];
  if (!auth || !isStaffRole(role)) return { recorded: false };

  await writeAuditLog(db, {
    eventType: 'STAFF_LOGOUT',
    actorType: 'staff',
    actorUid: auth.uid,
    actorEmail: typeof auth.token.email === 'string' ? auth.token.email : null,
    actorRole: role,
    targetType: 'session',
    targetId: auth.uid,
    action: 'logout',
  });
  return { recorded: true };
}
