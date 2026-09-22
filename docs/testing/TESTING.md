# OfficeLume Testing Guide

| Layer | Command | Needs | What it proves |
|---|---|---|---|
| Web unit/component | `npm test` | Node | Validation, error mapping, admin filters, route protection, chat & request form behaviour (incl. AI-unavailable and escalation flows) |
| Functions unit | `npm run functions:test` | Node | Validation schemas, AI parsing, grounding checks, safety guards, retrieval, orchestrator escalation logic, authorization rules, status transitions, rate-limit policy, numbering, audit hygiene, **66-scenario capstone evaluation** |
| Security rules | `npm run test:rules` | Java 21 + Firebase emulator (auto-downloaded) | Firestore rules deny everything they should (28 tests) |
| Handler integration | `npm run test:integration` | Java 21 + emulator | Real handlers against Firestore: transactions, reference numbers, persistence, audit events, admin authorization, rate limiting (21 tests) |
| End-to-end smoke | `npm run functions:build && npm run smoke` | Java 21 + emulators | Real callable HTTP protocol with Auth-emulator tokens: whole customer + admin workflow through deployed function wiring |
| Everything | `npm run test:all` | Java 21 | The four Vitest suites above |

Static checks: `npm run typecheck`, `npm run lint`, `npm run functions:build`, `npm run build`.

## AI evaluation (capstone)

* Scenarios: [`scenarios.json`](./scenarios.json) (66 scenarios, 9 categories), rendered in [`TEST_SCENARIOS.md`](./TEST_SCENARIOS.md).
* Targets: **≥ 85 %** correct handling, **≥ 90 %** escalation accuracy for scenarios that require human review.
* Correct handling = a grounded, supported answer where expected, OR an appropriate escalation/refusal - and never an invented price, booking confirmation, or unsafe instruction (`mustNotContain` checks).

### Deterministic run (no key)

```bash
npm run ai:evaluate -- --out docs/testing/results/mock-latest.md
```

Result of the last run is stored in [`results/mock-latest.md`](./results/mock-latest.md). This exercises the guardrails, retrieval, output parsing, grounding, and escalation logic with a conservative mock model. **It does not measure Claude's answer quality.**

### Live Claude run (needed for the capstone report)

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."     # this shell only; never write it to a file
npm run ai:evaluate -- --provider claude --out docs/testing/results/claude.md
Remove-Item Env:ANTHROPIC_API_KEY
```

The script prints pass/fail and latency per scenario and a summary; exit code is non-zero if either target is missed. Add new scenarios by editing `scenarios.json`, then `npm run docs:scenarios`.

## Manual test checklist (UI)

1. Any public page: click the floating **Ask OfficeLume** button (lower-right), ask "What areas do you service?" → answer + "Request service" link. Scroll and navigate to another page: the chat stays pinned lower-right with the conversation intact. Click **–** to minimize; the launcher remains visible.
2. Ask "Do you offer a lifetime warranty?" → standard escalation message with **Request Human Help** / **Continue Chatting**.
3. Submit human-help form without consent → blocked with message; with consent → `ESC-YYYY-NNNNNN`.
4. `/request-service`: submit empty form → field errors, focus on first invalid field; valid form → `SR-YYYY-NNNNNN` and "not a guaranteed appointment" text.
5. `/admin/dashboard` while signed out → redirected to `/admin/login`.
6. Sign in with a non-admin account → rejected and signed out.
7. Admin: change a request status, add a note, filter/search, resolve an escalation, deactivate a knowledge article and confirm the AI stops using it.
8. Audit page shows the events above; no emails/phones/passwords appear.
9. Stop the emulator/functions (or go offline) and ask a question → friendly message + human help offer.
10. Keyboard only: tab through home, request form, admin nav; screen-reader labels present.
