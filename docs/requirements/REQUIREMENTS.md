# OfficeLume Requirements Traceability

Every functional and non-functional requirement, where it is implemented, and how it is verified.

## Functional requirements

| ID | Requirement | Implementation | Verification |
|---|---|---|---|
| FR-01 | Customers can submit text-based HVAC inquiries | `src/features/chat/*` → `askOfficeLume` (`functions/src/ai/chatHandler.ts`) | `ChatPanel.test.tsx`, integration "AI chat", smoke |
| FR-02 | Retrieve relevant info from the approved knowledge base | `functions/src/ai/retrieval.ts` over **active** `knowledgeBase` docs | `orchestrator.test.ts` (inactive ignored), integration "only uses ACTIVE knowledge" |
| FR-03 | Generate a grounded response when approved info suffices | `orchestrator.ts` + `claudeProvider.ts` + `grounding.ts` | `scenarios.test.ts` (FAQ/pricing/scheduling), `parser.test.ts` |
| FR-04 | Escalate unsupported/complex questions | orchestrator: no-knowledge, invalid output, provider error, grounding violation → escalation | `orchestrator.test.ts`, scenario set (17/17 escalation cases) |
| FR-05 | Customers submit HVAC service requests | `ServiceRequestForm.tsx` → `submitServiceRequest` | `ServiceRequestForm.test.tsx`, integration, smoke |
| FR-06 | Unique reference number per service request | `shared/numbering.ts` (`SR-YYYY-NNNNNN`, transactional counter) | `infrastructure.test.ts`, integration (sequential, unique) |
| FR-07 | Unique reference number per escalation | same (`ESC-YYYY-NNNNNN`) | integration, smoke |
| FR-08 | Admin authentication before admin data is shown | `RequireAdmin`, `AuthProvider`, Firestore rules, `requireAdmin` | `RequireAdmin.test.tsx`, rules tests, `authorization.test.ts`, smoke |
| FR-09 | Admins review requests | `RequestsPage`, `RequestDetailPage`, `DashboardPage` | component/service code; `filters.test.ts` |
| FR-10 | Admins update request status | `updateServiceRequestAdmin` + `StatusUpdater` | integration (transitions, history, audit), smoke |
| FR-11 | Admins review and resolve escalations | `EscalationsPage` + `updateEscalationAdmin` | integration |
| FR-12 | Admins maintain approved HVAC knowledge | `KnowledgePage` + `saveKnowledgeArticleAdmin` (create/update/deactivate) | integration "manages knowledge", smoke |
| FR-13 | Record important events | `functions/src/audit/audit.ts`; `AuditPage` | integration and smoke assert each event type |
| FR-14 | Disclose that the receptionist uses AI | hero disclaimer, chat header/disclaimer, "OfficeLume (AI)" labels, privacy notice, About page | `ChatPanel.test.tsx` |
| FR-15 | Offer human escalation when the AI cannot answer | `escalation-prompt` buttons, "Talk to a person", `/#help`, `EscalationForm` | `ChatPanel.test.tsx`, `FrontDesk` |

### Audit events implemented

`ADMIN_LOGIN_SUCCESS`, `ADMIN_LOGIN_FAILURE`, `SERVICE_REQUEST_CREATED`, `SERVICE_REQUEST_STATUS_UPDATED`, `SERVICE_REQUEST_NOTE_ADDED`, `ESCALATION_CREATED`, `ESCALATION_STATUS_UPDATED`, `ESCALATION_NOTE_ADDED`, `AI_RESPONSE_GENERATED`, `AI_RESPONSE_ESCALATED`, `KNOWLEDGE_CREATED`, `KNOWLEDGE_UPDATED`, `KNOWLEDGE_DEACTIVATED`.

## Non-functional requirements

| ID | Requirement | How it is met | Notes / evidence |
|---|---|---|---|
| NFR-01 | Performance (routine ops ≲ 2 s, AI ≲ 5 s; loading state) | Single-round-trip callables; aggregate `getCountFromServer` for dashboard stats; Claude called with `effort: low`, short output, 20 s hard timeout; typing indicator in chat | Emulator smoke: non-AI calls ~50-250 ms. **AI latency with live Claude must be measured** (`npm run ai:evaluate -- --provider claude` prints per-scenario ms). |
| NFR-02 | Usability | Plain-language labels, suggested questions, inline field errors, focus moved to first error, single-page request form | - |
| NFR-03 | Reliability - AI failure must not break the app | Provider errors/timeouts/refusals/invalid output → friendly message + escalation offer; chat and forms are independent | `orchestrator.test.ts` (reliability), `ChatPanel.test.tsx` |
| NFR-04 | Security | Firebase Auth, rules, protected functions, validation, Secret Manager, least privilege | [SECURITY.md](../architecture/SECURITY.md), rules tests, smoke |
| NFR-05 | Privacy | Only required fields collected; no demographics; PII redacted from chat logs and model input; audit log allow-list | `infrastructure.test.ts`, integration |
| NFR-06 | Maintainability | Separated UI / services / validation / types / provider / business rules; small modules | Directory layout in README |
| NFR-07 | Scalability of design | Provider and Firebase access behind service abstractions; stateless functions | `AIProvider` interface |
| NFR-08 | Accessibility | Semantic landmarks, labelled controls, `role="alert"` errors, `aria-live` chat log, skip links, keyboard-operable nav, visible focus, reduced-motion support | Manual review; automated a11y audit is a listed future task |

## Ethical AI requirements

| Requirement | Control |
|---|---|
| Identify as AI | Disclosure in UI + deterministic identity answer |
| Not a licensed technician | Identity guard + output check |
| No unsafe repair instructions | Hazardous-DIY / life-safety guards (`safety.ts`), tests `SAF-*`, `EMG-04..06` |
| No discrimination / no protected-characteristic inference | No demographic fields; system prompt rule; no prioritisation logic exists in code |
| No invented policies/prices/availability | Grounded prompt + `grounding.ts` + escalation |
| Human escalation always available | "Talk to a person" button always visible; `/#help` link in nav |

## Definition-of-done checklist

See the final section of the [README](../../README.md#definition-of-done-status).
