import { parseArgs } from 'node:util';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { describeTarget, getDb, initAdmin, requireConfirmation } from './common';

/**
 * Grant (or revoke) administrator access. This is the ONLY way to make an admin: authorization
 * comes from a custom claim + an active users/{uid} profile, both written here with the Admin SDK.
 * Browser code can never set either.
 *
 *   # 1. Create the user in Firebase Console > Authentication (email/password), then:
 *   npm run admin:create -- --email you@example.com --project <id> --yes
 *
 *   # Or let the script create the Auth user (emulator/dev). The password is read from an
 *   # environment variable so it never lands in shell history or the repo:
 *   ADMIN_INITIAL_PASSWORD='choose-a-strong-one' npm run admin:create -- --email you@example.com
 *
 *   # Revoke:
 *   npm run admin:create -- --email you@example.com --revoke --project <id> --yes
 */
const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    project: { type: 'string' },
    revoke: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
  },
});

async function main() {
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error('Missing --email <address>.');

  const target = initAdmin(values.project);
  requireConfirmation(target, values.yes ?? false);
  console.log(`${values.revoke ? 'Revoking' : 'Granting'} admin for ${email} on ${describeTarget(target)}\n`);

  const auth = getAuth();
  const db = getDb();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    if (values.revoke) throw new Error(`No Firebase Auth user exists for ${email}.`, { cause: error });
    const password = process.env['ADMIN_INITIAL_PASSWORD'];
    if (!password) {
      throw new Error(
        `No Firebase Auth user exists for ${email}.\n` +
          'Create it in Firebase Console > Authentication > Users first, or set ADMIN_INITIAL_PASSWORD to have this script create it.',
        { cause: error },
      );
    }
    if (password.length < 12) throw new Error('ADMIN_INITIAL_PASSWORD must be at least 12 characters.', { cause: error });
    user = await auth.createUser({ email, password, displayName: values.name ?? 'Administrator', emailVerified: false });
    console.log('Created Firebase Authentication user.');
  }

  const profileRef = db.collection('users').doc(user.uid);

  if (values.revoke) {
    const { role: _removed, ...remainingClaims } = (user.customClaims ?? {}) as Record<string, unknown>;
    await auth.setCustomUserClaims(user.uid, remainingClaims);
    await profileRef.set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await auth.revokeRefreshTokens(user.uid);
    console.log('Admin access revoked; refresh tokens revoked. The profile is inactive, so Firestore and Cloud Functions deny access immediately.');
    return;
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: 'admin' });
  const existing = await profileRef.get();
  await profileRef.set(
    {
      displayName: values.name ?? user.displayName ?? 'Administrator',
      email,
      role: 'admin',
      active: true,
      createdAt: existing.exists ? (existing.data()?.['createdAt'] ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`Admin granted to ${email} (uid ${user.uid}).`);
  console.log('If they are already signed in, they must sign out and back in for the new role to take effect.');
}

main().catch((error: unknown) => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
