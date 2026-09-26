import { parseArgs } from 'node:util';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { describeTarget, getDb, initAdmin, requireConfirmation } from './seed/common';

/**
 * Bootstrap (or revoke) a staff/admin account with the Firebase Admin SDK.
 *
 * This is how the FIRST administrator is created - OfficeLume has no public sign-up. Authorization
 * is a `role` custom claim plus an active `users/{uid}` profile; both are written here (server-side)
 * and can never be set from a browser.
 *
 *   npm run create-admin -- --email you@example.com --name "Your Name" --project <project-id> --yes
 *
 * Password handling - nothing is hard-coded, and the password is never a command-line argument:
 *   1. Interactive terminal : you are prompted (input hidden) and asked to confirm.
 *   2. Non-interactive/CI   : set ADMIN_INITIAL_PASSWORD in the environment for that one command.
 *   (Prompting is skipped entirely when the account already exists - it is just granted the role.)
 *
 * Credentials for the Admin SDK come from Application Default Credentials
 * (`gcloud auth application-default login`) or a service-account file OUTSIDE this repository
 * referenced by GOOGLE_APPLICATION_CREDENTIALS. Service-account keys must never be committed.
 * Against the local emulators (FIREBASE_AUTH_EMULATOR_HOST + FIRESTORE_EMULATOR_HOST) no
 * credentials are needed and --yes is not required.
 *
 *   Options:  --role admin|staff (default admin)   --revoke   --project <id>   --yes
 */
const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'admin' },
    project: { type: 'string' },
    revoke: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
  },
});

const MIN_PASSWORD_LENGTH = 12;

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';

    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          finish();
          reject(new Error('Cancelled.'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function obtainPassword(): Promise<string> {
  const fromEnv = process.env['ADMIN_INITIAL_PASSWORD'];
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    throw new Error('No terminal to prompt on. Set ADMIN_INITIAL_PASSWORD for this command, or run it in an interactive terminal.');
  }
  const first = await readHidden(`Password for the new account (min ${MIN_PASSWORD_LENGTH} characters): `);
  const second = await readHidden('Confirm password: ');
  if (first !== second) throw new Error('Passwords did not match.');
  return first;
}

async function main() {
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error('Missing --email <address>.');
  const role = values.role;
  if (role !== 'admin' && role !== 'staff') throw new Error('--role must be "admin" or "staff".');

  const target = initAdmin(values.project);
  requireConfirmation(target, values.yes ?? false);
  console.log(`${values.revoke ? 'Revoking' : `Provisioning ${role}`} for ${email} on ${describeTarget(target)}\n`);

  const auth = getAuth();
  const db = getDb();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    if (values.revoke) throw new Error(`No Firebase Auth user exists for ${email}.`, { cause: error });

    const password = await obtainPassword();
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, { cause: error });
    }
    user = await auth.createUser({ email, password, displayName: values.name ?? 'Administrator', emailVerified: false });
    console.log('Created Firebase Authentication user.');
  }

  const profileRef = db.collection('users').doc(user.uid);

  if (values.revoke) {
    const { role: _removed, ...remainingClaims } = (user.customClaims ?? {}) as Record<string, unknown>;
    await auth.setCustomUserClaims(user.uid, remainingClaims);
    await profileRef.set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await auth.updateUser(user.uid, { disabled: true });
    await auth.revokeRefreshTokens(user.uid);
    console.log('Access revoked: role claim removed, profile deactivated, login disabled, sessions revoked.');
    return;
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role });
  if (user.disabled) await auth.updateUser(user.uid, { disabled: false });
  const existing = await profileRef.get();
  await profileRef.set(
    {
      uid: user.uid,
      displayName: values.name ?? user.displayName ?? 'Administrator',
      email,
      role,
      active: true,
      createdAt: existing.exists ? (existing.data()?.['createdAt'] ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`${role === 'admin' ? 'Administrator' : 'Staff member'} ready: ${email} (uid ${user.uid}).`);
  console.log('If they are already signed in, they must sign out and back in for the new role to take effect.');
}

main().catch((error: unknown) => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
