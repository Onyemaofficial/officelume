import type { DocumentData, QueryDocumentSnapshot, DocumentSnapshot } from 'firebase/firestore';
import type {
  AdminNote,
  AuditLog,
  Escalation,
  KnowledgeArticle,
  RequestStatus,
  ServiceRequest,
  StatusHistoryEntry,
} from '../types';

/** Convert a Firestore Timestamp-like value (or nothing) to a Date. */
export function toDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

function mapNotes(value: unknown): AdminNote[] {
  if (!Array.isArray(value)) return [];
  return value.map((n: Record<string, unknown>) => ({
    note: str(n['note']),
    authorId: str(n['authorId']),
    authorEmail: typeof n['authorEmail'] === 'string' ? n['authorEmail'] : null,
    createdAt: toDate(n['createdAt']),
  }));
}

function mapHistory(value: unknown): StatusHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((h: Record<string, unknown>) => ({
    status: str(h['status'], 'new') as RequestStatus,
    changedAt: toDate(h['changedAt']),
    changedBy: str(h['changedBy']),
  }));
}

type Snap = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

export function mapServiceRequest(snap: Snap): ServiceRequest {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    requestNumber: str(d['requestNumber']),
    customerName: str(d['customerName']),
    phone: str(d['phone']),
    email: str(d['email']),
    address: str(d['address']),
    city: str(d['city']),
    zipCode: str(d['zipCode']),
    serviceType: str(d['serviceType'], 'other') as ServiceRequest['serviceType'],
    issueDescription: str(d['issueDescription']),
    preferredDate: str(d['preferredDate']),
    preferredTime: str(d['preferredTime'], 'anytime') as ServiceRequest['preferredTime'],
    preferredContactMethod: str(d['preferredContactMethod'], 'phone') as ServiceRequest['preferredContactMethod'],
    status: str(d['status'], 'new') as RequestStatus,
    source: str(d['source']),
    adminNotes: mapNotes(d['adminNotes']),
    statusHistory: mapHistory(d['statusHistory']),
    createdAt: toDate(d['createdAt']),
    updatedAt: toDate(d['updatedAt']),
  };
}

export function mapEscalation(snap: Snap): Escalation {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    escalationNumber: str(d['escalationNumber']),
    customerName: str(d['customerName']),
    phone: str(d['phone']),
    email: str(d['email']),
    preferredContactMethod: str(d['preferredContactMethod'], 'phone') as Escalation['preferredContactMethod'],
    originalQuestion: str(d['originalQuestion']),
    additionalDetails: str(d['additionalDetails']),
    reason: str(d['reason']),
    status: str(d['status'], 'new') as Escalation['status'],
    adminNotes: mapNotes(d['adminNotes']),
    createdAt: toDate(d['createdAt']),
    updatedAt: toDate(d['updatedAt']),
  };
}

export function mapKnowledge(snap: Snap): KnowledgeArticle {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    title: str(d['title']),
    category: str(d['category'], 'other') as KnowledgeArticle['category'],
    content: str(d['content']),
    active: d['active'] === true,
    createdAt: toDate(d['createdAt']),
    updatedAt: toDate(d['updatedAt']),
  };
}

export function mapAuditLog(snap: Snap): AuditLog {
  const d = snap.data() ?? {};
  const metadata: AuditLog['metadata'] = {};
  if (d['metadata'] && typeof d['metadata'] === 'object') {
    for (const [k, v] of Object.entries(d['metadata'] as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) metadata[k] = v;
    }
  }
  return {
    id: snap.id,
    eventType: str(d['eventType']) as AuditLog['eventType'],
    actorType: str(d['actorType']),
    actorId: str(d['actorId']),
    targetType: str(d['targetType']),
    targetId: str(d['targetId']),
    action: str(d['action']),
    metadata,
    timestamp: toDate(d['timestamp']),
  };
}
