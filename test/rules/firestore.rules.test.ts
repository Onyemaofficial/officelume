import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getCountFromServer, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Security rules verification. Requires the Firestore emulator:
 *   npm run test:rules
 */
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-officelume',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '../../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Seed data the way Cloud Functions would (rules bypassed).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin1'), { role: 'admin', active: true, email: 'admin@example.com' });
    await setDoc(doc(db, 'users/admin-off'), { role: 'admin', active: false, email: 'off@example.com' });
    await setDoc(doc(db, 'users/staff1'), { role: 'staff', active: true });
    await setDoc(doc(db, 'serviceRequests/r1'), { requestNumber: 'SR-2026-000001', customerName: 'Jane', status: 'new' });
    await setDoc(doc(db, 'escalations/e1'), { escalationNumber: 'ESC-2026-000001', customerName: 'Sam', status: 'new' });
    await setDoc(doc(db, 'knowledgeBase/k1'), { title: 'Hours', active: true });
    await setDoc(doc(db, 'chatSessions/s1'), { messageCount: 2 });
    await setDoc(doc(db, 'chatSessions/s1/messages/m1'), { role: 'user', content: 'hi' });
    await setDoc(doc(db, 'auditLogs/a1'), { eventType: 'ADMIN_LOGIN_SUCCESS' });
    await setDoc(doc(db, 'counters/SR-2026'), { value: 1 });
    await setDoc(doc(db, 'rateLimits/x'), { count: 1 });
  });
});

const admin = () => env.authenticatedContext('admin1', { role: 'admin' }).firestore();
const PROTECTED = ['serviceRequests', 'escalations', 'knowledgeBase', 'auditLogs', 'chatSessions'] as const;

describe('unauthenticated visitors (customers)', () => {
  const anon = () => env.unauthenticatedContext().firestore();

  it.each([...PROTECTED, 'users', 'counters', 'rateLimits'])('cannot list %s', async (name) => {
    await assertFails(getDocs(collection(anon(), name)));
  });

  it.each([
    ['serviceRequests/r1'],
    ['escalations/e1'],
    ['knowledgeBase/k1'],
    ['auditLogs/a1'],
    ['users/admin1'],
    ['chatSessions/s1'],
    ['chatSessions/s1/messages/m1'],
  ])('cannot read %s', async (path) => {
    await assertFails(getDoc(doc(anon(), path)));
  });

  it('cannot create service requests, escalations, chats, or audit logs directly', async () => {
    await assertFails(addDoc(collection(anon(), 'serviceRequests'), { customerName: 'x', status: 'new' }));
    await assertFails(addDoc(collection(anon(), 'escalations'), { customerName: 'x' }));
    await assertFails(setDoc(doc(anon(), 'chatSessions/new1'), { messageCount: 0 }));
    await assertFails(addDoc(collection(anon(), 'auditLogs'), { eventType: 'FORGED' }));
  });

  it('cannot modify or delete anything', async () => {
    await assertFails(updateDoc(doc(anon(), 'serviceRequests/r1'), { status: 'completed' }));
    await assertFails(deleteDoc(doc(anon(), 'serviceRequests/r1')));
    await assertFails(updateDoc(doc(anon(), 'knowledgeBase/k1'), { active: false }));
  });

  it('cannot run aggregate counts on protected collections', async () => {
    await assertFails(getCountFromServer(collection(anon(), 'serviceRequests')));
  });
});

describe('signed-in users who are NOT administrators', () => {
  it('cannot read admin data even when signed in', async () => {
    const customer = env.authenticatedContext('cust1').firestore();
    await assertFails(getDocs(collection(customer, 'serviceRequests')));
    await assertFails(getDocs(collection(customer, 'auditLogs')));
  });

  it('cannot self-assign the admin role via a client-supplied profile or token claim', async () => {
    const attacker = env.authenticatedContext('attacker', { role: 'admin' }).firestore();
    // Has the claim but no active admin profile document -> not an admin.
    await assertFails(getDocs(collection(attacker, 'serviceRequests')));
    // Cannot create their own admin profile.
    await assertFails(setDoc(doc(attacker, 'users/attacker'), { role: 'admin', active: true }));
  });

  it('a user whose profile says admin but who lacks the admin claim is denied', async () => {
    const noClaim = env.authenticatedContext('admin1').firestore();
    await assertFails(getDocs(collection(noClaim, 'serviceRequests')));
  });

  it('a non-admin profile with a stolen admin claim is denied', async () => {
    const staff = env.authenticatedContext('staff1', { role: 'admin' }).firestore();
    await assertFails(getDocs(collection(staff, 'serviceRequests')));
  });

  it('may read only their own user profile', async () => {
    const staff = env.authenticatedContext('staff1').firestore();
    await assertSucceeds(getDoc(doc(staff, 'users/staff1')));
    await assertFails(getDoc(doc(staff, 'users/admin1')));
    await assertFails(getDocs(collection(staff, 'users')));
  });
});

describe('administrators', () => {
  it('can read operational data', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'serviceRequests')));
    await assertSucceeds(getDocs(collection(admin(), 'escalations')));
    await assertSucceeds(getDocs(collection(admin(), 'knowledgeBase')));
    await assertSucceeds(getDocs(collection(admin(), 'auditLogs')));
    await assertSucceeds(getDoc(doc(admin(), 'chatSessions/s1/messages/m1')));
    await assertSucceeds(getCountFromServer(collection(admin(), 'serviceRequests')));
  });

  it('cannot write directly - all mutations go through audited Cloud Functions', async () => {
    await assertFails(updateDoc(doc(admin(), 'serviceRequests/r1'), { status: 'completed' }));
    await assertFails(setDoc(doc(admin(), 'knowledgeBase/k2'), { title: 'x' }));
    await assertFails(deleteDoc(doc(admin(), 'serviceRequests/r1')));
    await assertFails(addDoc(collection(admin(), 'auditLogs'), { eventType: 'FORGED' }));
    await assertFails(updateDoc(doc(admin(), 'users/admin1'), { role: 'admin' }));
  });

  it('cannot read server-internal collections', async () => {
    await assertFails(getDoc(doc(admin(), 'counters/SR-2026')));
    await assertFails(getDoc(doc(admin(), 'rateLimits/x')));
  });

  it('is locked out as soon as their profile is deactivated (even with a valid token)', async () => {
    const revoked = env.authenticatedContext('admin-off', { role: 'admin' }).firestore();
    await assertFails(getDocs(collection(revoked, 'serviceRequests')));
  });
});

describe('unknown collections', () => {
  it('are denied by default', async () => {
    await assertFails(getDocs(collection(admin(), 'somethingElse')));
    await assertFails(setDoc(doc(admin(), 'somethingElse/x'), { a: 1 }));
  });
});
