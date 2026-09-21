import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/** Single Admin SDK initialisation point for all functions. */
export function getDb(): Firestore {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
}
