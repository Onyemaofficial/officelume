import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

/**
 * The single place Firebase is initialised. Everything else imports `auth`, `db`, or `functions`
 * from here. All values are public web-app identifiers; security is enforced by Firestore rules
 * and Cloud Functions, never by hiding these.
 */

const env = import.meta.env;
const useEmulators = env.VITE_USE_EMULATORS === 'true';

const configured: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** True when real Firebase project values were supplied (or the emulator is in use). */
export const isFirebaseConfigured = Boolean(configured.apiKey && configured.projectId) || useEmulators;

/**
 * Emulator mode ALWAYS targets the emulator project (default "demo-officelume", matching
 * `npm run emulators`) and never your real project - even if real values are in .env.local. The
 * Functions emulator serves URLs under its own project id, so mixing the two produces 404s, and this
 * also guarantees local testing cannot touch production. To run the emulators under a different
 * project id, start them with `--project <id>` and set VITE_EMULATOR_PROJECT_ID to the same value.
 */
function buildOptions(): FirebaseOptions {
  if (useEmulators) {
    return { apiKey: 'demo-api-key', appId: 'demo-app-id', projectId: env.VITE_EMULATOR_PROJECT_ID ?? 'demo-officelume' };
  }
  if (isFirebaseConfigured) return configured;
  return { apiKey: 'not-configured', projectId: 'not-configured', appId: 'not-configured' };
}

const app = initializeApp(buildOptions());

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, env.VITE_FUNCTIONS_REGION ?? 'us-central1');

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
