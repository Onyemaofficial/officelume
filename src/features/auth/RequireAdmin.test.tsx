import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { resolveAdminAccess } from './accessDecision';
import { AuthContext, type AuthState } from './authContext';
import { RequireAdmin } from './RequireAdmin';

const identity = { uid: 'u1', email: 'a@example.com', displayName: null };

function renderAt(state: AuthState, path = '/admin/dashboard') {
  return render(
    <AuthContext.Provider value={{ state, signIn: async () => undefined, signOut: async () => undefined }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/login" element={<div>Login page</div>} />
          <Route path="/admin" element={<RequireAdmin />}>
            <Route path="dashboard" element={<div>Secret dashboard</div>} />
            <Route path="requests" element={<div>Secret requests</div>} />
          </Route>
          <Route path="/" element={<div>Public home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('admin route protection', () => {
  it('redirects unauthenticated visitors to /admin/login and never renders admin content', () => {
    renderAt({ status: 'unauthenticated', sessionExpired: false });
    expect(screen.getByText('Login page')).toBeTruthy();
    expect(screen.queryByText('Secret dashboard')).toBeNull();
  });

  it.each(['/admin/dashboard', '/admin/requests'])('protects %s', (path) => {
    renderAt({ status: 'unauthenticated', sessionExpired: false }, path);
    expect(screen.getByText('Login page')).toBeTruthy();
  });

  it('redirects signed-in users who are not administrators', () => {
    renderAt({ status: 'forbidden', identity });
    expect(screen.getByText('Login page')).toBeTruthy();
    expect(screen.queryByText('Secret dashboard')).toBeNull();
  });

  it('shows a loading state (not admin content) while the session is being checked', () => {
    renderAt({ status: 'loading' });
    expect(screen.getByText(/checking your session/i)).toBeTruthy();
    expect(screen.queryByText('Secret dashboard')).toBeNull();
    expect(screen.queryByText('Login page')).toBeNull();
  });

  it('renders admin pages for a verified administrator', () => {
    renderAt({ status: 'admin', identity });
    expect(screen.getByText('Secret dashboard')).toBeTruthy();
  });

  it('exposes a pure access decision', () => {
    expect(resolveAdminAccess({ status: 'loading' })).toBe('wait');
    expect(resolveAdminAccess({ status: 'admin', identity })).toBe('allow');
    expect(resolveAdminAccess({ status: 'forbidden', identity })).toBe('login');
    expect(resolveAdminAccess({ status: 'unauthenticated', sessionExpired: true })).toBe('login');
  });
});
