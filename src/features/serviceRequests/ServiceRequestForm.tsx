import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { CheckboxField, RadioGroup, SelectField, TextAreaField, TextField } from '../../components/Field';
import { CONSENT_LABEL, PrivacyNotice } from '../../components/PrivacyNotice';
import { useFormState } from '../../hooks/useFormState';
import { submitServiceRequest } from '../../services/serviceRequestService';
import {
  CONTACT_METHOD_LABELS,
  CONTACT_METHODS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  TIME_WINDOWS,
  TIME_WINDOW_LABELS,
} from '../../types';
import { AppError, toAppError } from '../../utils/errors';
import { todayIso } from '../../utils/format';
import { serviceRequestSchema } from '../../validation/schemas';

const SERVICE_OPTIONS = SERVICE_TYPES.map((t) => ({ value: t, label: SERVICE_TYPE_LABELS[t] }));
const TIME_OPTIONS = TIME_WINDOWS.map((t) => ({ value: t, label: TIME_WINDOW_LABELS[t] }));
const CONTACT_OPTIONS = CONTACT_METHODS.map((m) => ({ value: m, label: CONTACT_METHOD_LABELS[m] }));

const EMPTY = {
  customerName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  zipCode: '',
  serviceType: '' as string,
  issueDescription: '',
  preferredDate: '',
  preferredTime: '' as string,
  preferredContactMethod: '' as string,
  consent: false,
  website: '',
};

export function ServiceRequestForm() {
  const form = useFormState(EMPTY, serviceRequestSchema);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const data = form.validate();
    if (!data) {
      // Move focus to the first invalid field so keyboard/screen-reader users land on it.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitServiceRequest(data);
      setRequestNumber(result.requestNumber);
    } catch (e) {
      const appError = toAppError(e);
      form.setServerErrors(appError.fieldErrors);
      setError(appError);
    } finally {
      setSubmitting(false);
    }
  }

  if (requestNumber) {
    return (
      <section className="card confirmation" aria-live="polite">
        <Alert tone="success" title="Your service request has been received.">
          Your request number is <strong className="ref-number">{requestNumber}</strong>. Please keep it for your records.
        </Alert>
        <div className="notice-box">
          <strong>What happens next</strong>
          <p>
            This is a <strong>service request, not a guaranteed appointment</strong>. A team member will review your
            request and contact you using your preferred method to discuss scheduling. Your preferred date and time are
            preferences only and have not been confirmed.
          </p>
        </div>
        <div className="form-actions">
          <ButtonLink to="/">Back to home</ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              form.reset();
              setRequestNumber(null);
            }}
          >
            Submit another request
          </Button>
        </div>
      </section>
    );
  }

  const { values, errors, setValue } = form;

  return (
    <form className="card request-form" onSubmit={onSubmit} noValidate aria-labelledby="request-heading">
      <PrivacyNotice purpose="service request" />

      {error && !error.fieldErrors && <Alert tone="error">{error.message}</Alert>}
      {error?.fieldErrors && <Alert tone="error">Please fix the highlighted fields and try again.</Alert>}

      <fieldset className="form-section">
        <legend>Your details</legend>
        <div className="form-grid">
          <TextField label="Full name" required autoComplete="name" value={values.customerName} error={errors.customerName} onChange={(e) => setValue('customerName', e.target.value)} />
          <TextField label="Phone number" required type="tel" autoComplete="tel" value={values.phone} error={errors.phone} onChange={(e) => setValue('phone', e.target.value)} />
          <div className="span-2">
            <TextField label="Email address" required type="email" autoComplete="email" value={values.email} error={errors.email} onChange={(e) => setValue('email', e.target.value)} />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Service location</legend>
        <div className="form-grid">
          <div className="span-2">
            <TextField label="Service address" required autoComplete="street-address" value={values.address} error={errors.address} onChange={(e) => setValue('address', e.target.value)} />
          </div>
          <TextField label="City" required autoComplete="address-level2" value={values.city} error={errors.city} onChange={(e) => setValue('city', e.target.value)} />
          <TextField label="ZIP code" required inputMode="numeric" autoComplete="postal-code" value={values.zipCode} error={errors.zipCode} onChange={(e) => setValue('zipCode', e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>About the service</legend>
        <div className="form-grid">
          <div className="span-2">
            <SelectField label="Service type" required placeholder="Select a service…" options={SERVICE_OPTIONS} value={values.serviceType} error={errors.serviceType} onChange={(e) => setValue('serviceType', e.target.value)} />
          </div>
          <div className="span-2">
            <TextAreaField
              label="Describe the issue"
              required
              rows={4}
              maxLength={2000}
              hint="What is happening, and since when? Please don’t include payment or medical information."
              value={values.issueDescription}
              error={errors.issueDescription}
              onChange={(e) => setValue('issueDescription', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Preferences</legend>
        <div className="form-grid">
          <TextField label="Preferred date" required type="date" min={todayIso()} value={values.preferredDate} error={errors.preferredDate} onChange={(e) => setValue('preferredDate', e.target.value)} />
          <SelectField label="Preferred time window" required placeholder="Select a time window…" options={TIME_OPTIONS} value={values.preferredTime} error={errors.preferredTime} onChange={(e) => setValue('preferredTime', e.target.value)} />
          <div className="span-2">
            <RadioGroup legend="Preferred contact method *" name="request-contact" value={values.preferredContactMethod} onChange={(v) => setValue('preferredContactMethod', v)} options={CONTACT_OPTIONS} error={errors.preferredContactMethod} />
          </div>
        </div>
        <p className="muted small">Dates and times are preferences only. OfficeLume cannot guarantee availability until a team member confirms with you.</p>
      </fieldset>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div className="hp-field" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => setValue('website', e.target.value)} />
        </label>
      </div>

      <CheckboxField label={CONSENT_LABEL} checked={values.consent} error={errors.consent} onChange={(e) => setValue('consent', e.target.checked)} />

      <div className="form-actions">
        <Button type="submit" size="lg" loading={submitting}>
          Submit service request
        </Button>
      </div>
    </form>
  );
}
