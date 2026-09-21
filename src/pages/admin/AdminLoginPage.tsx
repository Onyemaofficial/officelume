import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { ConfigNotice } from '../../components/ConfigNotice';
import { useAuth } from '../../features/auth/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { toAppError } from '../../utils/errors';
import { flattenIssues, loginSchema } from '../../validation/schemas';

export function AdminLoginPage() {
  useDocumentTitle('Staff sign in');
  const { state, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && from.startsWith('/admin') && from !== '/admin/login' ? from : '/admin/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already an administrator (and not mid sign-in): skip the form.
  if (state.status === 'admin' && !submitting) {
    return <Navigate to={destination} replace />;
  }

  async function onSubmit(event: FormEvent) {
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
      await signIn(parsed.data.email, parsed.data.password);
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(toAppError(error).message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  const sessionExpired = state.status === 'unauthenticated' && state.sessionExpired;

  return (
    <div className="login-page">
      <ConfigNotice />
      <div className="login-card">
        <Link to="/" className="login-brand" aria-label="OfficeLume home">
          <Logo tagline />
        </Link>
        <h1>Staff sign in</h1>
        <p className="muted">Authorized OfficeLume administrators only.</p>

        {sessionExpired && <Alert tone="warning">Your session has expired. Please sign in again.</Alert>}
        {state.status === 'forbidden' && (
          <Alert
            tone="error"
            title="Not authorized"
            action={
              <Button size="sm" variant="secondary" onClick={() => void signOut()}>
                Sign out
              </Button>
            }
          >
            You’re signed in, but this account does not have administrator access.
          </Alert>
        )}
        {formError && <Alert tone="error">{formError}</Alert>}

        <form onSubmit={onSubmit} noValidate className="login-form">
          <TextField label="Email" type="email" autoComplete="username" required value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" autoComplete="current-password" required value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" size="lg" loading={submitting}>
            Sign in
          </Button>
        </form>
        <p className="small muted">
          <Link to="/">← Back to the public site</Link>
        </p>
      </div>
    </div>
  );
}
