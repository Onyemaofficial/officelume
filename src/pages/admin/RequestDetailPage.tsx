import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { DataState } from '../../components/DataState';
import { StatusBadge } from '../../components/StatusBadge';
import { AdminPageHeader } from '../../features/admin/AdminUi';
import { NotesPanel } from '../../features/admin/NotesPanel';
import { StatusUpdater } from '../../features/admin/StatusUpdater';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getServiceRequest, updateServiceRequest } from '../../services/serviceRequestService';
import {
  CONTACT_METHOD_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TRANSITIONS,
  SERVICE_TYPE_LABELS,
  type RequestStatus,
} from '../../types';
import { formatDateTime, formatIsoDate, formatTimeWindow } from '../../utils/format';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function RequestDetailPage() {
  const { id = '' } = useParams();
  useDocumentTitle('Request details');
  const { data: request, loading, error, reload } = useAsyncData(() => getServiceRequest(id));

  async function changeStatus(status: RequestStatus) {
    await updateServiceRequest({ requestId: id, status });
    await reload();
  }
  async function addNote(note: string) {
    await updateServiceRequest({ requestId: id, note });
    await reload();
  }

  return (
    <>
      <p className="breadcrumb">
        <Link to="/admin/requests">← All service requests</Link>
      </p>
      <DataState loading={loading && !request} error={error} onRetry={() => void reload()}>
        {request && (
          <>
            <AdminPageHeader
              title={request.requestNumber}
              description={`${SERVICE_TYPE_LABELS[request.serviceType] ?? request.serviceType} · submitted ${formatDateTime(request.createdAt)}`}
              actions={<StatusBadge status={request.status} />}
            />

            <div className="detail-layout">
              <div className="detail-main">
                <section className="panel" aria-labelledby="customer-info">
                  <h2 id="customer-info">Customer</h2>
                  <dl className="detail-grid">
                    <Detail label="Name">{request.customerName}</Detail>
                    <Detail label="Preferred contact">{CONTACT_METHOD_LABELS[request.preferredContactMethod]}</Detail>
                    <Detail label="Phone"><a href={`tel:${request.phone}`}>{request.phone}</a></Detail>
                    <Detail label="Email"><a href={`mailto:${request.email}`}>{request.email}</a></Detail>
                    <Detail label="Service address">
                      {request.address}, {request.city} {request.zipCode}
                    </Detail>
                  </dl>
                </section>

                <section className="panel" aria-labelledby="request-info">
                  <h2 id="request-info">Request</h2>
                  <dl className="detail-grid">
                    <Detail label="Service type">{SERVICE_TYPE_LABELS[request.serviceType] ?? request.serviceType}</Detail>
                    <Detail label="Preferred date">{formatIsoDate(request.preferredDate)}</Detail>
                    <Detail label="Preferred time window">{formatTimeWindow(request.preferredTime)}</Detail>
                    <Detail label="Source">{request.source || '-'}</Detail>
                  </dl>
                  <h3>Issue description</h3>
                  <p className="pre-wrap">{request.issueDescription}</p>
                  <p className="muted small">Preferred date and time are customer preferences, not a confirmed appointment.</p>
                </section>

                <section className="panel" aria-labelledby="history">
                  <h2 id="history">Status history</h2>
                  <ol className="timeline">
                    {[...request.statusHistory].reverse().map((h, i) => (
                      <li key={`${h.changedAt?.getTime() ?? i}-${i}`}>
                        <StatusBadge status={h.status} />
                        <span className="muted small">
                          {formatDateTime(h.changedAt)} · {h.changedBy === 'system' ? 'Customer submission' : 'Administrator'}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <aside className="detail-side">
                <section className="panel" aria-labelledby="status-panel">
                  <h2 id="status-panel">Status</h2>
                  <p>
                    <StatusBadge status={request.status} />
                  </p>
                  <StatusUpdater
                    current={request.status}
                    allowed={REQUEST_TRANSITIONS[request.status]}
                    labels={REQUEST_STATUS_LABELS}
                    onSave={changeStatus}
                  />
                  <dl className="detail-grid detail-grid-tight">
                    <Detail label="Created">{formatDateTime(request.createdAt)}</Detail>
                    <Detail label="Last updated">{formatDateTime(request.updatedAt)}</Detail>
                  </dl>
                </section>
                <section className="panel">
                  <NotesPanel notes={request.adminNotes} onAdd={addNote} />
                </section>
              </aside>
            </div>
          </>
        )}
      </DataState>
    </>
  );
}
