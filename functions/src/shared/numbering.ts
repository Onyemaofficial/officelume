import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from './constants';

export type ReferencePrefix = 'SR' | 'ESC';

/** SR-2026-000001 style reference numbers. */
export function formatReferenceNumber(prefix: ReferencePrefix, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Allocate the next sequence number for a prefix/year inside an existing transaction.
 * Because the counter increment commits atomically with the record, numbers are unique and gapless.
 * NOTE: all reads must happen before writes in a Firestore transaction, so call this first.
 */
export async function nextReferenceNumber(
  db: Firestore,
  tx: Transaction,
  prefix: ReferencePrefix,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();
  const ref = db.collection(COLLECTIONS.counters).doc(`${prefix}-${year}`);
  const snap = await tx.get(ref);
  const current = snap.exists ? Number((snap.data() as { value?: number }).value ?? 0) : 0;
  const next = current + 1;
  tx.set(ref, { value: next, updatedAt: now });
  return formatReferenceNumber(prefix, year, next);
}
