import { Fragment, useState } from 'react';
import { Button } from '../../components/Button';
import { DataState, EmptyState } from '../../components/DataState';
import { SelectField } from '../../components/Field';
import { StatusBadge } from '../../components/StatusBadge';
import { AdminPageHeader, TableWrap } from '../../features/admin/AdminUi';
import { NotesPanel } from '../../features/admin/NotesPanel';
import { StatusUpdater } from '../../features/admin/StatusUpdater';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { listEscalations, updateEscalation } from '../../services/escalationService';
import {
  CONTACT_METHOD_LABELS,
  ESCALATION_STATUSES,
  ESCALATION_STATUS_LABELS,
  ESCALATION_TRANSITIONS,
  type Escalation,
  type EscalationStatus,
} from '../../types';
import { formatDateTime } from '../../utils/format';

const STATUS_OPTIONS = ESCALATION_STATUSES.map((s) => ({ value: s, label: ESCALATION_STATUS_LABELS[s] }));

export function EscalationsPage() {
  useDocumentTitle('Escalations');
  const { data, loading, error, reload } = useAsyncData(() => listEscalations(200));
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows: Escalation[] = (data ?? []).filter((e) => !statusFilter || e.status === statusFilter);

  async function changeStatus(escalation: Escalation, status: EscalationStatus) {
    await updateEscalation({ escalationId: escalation.id, status });
    await reload();
  }
  async function addNote(escalation: Escalation, note: string) {
    await updateEscalation({ escalationId: escalation.id, note });
    await reload();
  }

  return (
    <>
      <AdminPageHeader
        title="Escalations"
        description="Questions the AI could not answer from approved knowledge, and requests for a person."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void reload()} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />

      <section className="panel" aria-label="Filters">
        <div className="filter-bar filter-bar-compact">
          <SelectField
            label="Status"
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EscalationStatus | '')}
          />
        </div>
      </section>

      <section className="panel">
        <DataState loading={loading && !data} error={error} onRetry={() => void reload()}>
          {rows.length === 0 ? (
            <EmptyState title="No escalations to show">Questions the AI can’t answer will appear here.</EmptyState>
          ) : (
            <TableWrap label="Escalations">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Escalation #</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Original question</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Contact method</th>
                    <th scope="col">Created</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const isOpen = openId === e.id;
                    return (
                      <Fragment key={e.id}>
                        <tr>
                          <td data-label="Escalation #">{e.escalationNumber}</td>
                          <td data-label="Customer">{e.customerName}</td>
                          <td data-label="Original question" className="cell-clip">{e.originalQuestion}</td>
                          <td data-label="Reason" className="cell-clip">{e.reason}</td>
                          <td data-label="Contact method">{CONTACT_METHOD_LABELS[e.preferredContactMethod]}</td>
                          <td data-label="Created">{formatDateTime(e.createdAt)}</td>
                          <td data-label="Status"><StatusBadge status={e.status} /></td>
                          <td data-label="Details">
                            <Button size="sm" variant="secondary" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : e.id)}>
                              {isOpen ? 'Hide' : 'Manage'}
                              <span className="sr-only"> {e.escalationNumber}</span>
                            </Button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="row-detail">
                            <td colSpan={8}>
                              <div className="escalation-detail">
                                <dl className="detail-grid">
                                  <div className="detail"><dt>Phone</dt><dd><a href={`tel:${e.phone}`}>{e.phone}</a></dd></div>
                                  <div className="detail"><dt>Email</dt><dd><a href={`mailto:${e.email}`}>{e.email}</a></dd></div>
                                  <div className="detail span-2"><dt>Question</dt><dd className="pre-wrap">{e.originalQuestion}</dd></div>
                                  {e.additionalDetails && <div className="detail span-2"><dt>Additional details</dt><dd className="pre-wrap">{e.additionalDetails}</dd></div>}
                                  <div className="detail span-2"><dt>Escalation reason</dt><dd>{e.reason}</dd></div>
                                </dl>
                                <div className="escalation-controls">
                                  <StatusUpdater
                                    current={e.status}
                                    allowed={ESCALATION_TRANSITIONS[e.status]}
                                    labels={ESCALATION_STATUS_LABELS}
                                    onSave={(status) => changeStatus(e, status)}
                                  />
                                  <NotesPanel notes={e.adminNotes} onAdd={(note) => addNote(e, note)} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </DataState>
      </section>
    </>
  );
}
