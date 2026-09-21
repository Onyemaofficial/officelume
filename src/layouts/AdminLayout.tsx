import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Button } from '../components/Button';
import { ConfigNotice } from '../components/ConfigNotice';
import { Logo } from '../components/Logo';
import { useAuth } from '../features/auth/useAuth';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/requests', label: 'Service requests' },
  { to: '/admin/escalations', label: 'Escalations' },
  { to: '/admin/knowledge', label: 'Knowledge base' },
  { to: '/admin/audit', label: 'Audit log' },
];

export function AdminLayout() {
  const { state, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const email = state.status === 'admin' ? state.identity.email : null;

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main">
        Skip to main content
      </a>
      <aside className={open ? 'admin-sidebar is-open' : 'admin-sidebar'}>
        <div className="admin-sidebar-top">
          <Link to="/admin/dashboard" aria-label="OfficeLume admin dashboard">
            <Logo inverse />
          </Link>
          <button type="button" className="nav-toggle admin-toggle" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen((o) => !o)}>
            <span className="sr-only">Menu</span>
            <span aria-hidden="true" className="nav-toggle-bars" />
          </button>
        </div>
        <nav id="admin-nav" className="admin-nav" aria-label="Admin">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'admin-link is-active' : 'admin-link')}>
              {item.label}
            </NavLink>
          ))}
          <div className="admin-sidebar-footer">
            {email && <span className="admin-user" title={email}>{email}</span>}
            <Link to="/" className="admin-link admin-link-muted">
              View public site
            </Link>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </nav>
      </aside>
      <div className="admin-content">
        <ConfigNotice />
        <main id="admin-main" tabIndex={-1} className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
