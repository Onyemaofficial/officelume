import type { RequestStatus, ServiceRequest, ServiceType } from '../../types';

export interface RequestFilters {
  status: RequestStatus | '';
  serviceType: ServiceType | '';
  /** Preferred service date, YYYY-MM-DD. */
  date: string;
  search: string;
}

export const EMPTY_FILTERS: RequestFilters = { status: '', serviceType: '', date: '', search: '' };

/** Client-side filtering over the most recent requests loaded for the admin table. */
export function filterRequests(requests: ServiceRequest[], filters: RequestFilters): ServiceRequest[] {
  const needle = filters.search.trim().toLowerCase();
  return requests.filter((r) => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.serviceType && r.serviceType !== filters.serviceType) return false;
    if (filters.date && r.preferredDate !== filters.date) return false;
    if (needle) {
      const haystack = [r.customerName, r.requestNumber, r.email, r.phone, r.city].join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

export function hasActiveFilters(filters: RequestFilters): boolean {
  return Boolean(filters.status || filters.serviceType || filters.date || filters.search.trim());
}
