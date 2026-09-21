/** Enumerations and display labels shared by forms, tables, and validation. */

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
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  ac_repair: 'Air Conditioning Repair',
  heating_repair: 'Heating Repair',
  maintenance: 'HVAC Maintenance',
  ac_installation: 'AC Installation',
  heating_installation: 'Heating Installation',
  thermostat: 'Thermostat Issue',
  indoor_air_quality: 'Indoor Air Quality',
  emergency: 'Emergency Service',
  other: 'Other',
};

export const TIME_WINDOWS = ['morning', 'afternoon', 'evening', 'anytime'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];
export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  morning: 'Morning (8 AM - 12 PM)',
  afternoon: 'Afternoon (12 - 4 PM)',
  evening: 'Late afternoon (4 - 6 PM)',
  anytime: 'Flexible / any time',
};

export const CONTACT_METHODS = ['phone', 'email'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: 'Phone call',
  email: 'Email',
};

export const REQUEST_STATUSES = ['new', 'reviewing', 'contacted', 'scheduled', 'completed', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ESCALATION_STATUSES = ['new', 'reviewing', 'contacted', 'resolved'] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];
export const ESCALATION_STATUS_LABELS: Record<EscalationStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  resolved: 'Resolved',
};

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
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  hours: 'Hours',
  services: 'Services',
  service_area: 'Service area',
  pricing: 'Pricing',
  scheduling: 'Scheduling',
  emergency: 'Emergency',
  policies: 'Policies',
  other: 'Other',
};

export const AI_CATEGORIES = ['hours', 'services', 'service_area', 'pricing', 'scheduling', 'emergency', 'other'] as const;
export type AICategory = (typeof AI_CATEGORIES)[number];

/** Status transitions administrators may choose. Mirrors functions/src/shared/statusRules.ts. */
export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ['reviewing', 'contacted', 'scheduled', 'cancelled'],
  reviewing: ['contacted', 'scheduled', 'cancelled'],
  contacted: ['reviewing', 'scheduled', 'completed', 'cancelled'],
  scheduled: ['contacted', 'completed', 'cancelled'],
  completed: ['reviewing'],
  cancelled: ['reviewing'],
};

export const ESCALATION_TRANSITIONS: Record<EscalationStatus, readonly EscalationStatus[]> = {
  new: ['reviewing', 'contacted', 'resolved'],
  reviewing: ['contacted', 'resolved'],
  contacted: ['reviewing', 'resolved'],
  resolved: ['reviewing'],
};

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
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
