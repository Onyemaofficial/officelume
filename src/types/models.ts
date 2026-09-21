import type {
  AICategory,
  AuditEventType,
  ContactMethod,
  EscalationStatus,
  KnowledgeCategory,
  RequestStatus,
  ServiceType,
  TimeWindow,
} from './domain';

/** Client-side models. Firestore Timestamps are converted to `Date` in the service layer. */

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin';
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AdminNote {
  note: string;
  authorId: string;
  authorEmail: string | null;
  createdAt: Date | null;
}

export interface StatusHistoryEntry {
  status: RequestStatus;
  changedAt: Date | null;
  changedBy: string;
}

export interface ServiceRequest {
  id: string;
  requestNumber: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  zipCode: string;
  serviceType: ServiceType;
  issueDescription: string;
  preferredDate: string;
  preferredTime: TimeWindow;
  preferredContactMethod: ContactMethod;
  status: RequestStatus;
  source: string;
  adminNotes: AdminNote[];
  statusHistory: StatusHistoryEntry[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Escalation {
  id: string;
  escalationNumber: string;
  customerName: string;
  phone: string;
  email: string;
  preferredContactMethod: ContactMethod;
  originalQuestion: string;
  additionalDetails: string;
  reason: string;
  status: EscalationStatus;
  adminNotes: AdminNote[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ChatSession {
  id: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  supported?: boolean;
  requiresEscalation?: boolean;
  category?: AICategory;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  actorType: string;
  actorId: string;
  targetType: string;
  targetId: string;
  action: string;
  metadata: Record<string, string | number | boolean | null>;
  timestamp: Date | null;
}

/** Validated response from the askOfficeLume function. */
export interface AIResponse {
  answer: string;
  supported: boolean;
  requiresEscalation: boolean;
  category: AICategory;
}

export interface ChatResult extends AIResponse {
  sessionId: string;
}
