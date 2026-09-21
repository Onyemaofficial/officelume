import { Link } from 'react-router';
import { DataState, EmptyState } from '../../components/DataState';
import { StatusBadge } from '../../components/StatusBadge';
import { AdminPageHeader, RequestsTable, StatCard, TableWrap } from '../../features/admin/AdminUi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { listEscalations } from '../../services/escalationService';
import { listServiceRequests } from '../../services/serviceRequestService';
import { getDashboardStats } from '../../services/statsService';
import { formatDateTime } from '../../utils/format';

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const stats = useAsyncData(getDashboardStats);
  const recent = useAsyncData(() => listServiceRequests(8));
  const escalations = useAsyncData(() => listEscalations(5));

  return (
    <>
      <AdminPageHeader title="Dashboard" description="What needs attention across service requests and escalations." />

      <DataState loading={stats.loading && !stats.data} error={stats.error} onRetry={() => void stats.reload()}>
        {stats.data && (
          <section className="stat-grid" aria-label="Summary">
            <StatCard label="New service requests" value={stats.data.newRequests} tone="blue" />
            <StatCard label="Open escalations" value={stats.data.openEscalations} tone="amber" hint="New or in review" />
            <StatCard label="Requests today" value={stats.data.requestsToday} tone="teal" />
            <StatCard label="Completed requests" value={stats.data.completedRequests} tone="green" />
          </section>
        )}
      </DataState>

      <section className="panel" aria-labelledby="recent-requests">
        <div className="panel-header">
          <h2 id="recent-requests">Recent service requests</h2>
          <Link to="/admin/requests" className="btn btn-secondary btn-sm">View all</Link>
        </div>
        <DataState loading={recent.loading && !recent.data} error={recent.error} onRetry={() => void recent.reload()}>
          <RequestsTable requests={recent.data ?? []} />
        </DataState>
      </section>

      <section className="panel" aria-labelledby="recent-escalations">
        <div className="panel-header">
          <h2 id="recent-escalations">Latest escalations</h2>
          <Link to="/admin/escalations" className="btn btn-secondary btn-sm">View all</Link>
        </div>
        <DataState loading={escalations.loading && !escalations.data} error={escalations.error} onRetry={() => void escalations.reload()}>
          {(escalations.data ?? []).length === 0 ? (
            <EmptyState title="No escalations yet">Questions the AI can’t answer will show up here.</EmptyState>
          ) : (
            <TableWrap label="Latest escalations">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Escalation #</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Question</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(escalations.data ?? []).map((e) => (
                    <tr key={e.id}>
                      <td data-label="Escalation #">{e.escalationNumber}</td>
                      <td data-label="Customer">{e.customerName}</td>
                      <td data-label="Question" className="cell-clip">{e.originalQuestion}</td>
                      <td data-label="Status"><StatusBadge status={e.status} /></td>
                      <td data-label="Created">{formatDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </DataState>
      </section>
    </>
  );
}
