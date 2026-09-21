import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { ButtonLink } from '../components/Button';
import { ConfigNotice } from '../components/ConfigNotice';
import { Logo } from '../components/Logo';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services', end: false },
  { to: '/request-service', label: 'Request Service', end: false },
  { to: '/about', label: 'About', end: false },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="OfficeLume home" onClick={close}>
            <Logo />
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="primary-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            <span aria-hidden="true" className="nav-toggle-bars" />
          </button>
          <nav id="primary-nav" className={open ? 'site-nav is-open' : 'site-nav'} aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={close} className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}>
                {item.label}
              </NavLink>
            ))}
            <ButtonLink to="/#help" size="sm" variant="secondary" onClick={close}>
              Get Human Help
            </ButtonLink>
          </nav>
        </div>
      </header>

      <ConfigNotice />

      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <Logo tagline inverse />
            <p className="footer-note">
              OfficeLume is an AI-assisted front office. Complex or unsupported requests are forwarded to a human
              representative. Business details shown are fictional sample data.
            </p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <Link to="/services">Services</Link>
            <Link to="/request-service">Request Service</Link>
            <Link to="/about">About OfficeLume</Link>
            <Link to="/admin/login">Staff sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
