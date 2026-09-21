import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handleChat } from '../../src/ai/chatHandler';
import { MockProvider } from '../../src/ai/mockProvider';
import { recordAdminLogin } from '../../src/auth/adminLoginHandler';
import { createEscalation, updateEscalation } from '../../src/escalations/escalationHandlers';
import { saveKnowledgeArticle } from '../../src/knowledge/knowledgeHandlers';
import { createServiceRequest, updateServiceRequest } from '../../src/serviceRequests/serviceRequestHandlers';
import { DEFAULT_KNOWLEDGE_BASE } from '../../../scripts/seed/knowledgeBase';

/**
 * Integration tests: the real handlers against the Firestore EMULATOR.
 *   npm run test:integration      (from the repository root)
 * Verifies transactions, reference numbers, persistence, audit logging, and authorization.
 */

let db: Firestore;
let ipCounter = 0;

function publicRequest(data: unknown) {
  // A distinct fake IP per call keeps the rate limiter out of the way unless a test wants it.
  return { data, rawRequest: { ip: `10.0.0.${++ipCounter}` } } as never;
}
function fixedIpRequest(data: unknown, ip: string) {
  return { data, rawRequest: { ip } } as never;
}
function adminRequest(data: unknown, uid = 'admin1', role: string | null = 'admin') {
  return {
    data,
    auth: { uid, token: { ...(role ? { role } : {}), email: 'admin@example.com' } },
    rawRequest: { ip: `10.1.0.${++ipCounter}` },
  } as never;
}

async function clearAll() {
  for (const name of ['users', 'knowledgeBase', 'serviceRequests', 'escalations', 'chatSessions', 'auditLogs', 'counters', 'rateLimits']) {
    await db.recursiveDelete(db.collection(name));
  }
}

async function auditEvents(eventType: string) {
  const snap = await db.collection('auditLogs').where('eventType', '==', eventType).get();
  return snap.docs.map((d) => d.data());
}

function futureDate(days = 3) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const validRequest = () => ({
  customerName: 'Jordan Rivera',
  phone: '(555) 010-2345',
  email: 'jordan@example.com',
  address: '12 Elm Street',
  city: 'Riverton',
  zipCode: '40101',
  serviceType: 'ac_repair',
  issueDescription: 'The AC is blowing warm air since yesterday.',
  preferredDate: futureDate(),
  preferredTime: 'morning',
  preferredContactMethod: 'phone',
  consent: true,
});

beforeAll(() => {
  if (!process.env['FIRESTORE_EMULATOR_HOST']) throw new Error('Run via the emulator: npm run test:integration');
  if (getApps().length === 0) initializeApp({ projectId: 'demo-officelume' });
  db = getFirestore();
});

beforeEach(async () => {
  await clearAll();
  await db.doc('users/admin1').set({ role: 'admin', active: true });
  for (const a of DEFAULT_KNOWLEDGE_BASE) await db.doc(`knowledgeBase/${a.id}`).set({ ...a });
});

describe('service requests', () => {
  it('persists a request with a unique, sequential reference number and an audit event', async () => {
    const first = await createServiceRequest(db, publicRequest(validRequest()));
    const second = await createServiceRequest(db, publicRequest(validRequest()));
    const year = new Date().getUTCFullYear();
    expect(first.requestNumber).toBe(`SR-${year}-000001`);
    expect(second.requestNumber).toBe(`SR-${year}-000002`);

    const snap = await db.collection('serviceRequests').where('requestNumber', '==', first.requestNumber).get();
    expect(snap.size).toBe(1);
    const data = snap.docs[0]!.data();
    expect(data['status']).toBe('new');
    expect(data['customerName']).toBe('Jordan Rivera');
    expect(data['statusHistory']).toHaveLength(1);

    const audit = await auditEvents('SERVICE_REQUEST_CREATED');
    expect(audit).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toContain('jordan@example.com');
    expect(JSON.stringify(audit)).not.toContain('555');
    expect(audit[0]!['timestamp']).toBeTruthy();
  });

  it('rejects invalid input and stores nothing', async () => {
    await expect(createServiceRequest(db, publicRequest({ ...validRequest(), email: 'bad' }))).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(createServiceRequest(db, publicRequest({ ...validRequest(), consent: false }))).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(createServiceRequest(db, publicRequest({ ...validRequest(), customerName: '<script>x</script>' }))).rejects.toMatchObject({ code: 'invalid-argument' });
    expect((await db.collection('serviceRequests').get()).size).toBe(0);
  });

  it('ignores client-supplied status/role fields', async () => {
    await createServiceRequest(db, publicRequest({ ...validRequest(), status: 'completed', role: 'admin' }));
    const doc = (await db.collection('serviceRequests').get()).docs[0]!.data();
    expect(doc['status']).toBe('new');
    expect(doc['role']).toBeUndefined();
  });

  it('rate limits repeated submissions from one caller', async () => {
    const ip = '203.0.113.9';
    for (let i = 0; i < 5; i++) await createServiceRequest(db, fixedIpRequest(validRequest(), ip));
    await expect(createServiceRequest(db, fixedIpRequest(validRequest(), ip))).rejects.toMatchObject({ code: 'resource-exhausted' });
  });
});

