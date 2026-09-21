import { describe, expect, it } from 'vitest';
import type { ServiceRequest } from '../../types';
import { EMPTY_FILTERS, filterRequests, hasActiveFilters } from './filters';

function make(overrides: Partial<ServiceRequest>): ServiceRequest {
  return {
    id: 'id',
    requestNumber: 'SR-2026-000001',
    customerName: 'Jordan Rivera',
    phone: '555-010-2345',
    email: 'jordan@example.com',
    address: '12 Elm St',
    city: 'Riverton',
    zipCode: '40101',
    serviceType: 'ac_repair',
    issueDescription: 'No cooling',
    preferredDate: '2026-06-20',
    preferredTime: 'morning',
    preferredContactMethod: 'phone',
    status: 'new',
    source: 'web_form',
    adminNotes: [],
    statusHistory: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const data = [
  make({ id: '1', requestNumber: 'SR-2026-000001', customerName: 'Jordan Rivera', status: 'new', serviceType: 'ac_repair', preferredDate: '2026-06-20' }),
  make({ id: '2', requestNumber: 'SR-2026-000002', customerName: 'Sam Lee', status: 'completed', serviceType: 'maintenance', preferredDate: '2026-06-21', city: 'Lakeside', email: 'sam@example.com' }),
  make({ id: '3', requestNumber: 'SR-2026-000003', customerName: 'Priya Patel', status: 'new', serviceType: 'heating_repair', preferredDate: '2026-06-20' }),
];

describe('filterRequests', () => {
  it('returns everything with empty filters', () => {
    expect(filterRequests(data, EMPTY_FILTERS)).toHaveLength(3);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('filters by status, service type and preferred date', () => {
    expect(filterRequests(data, { ...EMPTY_FILTERS, status: 'new' }).map((r) => r.id)).toEqual(['1', '3']);
    expect(filterRequests(data, { ...EMPTY_FILTERS, serviceType: 'maintenance' }).map((r) => r.id)).toEqual(['2']);
    expect(filterRequests(data, { ...EMPTY_FILTERS, date: '2026-06-20' }).map((r) => r.id)).toEqual(['1', '3']);
  });

  it('searches name, request number, email, and city case-insensitively', () => {
    expect(filterRequests(data, { ...EMPTY_FILTERS, search: 'priya' }).map((r) => r.id)).toEqual(['3']);
    expect(filterRequests(data, { ...EMPTY_FILTERS, search: 'sr-2026-000002' }).map((r) => r.id)).toEqual(['2']);
    expect(filterRequests(data, { ...EMPTY_FILTERS, search: 'LAKESIDE' }).map((r) => r.id)).toEqual(['2']);
    expect(filterRequests(data, { ...EMPTY_FILTERS, search: 'sam@example' }).map((r) => r.id)).toEqual(['2']);
  });

  it('combines filters', () => {
    expect(filterRequests(data, { status: 'new', serviceType: 'heating_repair', date: '', search: 'patel' })).toHaveLength(1);
    expect(filterRequests(data, { status: 'completed', serviceType: 'heating_repair', date: '', search: '' })).toHaveLength(0);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: ' x ' })).toBe(true);
  });
});
