import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DataState, EmptyState } from '../../components/DataState';
import { SelectField, TextField } from '../../components/Field';
import { ActiveBadge } from '../../components/StatusBadge';
import { AdminPageHeader, TableWrap } from '../../features/admin/AdminUi';
import { useAuth } from '../../features/auth/useAuth';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useFormState } from '../../hooks/useFormState';
import { sendPasswordSetupEmail } from '../../services/authService';
import { changeStaffRole, createStaff, listStaff, setStaffActive } from '../../services/staffService';
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRole } from '../../types';
import { AppError, toAppError } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';
import { createStaffSchema } from '../../validation/schemas';

const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({ value: r, label: STAFF_ROLE_LABELS[r] }));
const EMPTY = { displayName: '', email: '', role: 'staff' as string };

interface Notice {
  tone: 'success' | 'warning' | 'error';
  text: string;
  /** Set when the account exists but its setup email did not go out, so it can be re-sent. */
  resendTo?: string;
}

export function StaffManagementPage() {
  useDocumentTitle('Staff management');
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsyncData(listStaff);
  const [adding, setAdding] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const form = useFormState(EMPTY, createStaffSchema);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<AppError | null>(null);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const input = form.validate();
    if (!input) return;

    setSaving(true);
    try {
      await createStaff(input);
      let emailed = true;
      try {
        await sendPasswordSetupEmail(input.email);
      } catch {
        emailed = false;
      }
      setNotice(
        emailed
          ? { tone: 'success', text: `Account created for ${input.displayName}. A password setup email was sent to ${input.email}; they choose their own password.` }
          : {
              tone: 'warning',
              text: `Account created for ${input.displayName}, but the password setup email could not be sent. Use “Resend setup email” to try again.`,
              resendTo: input.email,
            },
      );
      form.reset();
      setAdding(false);
      await reload();
    } catch (e) {
      const appError = toAppError(e);
      form.setServerErrors(appError.fieldErrors);
      setFormError(appError);
    } finally {
      setSaving(false);
    }
  }

  async function run(uid: string, task: () => Promise<unknown>, success: string) {
    setNotice(null);
    setBusyUid(uid);
    try {
      await task();
      setNotice({ tone: 'success', text: success });
      await reload();
    } catch (e) {
      setNotice({ tone: 'error', text: toAppError(e).message });
    } finally {
      setBusyUid(null);
    }
  }

  function toggleRole(uid: string, name: string, current: StaffRole) {
    const next: StaffRole = current === 'admin' ? 'staff' : 'admin';
    if (!window.confirm(`Change ${name} to ${STAFF_ROLE_LABELS[next]}? They will be signed out and must sign in again.`)) return;
    void run(uid, () => changeStaffRole(uid, next), `${name} is now ${STAFF_ROLE_LABELS[next]}.`);
  }

  function toggleActive(uid: string, name: string, active: boolean) {
    const next = !active;
    if (!next && !window.confirm(`Deactivate ${name}? They will be signed out immediately and unable to sign in.`)) return;
    void run(uid, () => setStaffActive(uid, next), next ? `${name} has been reactivated.` : `${name} has been deactivated.`);
  }

  async function resend(email: string) {
    setNotice(null);
    try {
      await sendPasswordSetupEmail(email);
      setNotice({ tone: 'success', text: `Password setup email sent to ${email}.` });
    } catch (e) {
      setNotice({ tone: 'error', text: toAppError(e).message, resendTo: email });
    }
  }

  const { values, errors, setValue } = form;

  return (
    <>
      <AdminPageHeader
        title="Staff management"
        description="Create staff accounts, set roles, and deactivate access. There is no public sign-up - accounts exist only when an administrator creates them."
        actions={
          <Button size="sm" onClick={() => { setAdding((a) => !a); setFormError(null); }}>
            {adding ? 'Cancel' : 'Add staff member'}
          </Button>
        }
      />

      <div aria-live="polite">
        {notice && (
          <Alert
            tone={notice.tone}
            action={
              notice.resendTo ? (
                <Button size="sm" variant="secondary" onClick={() => void resend(notice.resendTo!)}>
                  Resend setup email
                </Button>
              ) : undefined
            }
          >
            {notice.text}
          </Alert>
        )}
      </div>

      {adding && (
        <section className="panel" aria-labelledby="add-staff-title">
          <h2 id="add-staff-title">Add staff member</h2>
          <p className="muted small">
            We create the account and email them a link to set their own password. You never see or choose their password.
          </p>
          <form onSubmit={onCreate} noValidate className="form-grid">
            {formError && !formError.fieldErrors && (
              <div className="span-2">
                <Alert tone="error">{formError.message}</Alert>
              </div>
            )}
            <TextField label="Full name" required autoComplete="off" value={values.displayName} error={errors.displayName} onChange={(e) => setValue('displayName', e.target.value)} />
            <TextField label="Email address" type="email" required autoComplete="off" value={values.email} error={errors.email} onChange={(e) => setValue('email', e.target.value)} />
            <SelectField label="Role" required options={ROLE_OPTIONS} value={values.role} error={errors.role} onChange={(e) => setValue('role', e.target.value)} />
            <div className="form-actions span-2">
              <Button type="submit" loading={saving}>
                Create account
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <DataState loading={loading && !data} error={error} onRetry={() => void reload()}>
          {(data ?? []).length === 0 ? (
            <EmptyState title="No staff accounts yet">Use “Add staff member” to create the first one.</EmptyState>
          ) : (
            <TableWrap label="Staff accounts">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col">Last login</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((s) => {
                    const isSelf = s.uid === user?.uid;
                    return (
                      <tr key={s.uid} className={s.active ? '' : 'is-inactive'}>
                        <td data-label="Name">
                          <strong>{s.displayName}</strong>
                          {isSelf && <span className="you-tag"> (you)</span>}
                        </td>
                        <td data-label="Email">{s.email}</td>
                        <td data-label="Role">{STAFF_ROLE_LABELS[s.role]}</td>
                        <td data-label="Status"><ActiveBadge active={s.active} /></td>
                        <td data-label="Created">{formatDateTime(s.createdAt)}</td>
                        <td data-label="Last login">{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : 'Never'}</td>
                        <td data-label="Actions">
                          <div className="row-actions">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isSelf}
                              title={isSelf ? 'You cannot change your own role' : undefined}
                              loading={busyUid === s.uid}
                              onClick={() => toggleRole(s.uid, s.displayName, s.role)}
                            >
                              {s.role === 'admin' ? 'Make staff' : 'Make admin'}
                              <span className="sr-only"> {s.displayName}</span>
                            </Button>
                            <Button
                              size="sm"
                              variant={s.active ? 'danger' : 'secondary'}
                              disabled={isSelf}
                              title={isSelf ? 'You cannot deactivate your own account' : undefined}
                              loading={busyUid === s.uid}
                              onClick={() => toggleActive(s.uid, s.displayName, s.active)}
                            >
                              {s.active ? 'Deactivate' : 'Reactivate'}
                              <span className="sr-only"> {s.displayName}</span>
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void resend(s.email)}>
                              Resend setup email<span className="sr-only"> to {s.displayName}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
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
