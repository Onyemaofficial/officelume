import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { writeAuditLog } from '../audit/audit';
import { parseInput } from '../shared/errors';
import { RATE_LIMITS, enforceRateLimit } from '../shared/rateLimit';
import { recordAdminLoginSchema } from '../shared/validation';
import { requireAdmin } from './authorization';

/**
 * Records admin sign-in outcomes in the audit log and tells the client whether the signed-in
 * account is really an administrator. Failures are accepted from unauthenticated callers (a failed
 * sign-in has no session), so that path is rate limited and stores no credentials or email.
 */
export async function recordAdminLogin(
  db: Firestore,
  request: Pick<CallableRequest<unknown>, 'data' | 'auth' | 'rawRequest'>,
): Promise<{ authorized: boolean }> {
  const input = parseInput(recordAdminLoginSchema, request.data);

  if (input.outcome === 'success') {
    try {
      const admin = await requireAdmin(request, db);
      await writeAuditLog(db, {
        eventType: 'ADMIN_LOGIN_SUCCESS',
        actorType: 'admin',
        actorId: admin.uid,
        targetType: 'session',
        targetId: admin.uid,
        action: 'login',
      });
      return { authorized: true };
    } catch (error) {
      if (!(error instanceof HttpsError)) throw error;
      await enforceRateLimit(db, request, RATE_LIMITS.loginFailure);
      await writeAuditLog(db, {
        eventType: 'ADMIN_LOGIN_FAILURE',
        actorType: request.auth ? 'customer' : 'system',
        actorId: request.auth?.uid ?? 'anonymous',
        targetType: 'session',
        targetId: request.auth?.uid ?? 'anonymous',
        action: 'login_denied',
        metadata: { reason: 'not_authorized' },
      });
      return { authorized: false };
    }
  }

  await enforceRateLimit(db, request, RATE_LIMITS.loginFailure);
  await writeAuditLog(db, {
    eventType: 'ADMIN_LOGIN_FAILURE',
    actorType: 'system',
    actorId: 'anonymous',
    targetType: 'session',
    targetId: 'anonymous',
    action: 'login_failed',
    metadata: { reason: input.reason ?? 'other' },
  });
  return { authorized: false };
}
