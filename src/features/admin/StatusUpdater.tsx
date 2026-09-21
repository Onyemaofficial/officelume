import { useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/Field';
import { AppError, toAppError } from '../../utils/errors';

interface StatusUpdaterProps<S extends string> {
  current: S;
  /** Statuses the current one may move to. */
  allowed: readonly S[];
  labels: Record<S, string>;
  onSave: (status: S) => Promise<void>;
  label?: string;
}

/** Select + save control that only offers valid transitions (the server enforces them too). */
export function StatusUpdater<S extends string>({ current, allowed, labels, onSave, label = 'Update status' }: StatusUpdaterProps<S>) {
  const [selected, setSelected] = useState<S | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      setSelected('');
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="status-updater">
      {error && <Alert tone="error">{error.message}</Alert>}
      <SelectField
        label={label}
        value={selected}
        placeholder={`Currently: ${labels[current]}`}
        options={allowed.map((s) => ({ value: s, label: labels[s] }))}
        onChange={(e) => setSelected(e.target.value as S | '')}
      />
      <Button size="sm" onClick={() => void save()} loading={saving} disabled={!selected}>
        Save status
      </Button>
    </div>
  );
}
