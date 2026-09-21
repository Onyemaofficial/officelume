/** Enumerations shared by validation, business rules, and persistence. */

export const SERVICE_TYPES = [
  'ac_repair',
  'heating_repair',
  'maintenance',
  'ac_installation',
  'heating_installation',
  'thermostat',
  'indoor_air_quality',
  'emergency',
  'other',
] as const;

export const TIME_WINDOWS = ['morning', 'afternoon', 'evening', 'anytime'] as const;
export const CONTACT_METHODS = ['phone', 'email'] as const;

export const REQUEST_STATUSES = ['new', 'reviewing', 'contacted', 'scheduled', 'completed', 'cancelled'] as const;
export const ESCALATION_STATUSES = ['new', 'reviewing', 'contacted', 'resolved'] as const;

export const KNOWLEDGE_CATEGORIES = [
  'hours',
  'services',
  'service_area',
  'pricing',
  'scheduling',
  'emergency',
  'policies',
  'other',
] as const;

/** Categories the AI is allowed to report on a response. */
export const AI_CATEGORIES = ['hours', 'services', 'service_area', 'pricing', 'scheduling', 'emergency', 'other'] as const;

export const AUDIT_EVENT_TYPES = [
  'ADMIN_LOGIN_SUCCESS',
  'ADMIN_LOGIN_FAILURE',
  'SERVICE_REQUEST_CREATED',
  'SERVICE_REQUEST_STATUS_UPDATED',
  'SERVICE_REQUEST_NOTE_ADDED',
  'ESCALATION_CREATED',
  'ESCALATION_STATUS_UPDATED',
  'ESCALATION_NOTE_ADDED',
  'AI_RESPONSE_GENERATED',
  'AI_RESPONSE_ESCALATED',
  'KNOWLEDGE_CREATED',
  'KNOWLEDGE_UPDATED',
  'KNOWLEDGE_DEACTIVATED',
] as const;

export const COLLECTIONS = {
  users: 'users',
  knowledgeBase: 'knowledgeBase',
  serviceRequests: 'serviceRequests',
  escalations: 'escalations',
  chatSessions: 'chatSessions',
  messages: 'messages',
  auditLogs: 'auditLogs',
  counters: 'counters',
  rateLimits: 'rateLimits',
} as const;

export const LIMITS = {
  maxChatMessageLength: 500,
  maxMessagesPerSession: 40,
  maxNotesPerRecord: 100,
  maxStatusHistory: 100,
} as const;

/** Standard customer-facing text when the AI cannot answer from approved knowledge. */
export const ESCALATION_MESSAGE =
  "I don't have enough approved information to answer that accurately. I can send your request to a team member.";
