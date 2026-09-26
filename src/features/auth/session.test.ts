import { describe, expect, it } from 'vitest';
import { makeProfile } from '../../test/authTestUtils';
import { evaluateSession, roleAllowed } from './session';

describe('evaluateSession (mirrors the server and Firestore rules)', () => {
  it('accepts a staff claim backed by an active, matching profile', () => {
    const profile = makeProfile({ role: 'staff' });
    expect(evaluateSession('staff', profile)).toEqual({ ok: true, session: { role: 'staff', profile } });
  });

  it('accepts an admin claim backed by an active admin profile', () => {
    expect(evaluateSession('admin', makeProfile({ role: 'admin' }))).toMatchObject({ ok: true, session: { role: 'admin' } });
  });

  it('refuses accounts with no role claim (e.g. a customer account, or an unknown role)', () => {
    expect(evaluateSession(undefined, makeProfile())).toEqual({ ok: false, reason: 'no_role' });
    expect(evaluateSession('customer', makeProfile())).toEqual({ ok: false, reason: 'no_role' });
    expect(evaluateSession('superuser', makeProfile())).toEqual({ ok: false, reason: 'no_role' });
  });

  it('refuses a missing profile', () => {
    expect(evaluateSession('staff', null)).toEqual({ ok: false, reason: 'no_profile' });
  });

  it('refuses an inactive (deactivated) account', () => {
    expect(evaluateSession('staff', makeProfile({ active: false }))).toEqual({ ok: false, reason: 'inactive' });
  });

  it('refuses a stale claim that no longer matches the profile role (role changed)', () => {
    expect(evaluateSession('admin', makeProfile({ role: 'staff' }))).toEqual({ ok: false, reason: 'role_mismatch' });
    expect(evaluateSession('staff', makeProfile({ role: 'admin' }))).toEqual({ ok: false, reason: 'role_mismatch' });
  });
});

describe('roleAllowed', () => {
  it('allows only listed roles and never a missing role', () => {
    expect(roleAllowed('staff', ['staff', 'admin'])).toBe(true);
    expect(roleAllowed('staff', ['admin'])).toBe(false);
    expect(roleAllowed('admin', ['admin'])).toBe(true);
    expect(roleAllowed(null, ['staff', 'admin'])).toBe(false);
  });
});
