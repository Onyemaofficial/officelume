import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Button } from '../components/Button';
import { ConfigNotice } from '../components/ConfigNotice';
import { Logo } from '../components/Logo';
import { ChatWidgetProvider } from '../features/chat/ChatWidgetProvider';
import { useChatWidget } from '../features/chat/chatWidgetContext';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services', end: false },
  { to: '/request-service', label: 'Request Service', end: false },
  { to: '/about', label: 'About', end: false },
];

function SiteShell() {
  const [open, setOpen] = useState(false);
  const { openHelp } = useChatWidget();
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
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                close();
                openHelp();
              }}
            >
              Get Human Help
            </Button>
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

/**
 * Public site chrome. The chat provider lives here (not in individual pages), so the floating
 * chat - and its conversation - persists as visitors move between public pages.
 */
export function PublicLayout() {
  return (
    <ChatWidgetProvider>
      <SiteShell />
    </ChatWidgetProvider>
  );
}
