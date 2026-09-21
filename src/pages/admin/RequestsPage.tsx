import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { DataState } from '../../components/DataState';
import { SelectField, TextField } from '../../components/Field';
import { AdminPageHeader, RequestsTable } from '../../features/admin/AdminUi';
import { EMPTY_FILTERS, filterRequests, hasActiveFilters, type RequestFilters } from '../../features/serviceRequests/filters';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { listServiceRequests } from '../../services/serviceRequestService';
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type RequestStatus,
  type ServiceType,
} from '../../types';

const STATUS_OPTIONS = REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] }));
const TYPE_OPTIONS = SERVICE_TYPES.map((t) => ({ value: t, label: SERVICE_TYPE_LABELS[t] }));

export function RequestsPage() {
  useDocumentTitle('Service requests');
  const { data, loading, error, reload } = useAsyncData(() => listServiceRequests(200));
  const [filters, setFilters] = useState<RequestFilters>(EMPTY_FILTERS);

  const filtered = useMemo(() => filterRequests(data ?? [], filters), [data, filters]);

  return (
    <>
      <AdminPageHeader
        title="Service requests"
        description="Review, search, and update customer service requests."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void reload()} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />

      <section className="panel" aria-label="Filters">
        <form className="filter-bar" onSubmit={(e) => e.preventDefault()} role="search">
          <TextField
            label="Search"
            type="search"
            placeholder="Name, request #, email, phone, city"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <SelectField
            label="Status"
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as RequestStatus | '' }))}
          />
          <SelectField
            label="Service type"
            placeholder="All service types"
            options={TYPE_OPTIONS}
            value={filters.serviceType}
            onChange={(e) => setFilters((f) => ({ ...f, serviceType: e.target.value as ServiceType | '' }))}
          />
          <TextField label="Preferred date" type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          <div className="filter-actions">
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasActiveFilters(filters)}>
              Clear filters
            </Button>
          </div>
        </form>
      </section>

      <section className="panel">
        <DataState loading={loading && !data} error={error} onRetry={() => void reload()}>
          <p className="muted small" aria-live="polite">
            Showing {filtered.length} of {data?.length ?? 0} recent requests
          </p>
          <RequestsTable requests={filtered} emptyMessage={hasActiveFilters(filters) ? 'No requests match these filters.' : undefined} />
        </DataState>
      </section>
    </>
  );
}
