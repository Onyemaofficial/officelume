import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { writeAuditLog, writeAuditLogInTransaction } from '../audit/audit';
import { requireStaff } from '../auth/authorization';
import { COLLECTIONS, LIMITS } from '../shared/constants';
import { parseInput } from '../shared/errors';
import { nextReferenceNumber } from '../shared/numbering';
import { RATE_LIMITS, enforceRateLimit } from '../shared/rateLimit';
import { canTransitionRequest } from '../shared/statusRules';
import type { RequestStatus } from '../shared/types';
import { serviceRequestSchema, updateServiceRequestSchema } from '../shared/validation';

type PublicRequest = Pick<CallableRequest<unknown>, 'data' | 'rawRequest'>;
type AdminRequest = Pick<CallableRequest<unknown>, 'data' | 'auth' | 'rawRequest'>;

/** FR-05 / FR-06: capture a service request and return its reference number. */
export async function createServiceRequest(db: Firestore, request: PublicRequest): Promise<{ requestNumber: string }> {
  const input = parseInput(serviceRequestSchema, request.data);
  await enforceRateLimit(db, request, RATE_LIMITS.serviceRequest);

  const ref = db.collection(COLLECTIONS.serviceRequests).doc();
  const requestNumber = await db.runTransaction(async (tx) => {
    const number = await nextReferenceNumber(db, tx, 'SR');
    tx.create(ref, {
      requestNumber: number,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      city: input.city,
      zipCode: input.zipCode,
      serviceType: input.serviceType,
      issueDescription: input.issueDescription,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      preferredContactMethod: input.preferredContactMethod,
      status: 'new',
      source: 'web_form',
      consentAcknowledgedAt: Timestamp.now(),
      adminNotes: [],
      statusHistory: [{ status: 'new', changedAt: Timestamp.now(), changedBy: 'system' }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return number;
  });

  await writeAuditLog(db, {
    eventType: 'SERVICE_REQUEST_CREATED',
    actorType: 'customer',
    actorUid: 'anonymous',
    targetType: 'serviceRequest',
    targetId: ref.id,
    action: 'create',
    metadata: { requestNumber, serviceType: input.serviceType },
  });

  return { requestNumber };
}

interface StoredRequest {
  requestNumber: string;
  status: RequestStatus;
  statusHistory?: Array<Record<string, unknown>>;
  adminNotes?: Array<Record<string, unknown>>;
}

/** FR-10: staff and administrators change status and/or append internal notes. */
export async function updateServiceRequest(
  db: Firestore,
  request: AdminRequest,
): Promise<{ status: RequestStatus; changed: boolean }> {
  const staff = await requireStaff(request, db);
  const input = parseInput(updateServiceRequestSchema, request.data);
  const ref = db.collection(COLLECTIONS.serviceRequests).doc(input.requestId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Service request not found.');
    const data = snap.data() as StoredRequest;
    const update: Record<string, unknown> = {};
    let changed = false;

    if (input.status && input.status !== data.status) {
      if (!canTransitionRequest(data.status, input.status)) {
        throw new HttpsError('failed-precondition', `A request that is "${data.status}" cannot be moved to "${input.status}".`);
      }
      update['status'] = input.status;
      update['statusHistory'] = [
        ...(data.statusHistory ?? []),
        { status: input.status, changedAt: Timestamp.now(), changedBy: staff.uid },
      ].slice(-LIMITS.maxStatusHistory);
      writeAuditLogInTransaction(db, tx, {
        eventType: 'SERVICE_REQUEST_STATUS_UPDATED',
        actorType: 'staff',
        actorUid: staff.uid,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetType: 'serviceRequest',
        targetId: ref.id,
        action: 'status_update',
        metadata: { requestNumber: data.requestNumber, from: data.status, to: input.status },
      });
      changed = true;
    }

    if (input.note) {
      update['adminNotes'] = [
        ...(data.adminNotes ?? []),
        { note: input.note, authorId: staff.uid, authorEmail: staff.email, createdAt: Timestamp.now() },
      ].slice(-LIMITS.maxNotesPerRecord);
      writeAuditLogInTransaction(db, tx, {
        eventType: 'SERVICE_REQUEST_NOTE_ADDED',
        actorType: 'staff',
        actorUid: staff.uid,
        actorEmail: staff.email,
        actorRole: staff.role,
        targetType: 'serviceRequest',
        targetId: ref.id,
        action: 'note_added',
        metadata: { requestNumber: data.requestNumber },
      });
      changed = true;
    }

    if (changed) {
      update['updatedAt'] = FieldValue.serverTimestamp();
      tx.update(ref, update);
    }
    return { status: (update['status'] as RequestStatus | undefined) ?? data.status, changed };
  });
}
