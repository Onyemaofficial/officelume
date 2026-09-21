import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/DataState';
import { SERVICE_TYPE_LABELS, type ServiceRequest } from '../../types';
import { formatDateTime, formatIsoDate } from '../../utils/format';

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, tone = 'blue', hint }: { label: string; value: number | string; tone?: 'blue' | 'amber' | 'teal' | 'green'; hint?: string }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

/** Responsive table wrapper: scrolls horizontally inside its own container on small screens. */
export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export function RequestsTable({ requests, emptyMessage }: { requests: ServiceRequest[]; emptyMessage?: string }) {
  if (requests.length === 0) {
    return <EmptyState title="No service requests to show">{emptyMessage ?? 'New requests will appear here.'}</EmptyState>;
  }
  return (
    <TableWrap label="Service requests">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Request #</th>
            <th scope="col">Customer</th>
            <th scope="col">Service type</th>
            <th scope="col">Preferred date</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td data-label="Request #">
                <Link to={`/admin/requests/${r.id}`} className="table-link">
                  {r.requestNumber}
                </Link>
              </td>
              <td data-label="Customer">{r.customerName}</td>
              <td data-label="Service type">{SERVICE_TYPE_LABELS[r.serviceType] ?? r.serviceType}</td>
              <td data-label="Preferred date">{formatIsoDate(r.preferredDate)}</td>
              <td data-label="Status">
                <StatusBadge status={r.status} />
              </td>
              <td data-label="Created">{formatDateTime(r.createdAt)}</td>
              <td data-label="Action">
                <Link to={`/admin/requests/${r.id}`} className="btn btn-secondary btn-sm">
                  View<span className="sr-only"> request {r.requestNumber}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
