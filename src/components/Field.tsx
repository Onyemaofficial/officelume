import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  children: (describedBy: string | undefined) => ReactNode;
}

function FieldShell({ id, label, error, hint, required, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={error ? 'field field-invalid' : 'field'}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="field-required" aria-hidden="true"> *</span>}
      </label>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface CommonProps {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export function TextField({ label, error, hint, required, ...rest }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} required={required} {...(hint ? { hint } : {})}>
      {(describedBy) => (
        <input
          id={id}
          className="input"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, error, hint, required, ...rest }: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} required={required} {...(hint ? { hint } : {})}>
      {(describedBy) => (
        <textarea
          id={id}
          className="input textarea"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

interface SelectFieldProps extends CommonProps, SelectHTMLAttributes<HTMLSelectElement> {
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}

export function SelectField({ label, error, hint, required, options, placeholder, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} required={required} {...(hint ? { hint } : {})}>
      {(describedBy) => (
        <select
          id={id}
          className="input select"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string | undefined;
}

export function CheckboxField({ label, error, ...rest }: CheckboxFieldProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={error ? 'field field-invalid' : 'field'}>
      <div className="checkbox-row">
        <input id={id} type="checkbox" className="checkbox" aria-invalid={error ? true : undefined} aria-describedby={errorId} {...rest} />
        <label htmlFor={id}>{label}</label>
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface RadioGroupProps {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string | undefined;
}

export function RadioGroup({ legend, name, value, onChange, options, error }: RadioGroupProps) {
  const errorId = useId();
  return (
    <fieldset className={error ? 'field field-invalid radio-group' : 'field radio-group'} aria-describedby={error ? errorId : undefined}>
      <legend className="field-label">{legend}</legend>
      <div className="radio-options">
        {options.map((o) => (
          <label key={o.value} className={value === o.value ? 'radio-option is-selected' : 'radio-option'}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
