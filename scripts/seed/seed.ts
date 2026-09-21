import { parseArgs } from 'node:util';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { describeTarget, getDb, initAdmin, requireConfirmation } from './common';
import { DEFAULT_KNOWLEDGE_BASE } from './knowledgeBase';

/**
 * Seed Firestore with the default HVAC knowledge base (and optional development sample records).
 *
 *   npm run seed -- --project <id> --yes                # knowledge base only (safe to re-run)
 *   npm run seed -- --project <id> --yes --with-samples # + sample requests/escalations (dev only)
 *   npm run seed -- --project <id> --yes --force        # overwrite existing articles with defaults
 *
 * With the emulator running, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and omit --yes.
 * Existing knowledge articles are NOT overwritten unless --force is given, so administrator edits survive.
 */
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    yes: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'with-samples': { type: 'boolean', default: false },
  },
});

async function main() {
  const target = initAdmin(values.project);
  requireConfirmation(target, values.yes ?? false);
  const db = getDb();
  console.log(`Seeding ${describeTarget(target)}\n`);

  // --- Knowledge base ---
  let created = 0;
  let skipped = 0;
  let overwritten = 0;
  for (const article of DEFAULT_KNOWLEDGE_BASE) {
    const ref = db.collection('knowledgeBase').doc(article.id);
    const existing = await ref.get();
    if (existing.exists && !values.force) {
      skipped++;
      continue;
    }
    const { id: _id, ...fields } = article;
    await ref.set(
      {
        ...fields,
        createdBy: 'seed',
        updatedBy: 'seed',
        createdAt: existing.exists ? (existing.data()?.['createdAt'] ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );
    if (existing.exists) overwritten++;
    else created++;
  }
  console.log(`Knowledge base: ${created} created, ${overwritten} overwritten, ${skipped} left untouched.`);

  // --- Development samples ---
  if (values['with-samples']) {
    const counter = await db.collection('counters').doc(`SR-${new Date().getUTCFullYear()}`).get();
    if (counter.exists) {
      console.log('Samples skipped: reference counters already exist (this database already has data).');
      return;
    }
    await seedSamples(db);
  }
  console.log('\nDone.');
}

async function seedSamples(db: ReturnType<typeof getDb>) {
  const year = new Date().getUTCFullYear();
  const now = Timestamp.now();
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const history = (status: string) => [{ status, changedAt: now, changedBy: 'system' }];

  const requests = [
    { n: 1, name: 'Avery Johnson', service: 'ac_repair', status: 'new', city: 'Riverton', issue: 'AC is running but blowing warm air since yesterday afternoon.' },
    { n: 2, name: 'Morgan Diaz', service: 'maintenance', status: 'reviewing', city: 'Oak Hollow', issue: 'Would like a seasonal tune-up before summer.' },
    { n: 3, name: 'Riley Chen', service: 'thermostat', status: 'contacted', city: 'Lakeside', issue: 'Thermostat display is blank and the heat will not turn on.' },
  ];
  for (const r of requests) {
    const number = `SR-${year}-${String(r.n).padStart(6, '0')}`;
    await db.collection('serviceRequests').add({
      requestNumber: number,
      customerName: r.name,
      phone: '(555) 010-0100',
      email: `${r.name.split(' ')[0]!.toLowerCase()}@example.com`,
      address: `${100 + r.n} Sample Street`,
      city: r.city,
      zipCode: '40101',
      serviceType: r.service,
      issueDescription: r.issue,
      preferredDate: day(r.n + 2),
      preferredTime: r.n % 2 === 0 ? 'afternoon' : 'morning',
      preferredContactMethod: r.n % 2 === 0 ? 'email' : 'phone',
      status: r.status,
      source: 'seed',
      consentAcknowledgedAt: now,
      adminNotes: [],
      statusHistory: history('new'),
      createdAt: now,
      updatedAt: now,
    });
  }

  const escalations = [
    { n: 1, name: 'Jamie Park', question: 'Do you offer a warranty on repairs?', status: 'new' },
    { n: 2, name: 'Taylor Brooks', question: 'Can I pay for a new system in installments?', status: 'reviewing' },
  ];
  for (const e of escalations) {
    await db.collection('escalations').add({
      escalationNumber: `ESC-${year}-${String(e.n).padStart(6, '0')}`,
      customerName: e.name,
      phone: '(555) 010-0200',
      email: `${e.name.split(' ')[0]!.toLowerCase()}@example.com`,
      preferredContactMethod: 'email',
      originalQuestion: e.question,
      additionalDetails: '',
      reason: 'No approved knowledge is relevant to this question.',
      status: e.status,
      sessionId: null,
      consentAcknowledgedAt: now,
      adminNotes: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.collection('counters').doc(`SR-${year}`).set({ value: requests.length, updatedAt: now });
  await db.collection('counters').doc(`ESC-${year}`).set({ value: escalations.length, updatedAt: now });
  console.log(`Samples: ${requests.length} service requests and ${escalations.length} escalations (source: "seed").`);
}

main().catch((error: unknown) => {
  console.error('\nSeed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
