import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/** Shared plumbing for the developer scripts (seed + admin management). */

export interface Target {
  projectId: string;
  emulator: boolean;
}

export function readDefaultProject(): string | undefined {
  try {
    const rc = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../.firebaserc'), 'utf8')) as {
      projects?: { default?: string };
    };
    return rc.projects?.default;
  } catch {
    return undefined;
  }
}

/**
 * Resolve which Firebase project the script talks to and initialise the Admin SDK.
 * Emulator mode is detected from FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.
 * Production access uses Application Default Credentials (`gcloud auth application-default login`)
 * or GOOGLE_APPLICATION_CREDENTIALS - never a key committed to the repo.
 */
export function initAdmin(projectArg: string | undefined): Target {
  const emulator = Boolean(process.env['FIRESTORE_EMULATOR_HOST'] || process.env['FIREBASE_AUTH_EMULATOR_HOST']);
  const projectId =
    projectArg ??
    process.env['GCLOUD_PROJECT'] ??
    process.env['GOOGLE_CLOUD_PROJECT'] ??
    (emulator ? 'demo-officelume' : readDefaultProject());

  if (!projectId) {
    throw new Error('No Firebase project. Pass --project <id> or set default in .firebaserc.');
  }
  if (getApps().length === 0) initializeApp({ projectId });
  return { projectId, emulator };
}

export function getDb(): Firestore {
  return getFirestore();
}

export function describeTarget(target: Target): string {
  return target.emulator
    ? `Firebase EMULATOR (project "${target.projectId}")`
    : `LIVE Firebase project "${target.projectId}"`;
}

/** Live writes must be explicit so a script is never pointed at production by accident. */
export function requireConfirmation(target: Target, yes: boolean): void {
  if (target.emulator || yes) return;
  console.error(
    `\nRefusing to modify ${describeTarget(target)} without confirmation.\n` +
      'Re-run with --yes if this is the project you intend to change.\n',
  );
  process.exit(1);
}
