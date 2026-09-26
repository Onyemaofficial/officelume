import type {
  AI_CATEGORIES,
  AUDIT_EVENT_TYPES,
  CONTACT_METHODS,
  ESCALATION_STATUSES,
  KNOWLEDGE_CATEGORIES,
  REQUEST_STATUSES,
  SERVICE_TYPES,
  STAFF_ROLES,
  TIME_WINDOWS,
} from './constants';

export type ServiceType = (typeof SERVICE_TYPES)[number];
export type TimeWindow = (typeof TIME_WINDOWS)[number];
export type ContactMethod = (typeof CONTACT_METHODS)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type AICategory = (typeof AI_CATEGORIES)[number];
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  active: boolean;
}

/** Validated AI output. `reason` is internal and is not returned to customers. */
export interface AIResponse {
  answer: string;
  supported: boolean;
  requiresEscalation: boolean;
  category: AICategory;
  reason: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type AuditMetadataValue = string | number | boolean | null;

export interface AuditEventInput {
  eventType: AuditEventType;
  actorType: 'customer' | 'staff' | 'system' | 'ai';
  actorUid: string;
  /** Only for authenticated staff/admin actors. */
  actorEmail?: string | null;
  actorRole?: StaffRole | null;
  targetType: string;
  targetId: string;
  action: string;
  metadata?: Record<string, AuditMetadataValue>;
}
