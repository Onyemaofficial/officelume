import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextAreaField } from '../../components/Field';
import type { AdminNote } from '../../types';
import { AppError, toAppError } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';
import { noteSchema } from '../../validation/schemas';

interface NotesPanelProps {
  notes: AdminNote[];
  onAdd: (note: string) => Promise<void>;
}

/** Internal administrator notes (never shown to customers). */
export function NotesPanel({ notes, onAdd }: NotesPanelProps) {
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<AppError | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = noteSchema.safeParse(draft);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a note.');
      return;
    }
    setFieldError(undefined);
    setSaving(true);
    try {
      await onAdd(parsed.data);
      setDraft('');
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="notes-panel">
      <h3>Internal notes</h3>
      {notes.length === 0 ? (
        <p className="muted small">No notes yet.</p>
      ) : (
        <ul className="notes-list">
          {[...notes].reverse().map((n, i) => (
            <li key={`${n.createdAt?.getTime() ?? i}-${i}`}>
              <p>{n.note}</p>
              <span className="muted small">
                {n.authorEmail ?? 'Administrator'} · {formatDateTime(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}
        <TextAreaField label="Add a note" rows={3} maxLength={1000} value={draft} error={fieldError} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" size="sm" loading={saving} disabled={draft.trim().length === 0}>
          Save note
        </Button>
      </form>
    </div>
  );
}
