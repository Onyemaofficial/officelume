import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfigNotice } from '../../components/ConfigNotice';
import { CheckboxField, TextField } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { PasswordField } from '../../components/PasswordField';
import { LOGIN_MESSAGES, RESET_CONFIRMATION, mapLoginError } from '../../features/auth/loginErrors';
import { useAuth } from '../../features/auth/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { emailSchema, flattenIssues, loginSchema } from '../../validation/schemas';

type View = 'signin' | 'reset';

export function AdminLoginPage() {
  useDocumentTitle('Staff sign in');
  const { status, sessionExpired, login, logout, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && from.startsWith('/admin') && from !== '/admin/login' ? from : '/admin/dashboard';

  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already an authorized staff member (and not mid sign-in): skip the form.
  if (status === 'authenticated' && !submitting) {
    return <Navigate to={destination} replace />;
  }

  function switchView(next: View) {
    setView(next);
    setErrors({});
    setFormError(null);
    setResetNotice(null);
  }

  async function onSignIn(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password, remember);
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(mapLoginError(error).message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  async function onReset(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setResetNotice(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await resetPassword(parsed.data);
      // Identical response whether or not the address belongs to an account.
      setResetNotice(RESET_CONFIRMATION);
    } catch (error) {
      setFormError(mapLoginError(error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <ConfigNotice />
      <div className="login-card">
        <Link to="/" className="login-brand" aria-label="OfficeLume home">
          <Logo tagline />
        </Link>

        {view === 'signin' ? (
          <>
            <h1>Staff Sign In</h1>
            <p className="muted">Sign in to manage service requests, escalations, and OfficeLume operations.</p>

            {sessionExpired && <Alert tone="warning">Your session has expired. Please sign in again.</Alert>}
            {status === 'forbidden' && (
              <Alert
                tone="error"
                action={
                  <Button size="sm" variant="secondary" onClick={() => void logout()}>
                    Sign out
                  </Button>
                }
              >
                {LOGIN_MESSAGES.notAuthorized}
              </Alert>
            )}
            <div aria-live="polite">{formError && <Alert tone="error">{formError}</Alert>}</div>

            <form onSubmit={onSignIn} noValidate className="login-form">
              <TextField
                label="Email address"
                type="email"
                autoComplete="username"
                required
                value={email}
                error={errors.email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordField
                label="Password"
                autoComplete="current-password"
                required
                value={password}
                error={errors.password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="login-options">
                <CheckboxField label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <button type="button" className="link-button" onClick={() => switchView('reset')}>
                  Forgot password?
                </button>
              </div>
              <Button type="submit" size="lg" loading={submitting}>
                Sign In
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1>Reset your password</h1>
            <p className="muted">Enter your work email address and we&rsquo;ll send you a link to choose a new password.</p>

            <div aria-live="polite">
              {resetNotice && <Alert tone="success">{resetNotice}</Alert>}
              {formError && <Alert tone="error">{formError}</Alert>}
            </div>

            <form onSubmit={onReset} noValidate className="login-form">
              <TextField
                label="Email address"
                type="email"
                autoComplete="username"
                required
                value={email}
                error={errors.email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="lg" loading={submitting}>
                Send reset email
              </Button>
              <Button variant="ghost" onClick={() => switchView('signin')}>
                ← Back to sign in
              </Button>
            </form>
          </>
        )}

        <p className="login-authorized">Authorized OfficeLume staff only.</p>
        <p className="small muted">
          <Link to="/">← Back to the public site</Link>
        </p>
      </div>
      <footer className="login-footer">
        <span>&copy; OfficeLume</span>
        <span>Less admin. More service.</span>
      </footer>
    </div>
  );
}
