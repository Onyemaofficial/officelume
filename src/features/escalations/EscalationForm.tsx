import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { CheckboxField, RadioGroup, TextAreaField, TextField } from '../../components/Field';
import { CONSENT_LABEL, PrivacyNotice } from '../../components/PrivacyNotice';
import { useFormState } from '../../hooks/useFormState';
import { submitEscalation } from '../../services/escalationService';
import { CONTACT_METHOD_LABELS, CONTACT_METHODS } from '../../types';
import { AppError, toAppError } from '../../utils/errors';
import { escalationSchema } from '../../validation/schemas';

interface EscalationFormProps {
  initialQuestion?: string;
  sessionId?: string | undefined;
  onClose: () => void;
}

const CONTACT_OPTIONS = CONTACT_METHODS.map((m) => ({ value: m, label: CONTACT_METHOD_LABELS[m] }));

export function EscalationForm({ initialQuestion = '', sessionId, onClose }: EscalationFormProps) {
  const [initial] = useState(() => ({
    customerName: '',
    phone: '',
    email: '',
    preferredContactMethod: '' as string,
    originalQuestion: initialQuestion,
    additionalDetails: '',
    consent: false,
    website: '',
  }));
  const form = useFormState(initial, escalationSchema);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const data = form.validate();
    if (!data) return;

    setSubmitting(true);
    try {
      const result = await submitEscalation(data, sessionId);
      setConfirmation(result.escalationNumber);
    } catch (e) {
      const appError = toAppError(e);
      form.setServerErrors(appError.fieldErrors);
      setError(appError);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <section className="card help-card" aria-live="polite">
        <Alert tone="success" title="Your request has been sent to a team member.">
          Your reference number is <strong className="ref-number">{confirmation}</strong>. A team member will review it and
          follow up using your preferred contact method. This is a request for follow-up - not a scheduled appointment.
        </Alert>
        <div className="form-actions">
          <Button onClick={onClose}>Back to chat</Button>
        </div>
      </section>
    );
  }

  const { values, errors, setValue } = form;

  return (
    <section className="card help-card" id="help" aria-labelledby="help-title">
      <header className="card-header">
        <div>
          <h2 id="help-title" tabIndex={-1}>
            Request human help
          </h2>
          <p className="muted">Tell us how to reach you and a team member will follow up.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </header>

      <PrivacyNotice purpose="human help request" />

      <form onSubmit={onSubmit} noValidate className="form-grid">
        {error && !error.fieldErrors && <Alert tone="error">{error.message}</Alert>}

        <TextField label="Full name" required autoComplete="name" value={values.customerName} error={errors.customerName} onChange={(e) => setValue('customerName', e.target.value)} />
        <TextField label="Phone" required type="tel" autoComplete="tel" value={values.phone} error={errors.phone} onChange={(e) => setValue('phone', e.target.value)} />
        <TextField label="Email" required type="email" autoComplete="email" value={values.email} error={errors.email} onChange={(e) => setValue('email', e.target.value)} />
        <RadioGroup
          legend="Preferred contact method *"
          name="escalation-contact"
          value={values.preferredContactMethod}
          onChange={(v) => setValue('preferredContactMethod', v)}
          options={CONTACT_OPTIONS}
          error={errors.preferredContactMethod}
        />
        <div className="span-2">
          <TextAreaField label="Your question" required rows={3} maxLength={1000} value={values.originalQuestion} error={errors.originalQuestion} onChange={(e) => setValue('originalQuestion', e.target.value)} />
        </div>
        <div className="span-2">
          <TextAreaField label="Additional details (optional)" rows={3} maxLength={1000} value={values.additionalDetails} error={errors.additionalDetails} onChange={(e) => setValue('additionalDetails', e.target.value)} />
        </div>

        {/* Honeypot: hidden from people, tempting to bots. */}
        <div className="hp-field" aria-hidden="true">
          <label>
            Website
            <input type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => setValue('website', e.target.value)} />
          </label>
        </div>

        <div className="span-2">
          <CheckboxField label={CONSENT_LABEL} checked={values.consent} error={errors.consent} onChange={(e) => setValue('consent', e.target.checked)} />
        </div>

        <div className="form-actions span-2">
          <Button type="submit" loading={submitting}>
            Send to a team member
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
