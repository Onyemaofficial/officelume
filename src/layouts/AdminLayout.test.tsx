import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthTestProvider, makeAuth } from '../test/authTestUtils';
import type { AuthContextValue } from '../features/auth/authContext';
import { AdminLayout } from './AdminLayout';

vi.mock('../firebase/config', () => ({ isFirebaseConfigured: true }));

function renderLayout(auth: AuthContextValue) {
  return render(
    <AuthTestProvider value={auth}>
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

const navLabels = () => within(screen.getByRole('navigation', { name: 'Staff portal' })).getAllByRole('link').map((a) => a.textContent);

describe('role-based navigation', () => {
  it('STAFF sees Dashboard, Requests, and Escalations only', () => {
    renderLayout(makeAuth('staff'));
    expect(navLabels()).toEqual(['Dashboard', 'Service requests', 'Escalations', 'View public site']);
    expect(screen.queryByRole('link', { name: 'Knowledge base' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Staff management' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Audit log' })).toBeNull();
  });

  it('ADMIN also sees Knowledge Base, Staff Management, and Audit Log', () => {
    renderLayout(makeAuth('admin'));
    expect(navLabels()).toEqual([
      'Dashboard',
      'Service requests',
      'Escalations',
      'Knowledge base',
      'Staff management',
      'Audit log',
      'View public site',
    ]);
  });

  it('links to the admin-only pages with the expected paths', () => {
    renderLayout(makeAuth('admin'));
    expect(screen.getByRole('link', { name: 'Staff management' }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: 'Audit log' }).getAttribute('href')).toBe('/admin/audit');
    expect(screen.getByRole('link', { name: 'Knowledge base' }).getAttribute('href')).toBe('/admin/knowledge');
  });
});

describe('staff portal header and account menu', () => {
  it('labels the area as the OfficeLume Staff Portal and shows the signed-in name', () => {
    renderLayout(makeAuth('staff'));
    expect(screen.getByText('Staff Portal')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pat Lee/ })).toBeTruthy();
    expect(screen.getByText('Dashboard content')).toBeTruthy();
  });

  it('opens a menu with name, role, email and Sign Out', () => {
    renderLayout(makeAuth('admin'));
    const trigger = screen.getByRole('button', { name: /Alex Admin/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);

    const panel = screen.getByRole('region', { name: 'Account' });
    expect(within(panel).getByText('Alex Admin')).toBeTruthy();
    expect(within(panel).getByText('Administrator')).toBeTruthy();
    expect(within(panel).getByText('alex@example.com')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the role label for staff', () => {
    renderLayout(makeAuth('staff'));
    fireEvent.click(screen.getByRole('button', { name: /Pat Lee/ }));
    expect(within(screen.getByRole('region', { name: 'Account' })).getByText('Staff')).toBeTruthy();
  });

  it('signs out from the menu', () => {
    const auth = makeAuth('staff');
    renderLayout(auth);
    fireEvent.click(screen.getByRole('button', { name: /Pat Lee/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    renderLayout(makeAuth('staff'));
    fireEvent.click(screen.getByRole('button', { name: /Pat Lee/ }));
    expect(screen.getByRole('region', { name: 'Account' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull();
  });
});
