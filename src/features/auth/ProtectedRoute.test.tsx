import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthTestProvider, makeAuth } from '../../test/authTestUtils';
import type { AuthContextValue } from './authContext';
import { ProtectedRoute, resolveRouteAccess } from './ProtectedRoute';

function renderAt(auth: AuthContextValue, path: string) {
  return render(
    <AuthTestProvider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/login" element={<div>Login page</div>} />
          <Route path="/admin" element={<ProtectedRoute roles={['staff', 'admin']} />}>
            <Route path="dashboard" element={<div>Staff dashboard</div>} />
            <Route path="requests" element={<div>Staff requests</div>} />
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="users" element={<div>Admin: staff management</div>} />
              <Route path="audit" element={<div>Admin: audit log</div>} />
              <Route path="knowledge" element={<div>Admin: knowledge</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

describe('protected staff routes', () => {
  it.each(['/admin/dashboard', '/admin/requests', '/admin/users', '/admin/audit'])(
    'redirects a signed-out visitor from %s to /admin/login and never renders the page',
    (path) => {
      renderAt(makeAuth(null), path);
      expect(screen.getByText('Login page')).toBeTruthy();
      expect(screen.queryByText(/Staff dashboard|Staff requests|Admin:/)).toBeNull();
    },
  );

  it('redirects a signed-in but NOT authorized account (forbidden) to login', () => {
    renderAt(makeAuth(null, { status: 'forbidden' }), '/admin/dashboard');
    expect(screen.getByText('Login page')).toBeTruthy();
    expect(screen.queryByText('Staff dashboard')).toBeNull();
  });

  it('shows a loading state - not a redirect, not content - while the session is restored', () => {
    renderAt(makeAuth(null, { status: 'loading', loading: true }), '/admin/dashboard');
    expect(screen.getByText(/checking your session/i)).toBeTruthy();
    expect(screen.queryByText('Staff dashboard')).toBeNull();
    expect(screen.queryByText('Login page')).toBeNull();
  });

  it('lets staff into staff pages', () => {
    renderAt(makeAuth('staff'), '/admin/dashboard');
    expect(screen.getByText('Staff dashboard')).toBeTruthy();
  });

  it.each(['/admin/users', '/admin/audit', '/admin/knowledge'])('denies STAFF access to admin-only %s', (path) => {
    renderAt(makeAuth('staff'), path);
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeTruthy();
    expect(screen.queryByText(/Admin:/)).toBeNull();
  });

  it.each(['/admin/users', '/admin/audit', '/admin/knowledge'])('lets an ADMIN into admin-only %s', (path) => {
    renderAt(makeAuth('admin'), path);
    expect(screen.getByText(/Admin:/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Access denied' })).toBeNull();
  });

  it('lets an admin use staff pages too', () => {
    renderAt(makeAuth('admin'), '/admin/requests');
    expect(screen.getByText('Staff requests')).toBeTruthy();
  });
});

describe('resolveRouteAccess', () => {
  it('is a pure decision over status and role', () => {
    expect(resolveRouteAccess('loading', null, ['staff'])).toBe('wait');
    expect(resolveRouteAccess('unauthenticated', null, ['staff'])).toBe('login');
    expect(resolveRouteAccess('forbidden', null, ['staff'])).toBe('login');
    expect(resolveRouteAccess('authenticated', 'staff', ['staff', 'admin'])).toBe('allow');
    expect(resolveRouteAccess('authenticated', 'staff', ['admin'])).toBe('denied');
    expect(resolveRouteAccess('authenticated', 'admin', ['admin'])).toBe('allow');
    expect(resolveRouteAccess('authenticated', null, ['admin'])).toBe('denied');
  });
});
