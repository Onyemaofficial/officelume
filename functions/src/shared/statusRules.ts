import type { EscalationStatus, RequestStatus } from './types';

/** Allowed status transitions. Terminal states can only be re-opened to `reviewing`. */
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

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionEscalation(from: EscalationStatus, to: EscalationStatus): boolean {
  return ESCALATION_TRANSITIONS[from]?.includes(to) ?? false;
}
