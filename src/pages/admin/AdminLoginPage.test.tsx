import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_MESSAGES, RESET_CONFIRMATION } from '../../features/auth/loginErrors';
import { AuthTestProvider, makeAuth } from '../../test/authTestUtils';
import type { AuthContextValue } from '../../features/auth/authContext';
import { AppError } from '../../utils/errors';
import { AdminLoginPage } from './AdminLoginPage';

vi.mock('../../firebase/config', () => ({ isFirebaseConfigured: true }));

function renderLogin(auth: AuthContextValue, entry: string | { pathname: string; state: unknown } = '/admin/login') {
  return render(
    <AuthTestProvider value={auth}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<div>Staff dashboard</div>} />
          <Route path="/admin/requests" element={<div>Requests page</div>} />
          <Route path="/" element={<div>Public home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } });
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

describe('staff login page', () => {
  let signedOut: AuthContextValue;
  beforeEach(() => {
    signedOut = makeAuth(null);
  });

  it('shows the OfficeLume staff sign-in copy and no sign-up, registration, or social login', () => {
    renderLogin(signedOut);
    expect(screen.getByRole('heading', { name: 'Staff Sign In' })).toBeTruthy();
    expect(screen.getByText('Sign in to manage service requests, escalations, and OfficeLume operations.')).toBeTruthy();
    expect(screen.getByText('Authorized OfficeLume staff only.')).toBeTruthy();
    // Tagline appears with the logo and again in the footer.
    expect(screen.getAllByText('Less admin. More service.').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/sign up|create account|register|google|facebook|microsoft/i)).toBeNull();
  });

  it('uses real labels, a password field, a remember-me checkbox, and a forgot-password control', () => {
    renderLogin(signedOut);
    expect(screen.getByLabelText(/Email address/)).toBeTruthy();
    expect((screen.getByLabelText(/^Password/) as HTMLInputElement).type).toBe('password');
    expect(screen.getByRole('checkbox', { name: 'Remember me' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeTruthy();
  });

  it('toggles password visibility with an accessible button', () => {
    renderLogin(signedOut);
    const input = screen.getByLabelText(/^Password/) as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });

  it('validates the fields before calling Firebase', () => {
    renderLogin(signedOut);
    submit();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(signedOut.login).not.toHaveBeenCalled();

    fill('not-an-email', 'secret');
    submit();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(signedOut.login).not.toHaveBeenCalled();
  });

  it('signs a valid STAFF member in (normalising the email) and goes to the dashboard', async () => {
    renderLogin(signedOut);
    fill('  Pat@Example.com ', 'correct horse');
    submit();
    await screen.findByText('Staff dashboard');
    expect(signedOut.login).toHaveBeenCalledWith('pat@example.com', 'correct horse', false);
  });

  it('signs a valid ADMIN in the same way, passing the remember-me choice', async () => {
    renderLogin(signedOut);
    fill('alex@example.com', 'correct horse');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remember me' }));
    submit();
    await screen.findByText('Staff dashboard');
    expect(signedOut.login).toHaveBeenCalledWith('alex@example.com', 'correct horse', true);
  });

  it('returns the user to the page they originally requested', async () => {
    renderLogin(signedOut, { pathname: '/admin/login', state: { from: '/admin/requests' } });
    fill('pat@example.com', 'pw');
    submit();
    await screen.findByText('Requests page');
  });

  it('never redirects to an external or non-admin destination', async () => {
    renderLogin(signedOut, { pathname: '/admin/login', state: { from: 'https://evil.example/phish' } });
    fill('pat@example.com', 'pw');
    submit();
    await screen.findByText('Staff dashboard');
  });

  it('shows the friendly message for a wrong password and clears the password field', async () => {
    (signedOut.login as ReturnType<typeof vi.fn>).mockRejectedValue(new AppError('unauthorized', LOGIN_MESSAGES.invalidCredentials));
    renderLogin(signedOut);
    fill('pat@example.com', 'wrong');
    submit();
    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
    expect((screen.getByLabelText(/^Password/) as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('Staff dashboard')).toBeNull();
  });

  it('shows the not-authorized message for an unauthorized Firebase account', async () => {
    (signedOut.login as ReturnType<typeof vi.fn>).mockRejectedValue(new AppError('unauthorized', LOGIN_MESSAGES.notAuthorized));
    renderLogin(signedOut);
    fill('customer@example.com', 'pw');
    submit();
    expect(await screen.findByText('This account is not authorized to access the OfficeLume staff portal.')).toBeTruthy();
    expect(screen.queryByText('Staff dashboard')).toBeNull();
  });

  it('shows the inactive-account message for a disabled account', async () => {
    (signedOut.login as ReturnType<typeof vi.fn>).mockRejectedValue(new AppError('unauthorized', LOGIN_MESSAGES.inactive));
    renderLogin(signedOut);
    fill('old@example.com', 'pw');
    submit();
    expect(await screen.findByText('This account is currently inactive. Contact an administrator.')).toBeTruthy();
  });

  it('shows network and rate-limit messages without leaking internals', async () => {
    const login = signedOut.login as ReturnType<typeof vi.fn>;
    login.mockRejectedValueOnce(new AppError('unavailable', LOGIN_MESSAGES.network));
    renderLogin(signedOut);
    fill('pat@example.com', 'pw');
    submit();
    expect(await screen.findByText('Unable to connect. Check your internet connection and try again.')).toBeTruthy();

    login.mockRejectedValueOnce(new AppError('rate-limited', LOGIN_MESSAGES.tooManyAttempts));
    fill('pat@example.com', 'pw');
    submit();
    expect(await screen.findByText('Too many unsuccessful sign-in attempts. Please try again later.')).toBeTruthy();
  });

  it('shows a generic message for unexpected errors (no raw text)', async () => {
    (signedOut.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('TypeError: cannot read properties of undefined'));
    renderLogin(signedOut);
    fill('pat@example.com', 'pw');
    submit();
    expect(await screen.findByText('Unable to sign in at this time. Please try again.')).toBeTruthy();
    expect(screen.queryByText(/TypeError/)).toBeNull();
  });

  it('skips the form and goes to the dashboard when already signed in as staff', () => {
    renderLogin(makeAuth('staff'));
    expect(screen.getByText('Staff dashboard')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Staff Sign In' })).toBeNull();
  });

  it('tells a signed-in but unauthorized account it is not authorized and offers sign out', () => {
    const forbidden = makeAuth(null, { status: 'forbidden' });
    renderLogin(forbidden);
    expect(screen.getByText(LOGIN_MESSAGES.notAuthorized)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(forbidden.logout).toHaveBeenCalled();
  });

  it('explains an expired session', () => {
    renderLogin(makeAuth(null, { sessionExpired: true }));
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });
});

describe('forgot password', () => {
  it('sends a reset and shows the SAME generic confirmation regardless of the address', async () => {
    const auth = makeAuth(null);
    renderLogin(auth);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'anyone@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));

    expect(await screen.findByText(RESET_CONFIRMATION)).toBeTruthy();
    expect(auth.resetPassword).toHaveBeenCalledWith('anyone@example.com');
    expect(RESET_CONFIRMATION).toBe('If an eligible account exists for that email address, a password reset email has been sent.');
  });

  it('validates the address first and can return to sign in', async () => {
    const auth = makeAuth(null);
    renderLogin(auth);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(auth.resetPassword).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Back to sign in/ }));
    expect(screen.getByRole('heading', { name: 'Staff Sign In' })).toBeTruthy();
  });

  it('only reports a genuine connectivity problem', async () => {
    const auth = makeAuth(null, { resetPassword: vi.fn().mockRejectedValue(new AppError('unavailable', LOGIN_MESSAGES.network)) });
    renderLogin(auth);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
    await waitFor(() => expect(screen.getByText(LOGIN_MESSAGES.network)).toBeTruthy());
    expect(screen.queryByText(RESET_CONFIRMATION)).toBeNull();
  });
});
