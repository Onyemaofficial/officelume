import { useId, useState, type InputHTMLAttributes } from 'react';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string | undefined;
}

/** Password input with an accessible show/hide toggle. Label is always visible (never placeholder-only). */
export function PasswordField({ label, error, required, ...rest }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={error ? 'field field-invalid' : 'field'}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="field-required" aria-hidden="true"> *</span>}
      </label>
      <div className="password-wrap">
        <input
          id={id}
          className="input password-input"
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...rest}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
