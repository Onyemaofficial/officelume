import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { STAFF_ROLE_LABELS } from '../../types';
import { useAuth } from '../auth/useAuth';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

/** Top-right account menu: name, role, email, and Sign Out. */
export function ProfileMenu() {
  const { profile, user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const name = profile?.displayName || user?.displayName || user?.email || 'Staff member';
  const email = profile?.email ?? user?.email ?? '';

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="profile-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">{initials(name)}</span>
        <span className="profile-trigger-text">
          <span className="profile-name">{name}</span>
          {role && <span className="profile-role">{STAFF_ROLE_LABELS[role]}</span>}
        </span>
        <span className="profile-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div id={panelId} className="profile-panel" role="region" aria-label="Account">
          <p className="profile-panel-name">{name}</p>
          {role && <p className="profile-panel-role">{STAFF_ROLE_LABELS[role]}</p>}
          <p className="profile-panel-email">{email}</p>
          <Button variant="secondary" size="sm" onClick={() => void signOut()} loading={signingOut}>
            Sign Out
          </Button>
        </div>
      )}
    </div>
  );
}
