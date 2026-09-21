import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { DataState, EmptyState } from '../../components/DataState';
import { SelectField, TextField } from '../../components/Field';
import { AdminPageHeader, TableWrap } from '../../features/admin/AdminUi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { listAuditLogs } from '../../services/auditService';
import { AUDIT_EVENT_TYPES } from '../../types';
import { formatDateTime, humanize } from '../../utils/format';

const EVENT_OPTIONS = AUDIT_EVENT_TYPES.map((t) => ({ value: t, label: humanize(t.toLowerCase()) }));

export function AuditPage() {
  useDocumentTitle('Audit log');
  const { data, loading, error, reload } = useAsyncData(() => listAuditLogs(200));
  const [eventType, setEventType] = useState('');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data ?? []).filter((l) => {
      if (eventType && l.eventType !== eventType) return false;
      if (!needle) return true;
      return [l.actorId, l.targetId, l.action, JSON.stringify(l.metadata)].join(' ').toLowerCase().includes(needle);
    });
  }, [data, eventType, search]);

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Traceability for administrator, AI, request, and escalation events. Passwords and customer contact details are never logged."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void reload()} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />

      <section className="panel" aria-label="Filters">
        <div className="filter-bar filter-bar-compact" role="search">
          <SelectField label="Event type" placeholder="All events" options={EVENT_OPTIONS} value={eventType} onChange={(e) => setEventType(e.target.value)} />
          <TextField label="Search" type="search" placeholder="Actor, target, action, details" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </section>

      <section className="panel">
        <DataState loading={loading && !data} error={error} onRetry={() => void reload()}>
          {rows.length === 0 ? (
            <EmptyState title="No audit events to show" />
          ) : (
            <TableWrap label="Audit events">
              <table className="table table-dense">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Event</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Target</th>
                    <th scope="col">Action</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td data-label="Time">{formatDateTime(l.timestamp)}</td>
                      <td data-label="Event"><code className="event-code">{l.eventType}</code></td>
                      <td data-label="Actor">{l.actorType}{l.actorId && l.actorId !== 'anonymous' ? ` · ${l.actorId.slice(0, 10)}` : ''}</td>
                      <td data-label="Target">{l.targetType} · {l.targetId.slice(0, 12)}</td>
                      <td data-label="Action">{l.action}</td>
                      <td data-label="Details" className="cell-clip cell-wide">
                        {Object.entries(l.metadata).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') || '-'}
                      </td>
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
