import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { ConfigNotice } from '../components/ConfigNotice';
import { Logo } from '../components/Logo';
import { ProfileMenu } from '../features/admin/ProfileMenu';
import { useAuth } from '../features/auth/useAuth';
import type { StaffRole } from '../types';

interface NavItem {
  to: string;
  label: string;
  /** Roles that see (and may open) this page. The route itself is protected separately. */
  roles: readonly StaffRole[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', roles: ['staff', 'admin'] },
  { to: '/admin/requests', label: 'Service requests', roles: ['staff', 'admin'] },
  { to: '/admin/escalations', label: 'Escalations', roles: ['staff', 'admin'] },
  { to: '/admin/knowledge', label: 'Knowledge base', roles: ['admin'] },
  { to: '/admin/users', label: 'Staff management', roles: ['admin'] },
  { to: '/admin/audit', label: 'Audit log', roles: ['admin'] },
];

/** Staff portal shell: role-aware navigation plus a header with the account menu. */
export function AdminLayout() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((item) => role !== null && item.roles.includes(role));

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main">
        Skip to main content
      </a>
      <aside className={open ? 'admin-sidebar is-open' : 'admin-sidebar'}>
        <div className="admin-sidebar-top">
          <Link to="/admin/dashboard" aria-label="OfficeLume staff portal dashboard">
            <Logo inverse />
          </Link>
          <button type="button" className="nav-toggle admin-toggle" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen((o) => !o)}>
            <span className="sr-only">Menu</span>
            <span aria-hidden="true" className="nav-toggle-bars" />
          </button>
        </div>
        <nav id="admin-nav" className="admin-nav" aria-label="Staff portal">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'admin-link is-active' : 'admin-link')}>
              {item.label}
            </NavLink>
          ))}
          <div className="admin-sidebar-footer">
            <Link to="/" className="admin-link admin-link-muted">
              View public site
            </Link>
          </div>
        </nav>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <span className="admin-topbar-brand">OfficeLume</span>
            <span className="admin-topbar-sub">Staff Portal</span>
          </div>
          <ProfileMenu />
        </header>
        <ConfigNotice />
        <main id="admin-main" tabIndex={-1} className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
