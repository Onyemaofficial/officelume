import { createHash } from 'node:crypto';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from './constants';

export interface RateLimitState {
  count: number;
  windowStartMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  next: RateLimitState;
  retryAfterSeconds: number;
}

/** Pure fixed-window limiter so the policy can be unit-tested without Firestore. */
export function evaluateRateLimit(
  state: RateLimitState | undefined,
  nowMs: number,
  limit: number,
  windowMs: number,
): RateLimitDecision {
  if (!state || nowMs - state.windowStartMs >= windowMs) {
    return { allowed: true, next: { count: 1, windowStartMs: nowMs }, retryAfterSeconds: 0 };
  }
  if (state.count >= limit) {
    return {
      allowed: false,
      next: state,
      retryAfterSeconds: Math.max(1, Math.ceil((state.windowStartMs + windowMs - nowMs) / 1000)),
    };
  }
  return { allowed: true, next: { count: state.count + 1, windowStartMs: state.windowStartMs }, retryAfterSeconds: 0 };
}

/** Stable, non-reversible identifier for the caller so raw IP addresses are never stored. */
export function callerFingerprint(request: Pick<CallableRequest, 'rawRequest'>): string {
  const ip = request.rawRequest?.ip ?? 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 24);
}

export interface RateLimitPolicy {
  action: string;
  limit: number;
  windowSeconds: number;
}

/** Firestore-backed limiter for public callables. Throws `resource-exhausted` when over the limit. */
export async function enforceRateLimit(
  db: Firestore,
  request: Pick<CallableRequest, 'rawRequest'>,
  policy: RateLimitPolicy,
): Promise<void> {
  const ref = db.collection(COLLECTIONS.rateLimits).doc(`${policy.action}_${callerFingerprint(request)}`);
  const windowMs = policy.windowSeconds * 1000;
  const nowMs = Date.now();

  const decision = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count?: number; windowStartMs?: number } | undefined;
    const state =
      data && typeof data.count === 'number' && typeof data.windowStartMs === 'number'
        ? { count: data.count, windowStartMs: data.windowStartMs }
        : undefined;
    const result = evaluateRateLimit(state, nowMs, policy.limit, windowMs);
    if (result.allowed) {
      tx.set(ref, {
        ...result.next,
        // Configure a Firestore TTL policy on `expiresAt` to purge stale buckets automatically.
        expiresAt: Timestamp.fromMillis(result.next.windowStartMs + windowMs * 2),
      });
    }
    return result;
  });

  if (!decision.allowed) {
    throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a moment and try again.', {
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }
}

export const RATE_LIMITS = {
  chat: { action: 'chat', limit: 20, windowSeconds: 60 },
  serviceRequest: { action: 'service-request', limit: 5, windowSeconds: 3600 },
  escalation: { action: 'escalation', limit: 5, windowSeconds: 3600 },
  loginFailure: { action: 'login-failure', limit: 20, windowSeconds: 900 },
} as const satisfies Record<string, RateLimitPolicy>;
