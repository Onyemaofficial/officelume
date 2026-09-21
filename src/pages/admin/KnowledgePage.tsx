import { useMemo, useState, type FormEvent } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DataState, EmptyState } from '../../components/DataState';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../../components/Field';
import { ActiveBadge } from '../../components/StatusBadge';
import { AdminPageHeader, TableWrap } from '../../features/admin/AdminUi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useFormState } from '../../hooks/useFormState';
import { listKnowledge, saveKnowledge } from '../../services/knowledgeService';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_LABELS, type KnowledgeArticle, type KnowledgeCategory } from '../../types';
import { AppError, toAppError } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';
import { knowledgeSchema } from '../../validation/schemas';

const CATEGORY_OPTIONS = KNOWLEDGE_CATEGORIES.map((c) => ({ value: c, label: KNOWLEDGE_CATEGORY_LABELS[c] }));

interface EditorProps {
  article: KnowledgeArticle | null;
  onSaved: () => void;
  onCancel: () => void;
}

function KnowledgeEditor({ article, onSaved, onCancel }: EditorProps) {
  const [initial] = useState(() => ({
    title: article?.title ?? '',
    category: (article?.category ?? '') as string,
    content: article?.content ?? '',
    active: article?.active ?? true,
  }));
  const form = useFormState(initial, knowledgeSchema);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const data = form.validate();
    if (!data) return;
    setSaving(true);
    try {
      await saveKnowledge(data, article?.id);
      onSaved();
    } catch (e) {
      const appError = toAppError(e);
      form.setServerErrors(appError.fieldErrors);
      setError(appError);
    } finally {
      setSaving(false);
    }
  }

  const { values, errors, setValue } = form;
  return (
    <section className="panel" aria-labelledby="editor-title">
      <h2 id="editor-title">{article ? 'Edit knowledge article' : 'New knowledge article'}</h2>
      <p className="muted small">
        Only active articles are used by the AI receptionist. Write facts the business has approved - never include prices,
        discounts, or guarantees unless they are real and current.
      </p>
      <form onSubmit={submit} noValidate className="form-grid">
        {error && !error.fieldErrors && (
          <div className="span-2">
            <Alert tone="error">{error.message}</Alert>
          </div>
        )}
        <TextField label="Title" required value={values.title} error={errors.title} onChange={(e) => setValue('title', e.target.value)} />
        <SelectField label="Category" required placeholder="Select a category…" options={CATEGORY_OPTIONS} value={values.category} error={errors.category} onChange={(e) => setValue('category', e.target.value)} />
        <div className="span-2">
          <TextAreaField label="Content" required rows={6} maxLength={3000} value={values.content} error={errors.content} onChange={(e) => setValue('content', e.target.value)} />
        </div>
        <div className="span-2">
          <CheckboxField label="Active (available to the AI receptionist)" checked={values.active} onChange={(e) => setValue('active', e.target.checked)} />
        </div>
        <div className="form-actions span-2">
          <Button type="submit" loading={saving}>{article ? 'Save changes' : 'Create article'}</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </section>
  );
}

export function KnowledgePage() {
  useDocumentTitle('Knowledge base');
  const { data, loading, error, reload } = useAsyncData(listKnowledge);
  const [editing, setEditing] = useState<KnowledgeArticle | 'new' | null>(null);
  const [category, setCategory] = useState<KnowledgeCategory | ''>('');
  const [showInactive, setShowInactive] = useState(true);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () => (data ?? []).filter((a) => (!category || a.category === category) && (showInactive || a.active)),
    [data, category, showInactive],
  );

  async function toggleActive(article: KnowledgeArticle) {
    setRowError(null);
    setBusyId(article.id);
    try {
      await saveKnowledge(
        { title: article.title, category: article.category, content: article.content, active: !article.active },
        article.id,
      );
      await reload();
    } catch (e) {
      setRowError(toAppError(e).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Knowledge base"
        description="The approved business information OfficeLume’s AI receptionist is allowed to use."
        actions={<Button size="sm" onClick={() => setEditing('new')}>New article</Button>}
      />

      {editing && (
        <KnowledgeEditor
          key={editing === 'new' ? 'new' : editing.id}
          article={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}

      <section className="panel" aria-label="Filters">
        <div className="filter-bar filter-bar-compact">
          <SelectField label="Category" placeholder="All categories" options={CATEGORY_OPTIONS} value={category} onChange={(e) => setCategory(e.target.value as KnowledgeCategory | '')} />
          <CheckboxField label="Show inactive articles" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        </div>
      </section>

      <section className="panel">
        {rowError && <Alert tone="error">{rowError}</Alert>}
        <DataState loading={loading && !data} error={error} onRetry={() => void reload()}>
          {rows.length === 0 ? (
            <EmptyState title="No knowledge articles">
              {data && data.length === 0 ? 'Run the seed script or create the first article. Without active articles, every question is escalated to a person.' : 'No articles match these filters.'}
            </EmptyState>
          ) : (
            <TableWrap label="Knowledge articles">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Category</th>
                    <th scope="col">Content</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className={a.active ? '' : 'is-inactive'}>
                      <td data-label="Title"><strong>{a.title}</strong></td>
                      <td data-label="Category">{KNOWLEDGE_CATEGORY_LABELS[a.category] ?? a.category}</td>
                      <td data-label="Content" className="cell-clip cell-wide">{a.content}</td>
                      <td data-label="Status"><ActiveBadge active={a.active} /></td>
                      <td data-label="Updated">{formatDateTime(a.updatedAt)}</td>
                      <td data-label="Actions">
                        <div className="row-actions">
                          <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>
                            Edit<span className="sr-only"> {a.title}</span>
                          </Button>
                          <Button size="sm" variant={a.active ? 'danger' : 'secondary'} loading={busyId === a.id} onClick={() => void toggleActive(a)}>
                            {a.active ? 'Deactivate' : 'Activate'}<span className="sr-only"> {a.title}</span>
                          </Button>
                        </div>
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
