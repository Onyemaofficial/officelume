import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { writeAuditLog, writeAuditLogInTransaction } from '../audit/audit';
import { requireAdmin } from '../auth/authorization';
import { COLLECTIONS, LIMITS } from '../shared/constants';
import { parseInput } from '../shared/errors';
import { nextReferenceNumber } from '../shared/numbering';
import { RATE_LIMITS, enforceRateLimit } from '../shared/rateLimit';
import { canTransitionEscalation } from '../shared/statusRules';
import type { EscalationStatus } from '../shared/types';
import { escalationSchema, updateEscalationSchema } from '../shared/validation';

type PublicRequest = Pick<CallableRequest<unknown>, 'data' | 'rawRequest'>;
type AdminRequest = Pick<CallableRequest<unknown>, 'data' | 'auth' | 'rawRequest'>;

export const DIRECT_REQUEST_REASON = 'Customer asked to speak with a team member.';

/**
 * The escalation reason is derived server-side from the chat session (what the AI actually
 * decided), never trusted from the browser.
 */
export async function resolveEscalationReason(db: Firestore, sessionId: string | undefined): Promise<string> {
  if (!sessionId) return DIRECT_REQUEST_REASON;
  const snap = await db.collection(COLLECTIONS.chatSessions).doc(sessionId).get();
  const reason = snap.exists ? (snap.data() as { lastEscalationReason?: unknown }).lastEscalationReason : undefined;
  return typeof reason === 'string' && reason.length > 0 ? reason.slice(0, 300) : DIRECT_REQUEST_REASON;
}

/** FR-04 / FR-07 / FR-15: create a human-escalation record and return its reference number. */
export async function createEscalation(db: Firestore, request: PublicRequest): Promise<{ escalationNumber: string }> {
  const input = parseInput(escalationSchema, request.data);
  await enforceRateLimit(db, request, RATE_LIMITS.escalation);

  const reason = await resolveEscalationReason(db, input.sessionId);
  const ref = db.collection(COLLECTIONS.escalations).doc();

  const escalationNumber = await db.runTransaction(async (tx) => {
    const number = await nextReferenceNumber(db, tx, 'ESC');
    tx.create(ref, {
      escalationNumber: number,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email,
      preferredContactMethod: input.preferredContactMethod,
      originalQuestion: input.originalQuestion,
      additionalDetails: input.additionalDetails ?? '',
      reason,
      status: 'new',
      sessionId: input.sessionId ?? null,
      consentAcknowledgedAt: Timestamp.now(),
      adminNotes: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return number;
  });

  await writeAuditLog(db, {
    eventType: 'ESCALATION_CREATED',
    actorType: 'customer',
    actorId: 'anonymous',
    targetType: 'escalation',
    targetId: ref.id,
    action: 'create',
    metadata: { escalationNumber, fromChat: Boolean(input.sessionId) },
  });

  return { escalationNumber };
}

interface StoredEscalation {
  escalationNumber: string;
  status: EscalationStatus;
  adminNotes?: Array<Record<string, unknown>>;
}

/** FR-11: administrators review and resolve escalations. */
export async function updateEscalation(
  db: Firestore,
  request: AdminRequest,
): Promise<{ status: EscalationStatus; changed: boolean }> {
  const admin = await requireAdmin(request, db);
  const input = parseInput(updateEscalationSchema, request.data);
  const ref = db.collection(COLLECTIONS.escalations).doc(input.escalationId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Escalation not found.');
    const data = snap.data() as StoredEscalation;
    const update: Record<string, unknown> = {};
    let changed = false;

    if (input.status && input.status !== data.status) {
      if (!canTransitionEscalation(data.status, input.status)) {
        throw new HttpsError('failed-precondition', `An escalation that is "${data.status}" cannot be moved to "${input.status}".`);
      }
      update['status'] = input.status;
      writeAuditLogInTransaction(db, tx, {
        eventType: 'ESCALATION_STATUS_UPDATED',
        actorType: 'admin',
        actorId: admin.uid,
        targetType: 'escalation',
        targetId: ref.id,
        action: 'status_update',
        metadata: { escalationNumber: data.escalationNumber, from: data.status, to: input.status },
      });
      changed = true;
    }

    if (input.note) {
      update['adminNotes'] = [
        ...(data.adminNotes ?? []),
        { note: input.note, authorId: admin.uid, authorEmail: admin.email, createdAt: Timestamp.now() },
      ].slice(-LIMITS.maxNotesPerRecord);
      writeAuditLogInTransaction(db, tx, {
        eventType: 'ESCALATION_NOTE_ADDED',
        actorType: 'admin',
        actorId: admin.uid,
        targetType: 'escalation',
        targetId: ref.id,
        action: 'note_added',
        metadata: { escalationNumber: data.escalationNumber },
      });
      changed = true;
    }

    if (changed) {
      update['updatedAt'] = FieldValue.serverTimestamp();
      tx.update(ref, update);
    }
    return { status: (update['status'] as EscalationStatus | undefined) ?? data.status, changed };
  });
}
