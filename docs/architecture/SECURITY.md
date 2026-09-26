# OfficeLume Security Strategy

## Firestore security rules ([`firestore.rules`](../../firestore.rules))

**Principle: deny by default, allow the minimum.**

1. **No client writes anywhere - for anyone, including staff and admins.** Customers are anonymous, and admin mutations need validation and audit trails, so all writes happen in Cloud Functions using the Admin SDK (which bypasses rules). Public record creation (chat, service requests, escalations) is therefore validated, rate limited, and audited server-side rather than exposed through open `create` rules.
2. **Two roles.** `staff` may read `serviceRequests` and `escalations` (the work queue). `admin` may additionally read `knowledgeBase`, `chatSessions` (+ `messages`), `auditLogs`, and every `users` profile. Customers never read Firestore; they receive answers from `askOfficeLume`.
3. **`isStaff()` / `isAdmin()` require both** a `role` custom claim of `staff`/`admin` (Admin SDK only) **and** an existing `users/{uid}` profile that is `active == true` **and whose `role` equals the claim**. A stolen or forged claim without the profile, a valid profile without the claim, a deactivated account, and a stale claim after a role change (claim admin, profile staff) are all denied. Deactivating the profile revokes access immediately.
4. **`users/{uid}`**: a signed-in user may read only their own document; administrators may read all profiles (staff management). Nobody writes profiles from a client, so **a staff member cannot promote themselves**.
5. **`counters/*` and `rateLimits/*`** are fully closed - server bookkeeping only.
6. A final `match /{document=**}` denies everything not explicitly listed.

These rules are verified by `test/rules/firestore.rules.test.ts` (39 tests against the Firestore emulator): anonymous reads/writes denied on every collection; signed-in non-staff denied; staff can read the queue but not admin-only collections, other profiles, or write anything (including their own role); claim-without-profile, profile-without-claim, deactivated staff/admin, and stale-claim-after-demotion all denied; admin can read everything intended but write nothing; unknown collections denied.

## Function-layer authorization

Frontend route guards are convenience only. Every staff callable begins with `requireStaff()` and every admin-only callable with `requireAdmin()` (`functions/src/auth/authorization.ts`):

* no auth → `unauthenticated`
* auth but no admin claim / no active admin profile → `permission-denied`
* role values submitted in request bodies are ignored (validated payloads have no `role`/`status` fields for creation).

Verified by unit tests (`authorization.test.ts`), handler integration tests against the emulator, and `npm run smoke` over real HTTP with Auth-emulator tokens.

## Secrets

* `ANTHROPIC_API_KEY` lives in Secret Manager and is bound only to `askOfficeLume` (`secrets: [ANTHROPIC_API_KEY]`).
* Vite variables (`VITE_FIREBASE_*`) are public web identifiers, not secrets.
* `.gitignore` excludes `.env*`, `functions/.secret.local`, service-account JSON files.
* The developer scripts read credentials from Application Default Credentials and read any initial password from an environment variable, never from arguments or files.

## Input handling

* Zod validation on every callable; trimming, length limits, enum checks, date-range checks, ZIP/phone/email formats.
* HTML/script-like markup is rejected in free-text fields (React also escapes on output).
* Honeypot fields on public forms; per-caller rate limits (chat 20/min, requests and escalations 5/hour).
* Errors returned to clients are user-safe; technical details are logged server-side without customer data.

## AI-specific controls

| Risk | Control |
|---|---|
| Hallucinated facts | Retrieval-grounded prompt; no relevant knowledge → escalate without calling the model; grounding check blocks invented prices/discounts |
| False commitments | Grounding check blocks booking confirmations and affirmative guarantees |
| Prompt injection | Deterministic pre-filters; customer text wrapped as untrusted data; model has no tools or data access |
| Data leakage | Prompt leak / key-pattern check on output; model never receives other customers' data or internal notes |
| Unsafe advice | Hazardous DIY (refrigerant, gas, electrical, combustion) and life-safety patterns get fixed safe responses |
| Identity | Answers "are you human / a technician?" honestly; output check blocks claims of being human or licensed |
| PII exposure | Emails/phones redacted before storage and before the model call |

## Recommended hardening before real use

* Enable **Firebase App Check** (reCAPTCHA Enterprise) and set `enforceAppCheck: true` on public callables.
* Restrict `cors` on callables to your Hosting domain(s).
* Enable a Firestore **TTL policy** on `rateLimits.expiresAt`.
* Configure billing alerts and Anthropic spend limits.
* Add multi-factor authentication for administrator accounts in Firebase Authentication.
* Review data-retention policy for chat logs and requests.

## Staff accounts

* **No public registration.** Accounts exist only when an administrator creates them (`createStaffUserAdmin`) or the bootstrap script does (`scripts/create-admin.ts`).
* **Passwords never touch our code or database.** New accounts get a random password nobody sees; the employee sets their own through Firebase's password-setup email. The bootstrap script prompts (hidden) or reads `ADMIN_INITIAL_PASSWORD` for that one command. Firestore holds only non-sensitive profile metadata.
* **Role changes are server-side and safe:** self role-change and self-deactivation are blocked, the last active administrator cannot be removed or demoted (checked inside a Firestore transaction), and role/deactivation revoke the person's refresh tokens.
* **Sign-in errors do not reveal accounts:** unknown email and wrong password produce the same message, and the password-reset page always gives the same confirmation.
* **Audit trail:** `STAFF_LOGIN_SUCCESS/FAILURE`, `STAFF_LOGOUT`, `STAFF_CREATED`, `STAFF_ROLE_CHANGED`, `STAFF_DEACTIVATED`, `STAFF_REACTIVATED`, plus request/escalation/knowledge changes, each with actor uid, email, and role. Failure events store no email or credentials.
* **Credentials hygiene:** `.gitignore` excludes `.env*`, service-account/Admin SDK key files, and `functions/.secret.local`.
