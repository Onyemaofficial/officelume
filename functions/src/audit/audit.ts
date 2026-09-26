import { logger } from 'firebase-functions/v2';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../shared/constants';
import type { AuditEventInput, AuditMetadataValue } from '../shared/types';

/** Metadata keys that must never reach the audit trail, even if a caller passes them by mistake. */
const FORBIDDEN_KEYS = /pass(word)?|secret|token|api[-_]?key|email|phone|address|name|message|question|description/i;

export function sanitizeAuditMetadata(
  metadata: Record<string, AuditMetadataValue> | undefined,
): Record<string, AuditMetadataValue> {
  const out: Record<string, AuditMetadataValue> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    out[key] = typeof value === 'string' ? value.slice(0, 200) : value;
  }
  return out;
}

/**
 * Build the Firestore document for an audit event. The timestamp is always server-assigned.
 * `actorEmail` / `actorRole` are recorded only for authenticated staff actors (never for customers).
 */
export function buildAuditEntry(event: AuditEventInput) {
  return {
    eventType: event.eventType,
    actorType: event.actorType,
    actorUid: event.actorUid,
    ...(event.actorEmail ? { actorEmail: event.actorEmail } : {}),
    ...(event.actorRole ? { actorRole: event.actorRole } : {}),
    targetType: event.targetType,
    targetId: event.targetId,
    action: event.action,
    metadata: sanitizeAuditMetadata(event.metadata),
    timestamp: FieldValue.serverTimestamp(),
  };
}

/** Write an audit event. Failures are logged but never break the customer-facing operation. */
export async function writeAuditLog(db: Firestore, event: AuditEventInput): Promise<void> {
  try {
    await db.collection(COLLECTIONS.auditLogs).add(buildAuditEntry(event));
  } catch (error) {
    logger.error('Failed to write audit log', {
      eventType: event.eventType,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/** Write an audit event atomically with a business change (used for staff/admin mutations). */
export function writeAuditLogInTransaction(db: Firestore, tx: Transaction, event: AuditEventInput): void {
  tx.set(db.collection(COLLECTIONS.auditLogs).doc(), buildAuditEntry(event));
}