describe('escalations', () => {
  const valid = () => ({
    customerName: 'Sam Lee',
    phone: '555-010-9999',
    email: 'sam@example.com',
    preferredContactMethod: 'email',
    originalQuestion: 'Do you offer a warranty on repairs?',
    consent: true,
  });

  it('creates an ESC reference and audit event', async () => {
    const result = await createEscalation(db, publicRequest(valid()));
    expect(result.escalationNumber).toMatch(/^ESC-\d{4}-000001$/);
    const snap = await db.collection('escalations').get();
    expect(snap.size).toBe(1);
    expect(snap.docs[0]!.data()['status']).toBe('new');
    expect(snap.docs[0]!.data()['reason']).toBe('Customer asked to speak with a team member.');
    expect(await auditEvents('ESCALATION_CREATED')).toHaveLength(1);
  });

  it('takes the escalation reason from the server-side chat session, not the browser', async () => {
    const chat = await handleChat(db, publicRequest({ message: 'Do you offer a lifetime warranty?' }), new MockProvider());
    expect(chat.requiresEscalation).toBe(true);
    await createEscalation(db, publicRequest({ ...valid(), sessionId: chat.sessionId, reason: 'forged reason' }));
    const doc = (await db.collection('escalations').get()).docs[0]!.data();
    expect(doc['reason']).not.toBe('forged reason');
    expect(String(doc['reason'])).toMatch(/approved knowledge|approved/i);
  });
});

