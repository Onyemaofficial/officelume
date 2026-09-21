import { ESCALATION_STATUS_LABELS, REQUEST_STATUS_LABELS, type EscalationStatus, type RequestStatus } from '../types';

const TONES: Record<string, string> = {
  new: 'badge-blue',
  reviewing: 'badge-amber',
  contacted: 'badge-violet',
  scheduled: 'badge-teal',
  completed: 'badge-green',
  resolved: 'badge-green',
  cancelled: 'badge-gray',
};

export function StatusBadge({ status }: { status: RequestStatus | EscalationStatus }) {
  const label =
    (REQUEST_STATUS_LABELS as Record<string, string>)[status] ??
    (ESCALATION_STATUS_LABELS as Record<string, string>)[status] ??
    status;
  return <span className={`badge ${TONES[status] ?? 'badge-gray'}`}>{label}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <span className={active ? 'badge badge-green' : 'badge badge-gray'}>{active ? 'Active' : 'Inactive'}</span>;
}
