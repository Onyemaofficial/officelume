# OfficeLume

**Less admin. More service.**

OfficeLume is an AI-assisted digital front office for a small HVAC service business. Customers ask questions, request service, or reach a person; an administrator reviews everything in a secure dashboard. It is the working MVP for an 8-week capstone.

```
Customer inquiry → AI analyses the question → searches the approved HVAC knowledge base
  → grounded answer  OR  human escalation
  → optional service request → stored in Firebase
  → authenticated administrator reviews requests & escalations → updates status
  → every important event is written to the audit log
```

* The AI **only answers from approved knowledge** and escalates instead of guessing.
* The AI has **no write access** to anything; all business operations are separate, validated, audited Cloud Functions.
* The Claude API key **never reaches the browser**.

> All business details (hours, service area, services) are **fictional sample data**.

---

## Contents

1. [Technology stack](#technology-stack)
2. [Architecture](#architecture) · [Project structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Quick start: run locally with emulators (no credentials)](#quick-start-run-locally-with-emulators-no-credentials)
5. [Firebase project setup](#firebase-project-setup) (Firestore, Authentication, Functions, Hosting)
6. [Anthropic Claude setup](#anthropic-claude-setup)
7. [Environment variables](#environment-variables)
8. [Create the first admin](#create-the-first-admin) · [Seed the knowledge base](#seed-the-knowledge-base)
9. [Tests](#tests) · [Build](#build) · [Deploy](#deploy)
10. [Security configuration](#security-configuration)
11. [Known limitations](#known-limitations) · [Future enhancements](#future-enhancements)
12. [Definition-of-done status](#definition-of-done-status)

---

## Technology stack

| Area | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, plain responsive CSS |
| Backend | Firebase: Authentication, Cloud Firestore, Security Rules, Cloud Functions (v2, Node 22), Hosting, Emulator Suite |
| AI | Anthropic Claude via the official SDK, **server-side only** (`functions/src/ai/claudeProvider.ts`); deterministic mock provider for development |
| Validation | Zod (client for UX, server as source of truth) |
| Testing | Vitest, Testing Library, `@firebase/rules-unit-testing`, Firebase emulators |

## Architecture

Layered and modular: **Presentation** (customer site + admin dashboard) → **Application** (callable Cloud Functions: controllers, AI orchestration, service requests, escalations, authorization, audit) → **Data & integration** (Auth, Firestore, approved knowledge base, Claude API).

Full diagrams and data flows: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) · security/rules strategy: [`docs/architecture/SECURITY.md`](docs/architecture/SECURITY.md) · requirement traceability: [`docs/requirements/REQUIREMENTS.md`](docs/requirements/REQUIREMENTS.md) · testing: [`docs/testing/TESTING.md`](docs/testing/TESTING.md).

## Project structure

```
officelume/
├── src/                       React app
│   ├── components/            Reusable UI (Button, Field, Alert, StatusBadge, DataState…)
│   ├── features/
│   │   ├── auth/              AuthProvider, RequireAdmin route guard
│   │   ├── chat/              Floating AI receptionist widget (ChatWidget, ChatWidgetProvider, ChatPanel, useChat)
│   │   ├── escalations/       Human-help form
│   │   ├── serviceRequests/   Request form + admin filters
│   │   └── admin/             Admin UI building blocks (tables, notes, status updater)
│   ├── firebase/config.ts     The ONLY Firebase initialisation
│   ├── services/              All Firebase/Functions access (callables, Firestore reads, auth)
│   ├── validation/            Zod schemas (client-side)
│   ├── types/                 Domain constants + models (User, KnowledgeArticle, ServiceRequest, Escalation, ChatSession, ChatMessage, AuditLog, AIResponse)
│   ├── layouts/  pages/  hooks/  utils/  styles/
├── functions/                 Cloud Functions (TypeScript)
│   ├── src/
│   │   ├── ai/                orchestrator, safety guards, retrieval, prompt, parser, grounding, Claude + mock providers
│   │   ├── serviceRequests/  escalations/  knowledge/   controlled business operations
│   │   ├── auth/              requireAdmin + admin login audit
│   │   ├── audit/             audit logging
│   │   └── shared/            config, validation, rate limit, numbering, status rules, errors
│   └── test/                  unit tests + emulator integration tests
├── scripts/
│   ├── seed/                  seed.ts · grant-admin.ts · knowledgeBase.ts · evaluate-ai.ts · generate-scenario-doc.ts
│   └── smoke-emulator.ts      end-to-end emulator smoke test
├── test/rules/                Firestore security-rules tests
├── docs/                      architecture · requirements · testing (66 AI scenarios)
├── firebase.json  firestore.rules  firestore.indexes.json  .firebaserc  .env.example
```

---

## Prerequisites

* **Node.js 22+** (developed on Node 24) and npm
* **Java 21** (only for emulator-based tests; the Firestore emulator needs a JVM)
* A **Google/Firebase account** (for real deployment). Cloud Functions and Secret Manager require the **Blaze (pay-as-you-go)** plan.
* An **Anthropic API key** (only for live Claude answers; not needed for local development)

The Firebase CLI is a project dev-dependency, so use `npx firebase …` (no global install needed).

```powershell
npm install
npm run functions:install
```

---

## Quick start: run locally with emulators (no credentials)

This runs the whole system - customer site, admin dashboard, Auth, Firestore, Cloud Functions - on your machine using the **mock AI provider**.

**Terminal 1 - emulators**

```powershell
npm run functions:build
npm run emulators            # auth :9099, firestore :8080, functions :5001, UI :4000
```

**Terminal 2 - seed data and create an admin** (emulator mode is detected from the env vars)

```powershell
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
npm run seed -- --with-samples
$env:ADMIN_INITIAL_PASSWORD = "pick-a-long-local-password"   # emulator only; not stored anywhere
npm run admin:create -- --email admin@example.com --name "Local Admin"
Remove-Item Env:ADMIN_INITIAL_PASSWORD
```

**Terminal 3 - web app**

```powershell
$env:VITE_USE_EMULATORS = "true"
npm run dev                  # http://localhost:5173
```

Try it: click **Ask OfficeLume** (floating button, lower-right of every page) and ask "What areas do you service?", then "Do you offer a lifetime warranty?" (escalates), submit a request at `/request-service`, and sign in at `/admin/login`.

Bash equivalents: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed -- --with-samples`, `VITE_USE_EMULATORS=true npm run dev`.

To use the **real Claude API in the emulator**, copy `functions/.secret.local.example` to `functions/.secret.local` (git-ignored), put your key in it, and restart the emulators. With no key the functions log a warning and use the mock provider.

---

## Firebase project setup

### 1. Create the project

1. [Firebase Console](https://console.firebase.google.com) → **Add project**. Upgrade to **Blaze**.
2. Project settings → **Your apps** → add a **Web app** and copy its config into `.env.local` (see [Environment variables](#environment-variables)).
3. Put your project id in [`.firebaserc`](.firebaserc) (replace the placeholder `officelume-demo`), or run `npx firebase use <project-id>`.
4. Log in: `npx firebase login`.

### 2. Firestore

1. Console → **Firestore Database** → **Create database** (production mode - the deny-by-default rules are deployed from this repo).
2. `npx firebase deploy --only firestore` publishes [`firestore.rules`](firestore.rules) and [`firestore.indexes.json`](firestore.indexes.json) (no composite indexes are required).
3. Recommended: add a **TTL policy** on collection group `rateLimits`, field `expiresAt` (Console → Firestore → TTL) so rate-limit buckets clean themselves up.

### 3. Authentication

Console → **Authentication** → **Sign-in method** → enable **Email/Password**. Do **not** enable public sign-up UI (the app has none) - admins are created by you. See [Create the first admin](#create-the-first-admin).

### 4. Cloud Functions

* Region is `us-central1` (`functions/src/shared/config.ts`); if you change it, set `VITE_FUNCTIONS_REGION` too.
* Optional parameters (set in `functions/.env.<project-id>` or answer the deploy prompt): `AI_PROVIDER` (`claude` default, or `mock`) and `CLAUDE_MODEL` (default `claude-opus-5`).
* Deploy: `npm run deploy` (builds the web app and functions, then `firebase deploy`).

### 5. Hosting

`firebase.json` serves `dist/` with SPA rewrites and security headers. `npm run deploy` includes it.

---

## Anthropic Claude setup

1. Create an API key in the [Anthropic Console](https://console.anthropic.com).
2. Store it in Firebase **Secret Manager** (never in git or `.env`):

   ```powershell
   npx firebase functions:secrets:set ANTHROPIC_API_KEY
   ```

   Paste the key when prompted. It is bound only to the `askOfficeLume` function.
3. Redeploy functions: `npx firebase deploy --only functions`.
4. To change the model set `CLAUDE_MODEL` (e.g. `claude-sonnet-5` for lower cost). The provider uses structured JSON output and low effort to keep answers fast.

**No key yet?** Set `AI_PROVIDER=mock`, or run the emulator without a key. Note: `askOfficeLume` declares the secret, so a *real deployment* requires the secret to exist in Secret Manager (create it with any value while you use `AI_PROVIDER=mock`).

Cost/latency guidance: answers are short and context is limited to ≤ 4 approved articles.

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | `.env.local` (browser) | Public Firebase web-app identifiers. Not secrets. |
| `VITE_FUNCTIONS_REGION` | `.env.local` | Must match the functions region (default `us-central1`) |
| `VITE_USE_EMULATORS` | shell / `.env.local` | `true` → use local emulators |
| `ANTHROPIC_API_KEY` | **Secret Manager** (prod) / `functions/.secret.local` (emulator) | Claude credential - **server-side only** |
| `AI_PROVIDER`, `CLAUDE_MODEL` | Functions params | `claude`\|`mock`, model id |
| `ADMIN_INITIAL_PASSWORD` | shell (one-off) | Only if you let `admin:create` create an Auth user |

Only `.env.example` is committed; `.env*` files and secret files are git-ignored.

---

## Create the first admin

Authorization = a **`role: admin` custom claim** + an **active `users/{uid}` profile**. Only the Admin SDK can set either, so browser code can never grant itself access.

1. Console → Authentication → **Add user** (email + a strong password).
2. Give that account admin rights using Application Default Credentials:

   ```powershell
   gcloud auth application-default login          # once
   npm run admin:create -- --email you@example.com --project <project-id> --yes
   ```

   Sign out/in if the user was already signed in.
3. Revoke later: `npm run admin:create -- --email you@example.com --revoke --project <project-id> --yes` (sets `active:false`, removes the claim, revokes tokens - access ends immediately).

No password is ever hard-coded; the script refuses to touch a live project without `--yes`.

## Seed the knowledge base

```powershell
npm run seed -- --project <project-id> --yes                 # default HVAC knowledge base (safe to re-run)
npm run seed -- --project <project-id> --yes --with-samples  # + sample requests/escalations (dev only)
npm run seed -- --project <project-id> --yes --force         # reset articles to defaults
```

Existing articles are left alone unless `--force` is used. Content lives in [`scripts/seed/knowledgeBase.ts`](scripts/seed/knowledgeBase.ts) (17 articles: hours, services, brands, service area, pricing, scheduling, emergency, policies, contact). Administrators then manage it at `/admin/knowledge`.

---

## Tests

```powershell
npm test                    # web unit + component tests
npm run functions:test      # functions unit tests + 66-scenario AI evaluation (mock)
npm run test:rules          # Firestore rules   (needs Java; starts the emulator)
npm run test:integration    # handlers vs. Firestore emulator
npm run functions:build ; npm run smoke   # end-to-end through Auth+Functions+Firestore emulators
npm run test:all            # the four Vitest suites
npm run typecheck ; npm run lint
npm run ai:evaluate         # capstone scenario metrics (add -- --provider claude for the live model)
```

See [`docs/testing/TESTING.md`](docs/testing/TESTING.md) and [`docs/testing/TEST_SCENARIOS.md`](docs/testing/TEST_SCENARIOS.md).

## Build

```powershell
npm run build               # type-check + production bundle in dist/
npm run functions:build     # compile Cloud Functions to functions/lib
```

## Deploy

```powershell
npx firebase use <project-id>
npx firebase functions:secrets:set ANTHROPIC_API_KEY     # first time
npm run deploy                                            # web + functions + rules + hosting
npm run seed -- --project <project-id> --yes              # first time
npm run admin:create -- --email you@example.com --project <project-id> --yes   # first time
```

---

## Security configuration

* **Firestore rules**: deny by default; no client writes; admin-only reads; admin = claim **and** active profile. Details: [`docs/architecture/SECURITY.md`](docs/architecture/SECURITY.md).
* **Functions**: every admin callable calls `requireAdmin()`; public callables validate, rate limit, and audit.
* **Secrets**: Secret Manager only; nothing sensitive in the bundle. Scan yourself with `grep -rn "sk-ant" . --exclude-dir=node_modules --exclude-dir=dist` (expected: only test strings and docs).
* **Recommended before real use**: App Check, restrictive CORS, admin MFA, billing alerts (see SECURITY.md).

---

## Known limitations

* **AI quality against live Claude has not been measured in this repository.** The 66-scenario evaluation ran against the deterministic mock; run `npm run ai:evaluate -- --provider claude` and record the result for your report. Live latency vs. the ~5 s target is likewise unmeasured.
* **Not deployed or tested against a real Firebase project.** Verification was done with the emulator suite (rules, handlers, end-to-end HTTP calls) - not against production Firebase, real Secret Manager, or the real Claude API.
* **Admin UI was verified by component tests and screenshots of the public pages, not by an automated browser session against live admin data.** The admin functions and rules behind it are tested end to end.
* Retrieval is keyword/IDF based (adequate for a small knowledge base); no embeddings.
* Admin tables load the latest 200 records and filter client-side; no pagination.
* Rate limiting is per hashed IP and fixed-window; use App Check for stronger bot protection.
* Notifications (email/SMS) to customers or staff are not implemented; staff use the dashboard.
* No customer-facing request lookup by reference number (avoids exposing data without accounts).
* Chat history for continuity is limited to the last few turns; sessions cap at 40 messages.
* Business-hours text on the home page hero is static and must be kept in sync with the knowledge base.
* `npm audit` reports moderate advisories in transitive **dev** dependencies of `firebase-tools`; none are in the shipped runtime bundle.

## Future enhancements

Explicitly **out of scope** for this MVP: voice receptionist, phone integration, SMS, fax, payment processing, full CRM, live calendar synchronisation, multi-tenant SaaS, mobile apps, marketing automation, advanced analytics, multi-language voice, and production contact-center features. Nearer-term ideas: App Check, staff email alerts, embedding-based retrieval, admin pagination, per-admin roles, reference-number lookup for customers, automated accessibility audit.

---

## Definition-of-done status

| Item | Status |
|---|---|
| Customer can open the app, ask a question, get a grounded answer from Firestore knowledge | ✅ (emulator-verified; mock or Claude provider) |
| Unsupported questions escalate rather than hallucinate | ✅ tests + 17/17 escalation scenarios |
| Service request persisted; reference number shown | ✅ |
| Admin login with Firebase Auth; unauthorized users blocked from admin | ✅ route guard + rules + functions |
| Admin views requests, updates status, views/updates escalations, manages knowledge | ✅ |
| Important events in audit logs | ✅ 13 event types |
| Firestore rules protect privileged data | ✅ 28 emulator tests |
| Secrets not in browser code | ✅ server-side key via Secret Manager |
| Project builds; README explains setup | ✅ |
| Live Claude call verified | ⏳ needs your API key - see [What you need to provide](#what-you-need-to-provide) |

### What you need to provide

1. A Firebase project (Blaze plan) id → `.firebaserc`, and its **web app config** → `.env.local`.
2. Enable **Email/Password** sign-in in the Firebase Console.
3. Your **`ANTHROPIC_API_KEY`** → `npx firebase functions:secrets:set ANTHROPIC_API_KEY`.
4. Create the admin user in the Console, then run `npm run admin:create`.
5. Optional: Firestore TTL policy on `rateLimits.expiresAt`; App Check.
# officelume