describe('AI chat', () => {
  it('answers from approved Firestore knowledge and persists the conversation + audit event', async () => {
    const result = await handleChat(db, publicRequest({ message: 'What areas do you service?' }), new MockProvider());
    expect(result.supported).toBe(true);
    expect(result.requiresEscalation).toBe(false);
    expect(result.answer).toContain('Riverton');
    expect(result).not.toHaveProperty('reason');

    const messages = await db.collection(`chatSessions/${result.sessionId}/messages`).get();
    expect(messages.size).toBe(2);
    expect(await auditEvents('AI_RESPONSE_GENERATED')).toHaveLength(1);
  });

  it('escalates instead of hallucinating, and records AI_RESPONSE_ESCALATED', async () => {
    const result = await handleChat(db, publicRequest({ message: 'What is your license number?' }), new MockProvider());
    expect(result.supported).toBe(false);
    expect(result.requiresEscalation).toBe(true);
    expect(result.answer).toMatch(/don't have enough approved information/i);
    expect(await auditEvents('AI_RESPONSE_ESCALATED')).toHaveLength(1);
  });

  it('only uses ACTIVE knowledge', async () => {
    await db.doc('knowledgeBase/kb-hours').update({ active: false });
    const result = await handleChat(db, publicRequest({ message: 'What time do you open?' }), new MockProvider());
    expect(result.answer).not.toContain('8:00 AM');
  });

  it('redacts phone numbers and emails before storing the chat', async () => {
    const result = await handleChat(db, publicRequest({ message: 'My email is jane.doe@example.com, what areas do you service?' }), new MockProvider());
    const messages = await db.collection(`chatSessions/${result.sessionId}/messages`).get();
    expect(JSON.stringify(messages.docs.map((d) => d.data()))).not.toContain('jane.doe@example.com');
  });

  it('continues an existing session and rejects an unknown one', async () => {
    const first = await handleChat(db, publicRequest({ message: 'What time do you open?' }), new MockProvider());
    const second = await handleChat(db, publicRequest({ message: 'What areas do you service?', sessionId: first.sessionId }), new MockProvider());
    expect(second.sessionId).toBe(first.sessionId);
    await expect(handleChat(db, publicRequest({ message: 'hello there', sessionId: 'doesNotExist12345' }), new MockProvider())).rejects.toMatchObject({ code: 'not-found' });
  });

  it('degrades to human escalation when the AI provider fails', async () => {
    const broken = { name: 'broken', generate: async () => { throw new Error('boom'); } };
    const result = await handleChat(db, publicRequest({ message: 'What areas do you service?' }), broken);
    expect(result.requiresEscalation).toBe(true);
    expect(result.answer).toMatch(/trouble/i);
  });
});

describe('admin authorization on every privileged function', () => {
  let requestId: string;

  beforeEach(async () => {
    await createServiceRequest(db, publicRequest(validRequest()));
    requestId = (await db.collection('serviceRequests').get()).docs[0]!.id;
    await createEscalation(db, publicRequest({
      customerName: 'Sam Lee', phone: '555-010-9999', email: 'sam@example.com', preferredContactMethod: 'email',
      originalQuestion: 'Do you offer a warranty on repairs?', consent: true,
    }));
  });

  const escalationId = async () => (await db.collection('escalations').get()).docs[0]!.id;

  it('rejects unauthenticated callers with unauthenticated', async () => {
    const noAuth = (data: unknown) => ({ data, rawRequest: { ip: '1.1.1.1' } }) as never;
    await expect(updateServiceRequest(db, noAuth({ requestId, status: 'reviewing' }))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(updateEscalation(db, noAuth({ escalationId: await escalationId(), status: 'reviewing' }))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(saveKnowledgeArticle(db, noAuth({ title: 'Hours', category: 'hours', content: 'Open Monday to Friday.', active: true }))).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects signed-in non-admins (no claim) with permission-denied', async () => {
    await expect(updateServiceRequest(db, adminRequest({ requestId, status: 'reviewing' }, 'admin1', null))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateServiceRequest(db, adminRequest({ requestId, status: 'reviewing' }, 'nobody', 'admin'))).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await db.collection('serviceRequests').doc(requestId).get()).data()!['status']).toBe('new');
  });

  it('rejects an admin whose profile has been deactivated', async () => {
    await db.doc('users/admin1').update({ active: false });
    await expect(updateServiceRequest(db, adminRequest({ requestId, status: 'reviewing' }))).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('lets an active admin change status; records history and audit event', async () => {
    const result = await updateServiceRequest(db, adminRequest({ requestId, status: 'reviewing', note: 'Called the customer.' }));
    expect(result).toEqual({ status: 'reviewing', changed: true });
    const data = (await db.collection('serviceRequests').doc(requestId).get()).data()!;
    expect(data['status']).toBe('reviewing');
    expect(data['statusHistory']).toHaveLength(2);
    expect(data['adminNotes']).toHaveLength(1);
    const events = await auditEvents('SERVICE_REQUEST_STATUS_UPDATED');
    expect(events).toHaveLength(1);
    expect(events[0]!['actorId']).toBe('admin1');
    expect(events[0]!['metadata']).toMatchObject({ from: 'new', to: 'reviewing' });
    expect(await auditEvents('SERVICE_REQUEST_NOTE_ADDED')).toHaveLength(1);
  });

  it('enforces valid status transitions and rejects unknown statuses', async () => {
    await expect(updateServiceRequest(db, adminRequest({ requestId, status: 'completed' }))).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(updateServiceRequest(db, adminRequest({ requestId, status: 'hacked' }))).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(updateServiceRequest(db, adminRequest({ requestId: 'missing', status: 'reviewing' }))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('lets an admin resolve an escalation', async () => {
    const id = await escalationId();
    await updateEscalation(db, adminRequest({ escalationId: id, status: 'contacted' }));
    await updateEscalation(db, adminRequest({ escalationId: id, status: 'resolved', note: 'Answered by phone.' }));
    expect((await db.collection('escalations').doc(id).get()).data()!['status']).toBe('resolved');
    expect(await auditEvents('ESCALATION_STATUS_UPDATED')).toHaveLength(2);
  });

  it('manages knowledge: create, update, deactivate - with audit events', async () => {
    const created = await saveKnowledgeArticle(db, adminRequest({ title: 'Warranty', category: 'policies', content: 'Sample warranty statement.', active: true }));
    await saveKnowledgeArticle(db, adminRequest({ id: created.id, title: 'Warranty info', category: 'policies', content: 'Updated sample warranty statement.', active: true }));
    await saveKnowledgeArticle(db, adminRequest({ id: created.id, title: 'Warranty info', category: 'policies', content: 'Updated sample warranty statement.', active: false }));
    expect((await db.collection('knowledgeBase').doc(created.id).get()).data()!['active']).toBe(false);
    expect(await auditEvents('KNOWLEDGE_CREATED')).toHaveLength(1);
    expect(await auditEvents('KNOWLEDGE_UPDATED')).toHaveLength(1);
    expect(await auditEvents('KNOWLEDGE_DEACTIVATED')).toHaveLength(1);
  });
});

describe('admin login audit', () => {
  it('records success for a real admin and failure for a non-admin', async () => {
    expect(await recordAdminLogin(db, adminRequest({ outcome: 'success' }))).toEqual({ authorized: true });
    expect(await recordAdminLogin(db, adminRequest({ outcome: 'success' }, 'stranger', null))).toEqual({ authorized: false });
    expect(await auditEvents('ADMIN_LOGIN_SUCCESS')).toHaveLength(1);
    expect(await auditEvents('ADMIN_LOGIN_FAILURE')).toHaveLength(1);
  });

  it('records failed sign-ins from unauthenticated callers without storing credentials', async () => {
    const result = await recordAdminLogin(db, publicRequest({ outcome: 'failure', reason: 'invalid_credentials', password: 'hunter2', email: 'x@y.com' }));
    expect(result).toEqual({ authorized: false });
    const events = await auditEvents('ADMIN_LOGIN_FAILURE');
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('hunter2');
    expect(JSON.stringify(events)).not.toContain('x@y.com');
  });
});
