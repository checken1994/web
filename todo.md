# Project TODO

## Core architecture and security

- [x] Read and apply the full-stack, OAuth, LLM integration, file-storage, periodic-updates, automation, and SCP audit guidance before implementation; accessibility/security review remains.
- [x] Define the server-side domain model for users, roles, sessions, messages, agents, capabilities, model routes, artifacts, scheduled jobs, job runs, and audit activities.
- [x] Enforce authentication for all dashboard routes and procedures.
- [x] Enforce owner/admin/user authorization boundaries for remote operations.
- [x] Ensure agent secrets, API keys, provider credentials, and session tokens never reach the browser; frontend secret scan is clean and auth is cookie-only.
- [x] Add server-side validation, audit logging, and safe error responses for all mutations.

## Dashboard and responsive UI

- [x] Build a dark, elegant responsive dashboard inspired by the reference image.
- [x] Add responsive sidebar/navigation for Sessions, Bots/Agents, AI Models, Artifacts, Scheduled Jobs, and Audit Activity.
- [x] Add overview cards for active sessions, agents, system health, jobs, and recent activity.
- [x] Add desktop and mobile layouts with keyboard focus, readable contrast, and empty/loading/error states; visual screenshots passed at 1280px and 375px widths.

## Sessions and messaging

- [x] Implement server-side session list, creation, status, timestamps, and recent activity query; frontend list is wired to server data with explicit empty/error states.
- [x] Implement server-side message history and LLM-backed message submission; frontend history is wired with selection and loading/error/empty states.
- [x] Implement request lifecycle states: queued, running, completed, failed, cancelled, and unknown.
- [ ] Add safe retry behavior; session cancel flow and audit events are implemented and authorization-tested, but full runtime lifecycle verification remains.

## Agents, capabilities, and model routing

- [x] Implement server-side agent registry and capability scope queries; frontend agent registry is wired to owner-scoped server data.
- [x] Implement admin-only capability enable/disable backend controls with audit events; UI controls and error feedback are wired, interactive verification remains.
- [x] Implement server-side model catalog and safe model selection with persisted owner-scoped model routes.
- [x] Route AI requests through backend procedures; never send API keys or provider secrets to the frontend.
- [x] Record model changes and request failure status in audit activity; provider fallback detail remains to be extended.

## Artifacts and evidence

- [x] Add artifact metadata, status, session association, MIME type, size, and created time.
- [x] Store file bytes through server-side S3 helpers and expose only authorized access URLs; artifact register enforces filename, MIME, base64 and 8 MiB limits, with owner-scoped access.
- [x] Implement evidence provenance fields including source session, operation, status, and hash when available.
- [x] Add safe authorized artifact access procedure returning a time-limited signed URL; UI includes authorized open/download action with error feedback.

## Scheduled jobs

- [x] Read and apply periodic-updates guidance before implementing recurring work.
- [x] Implement scheduled job records with schedule, enabled state, last run, next run, status, and error summary.
- [x] Implement enable/disable controls and audit events.
- [x] Implement job-run history with success, failure, timeout, cancelled, and unknown states.
- [x] Keep scheduled work compatible with the managed server runtime and avoid assuming an always-on worker.

## Audit and verification

- [x] Implement immutable-style audit activity records for logout, session commands, model changes, capability changes, artifact access, and job changes.
- [x] Add actor, action, target, status, timestamp, correlation ID, and sanitized metadata fields.
- [x] Add server tests for authorization and secret non-exposure; frontend browser-surface regression coverage added, mutation and lifecycle coverage remains to be extended.
- [ ] Add frontend verification for desktop/mobile navigation and critical flows; desktop/mobile screenshots and full verification passed, but interactive critical-flow evidence remains.
- [ ] Run typecheck, unit tests, build, accessibility review, and security review before first delivery. Typecheck, unit tests, build, browser-surface scan, regression test, landmark/focus/reduced-motion review passed; automated accessibility and interactive security checks remain.
- [ ] Save the first complete checkpoint only after all completed items are marked [x].

## Follow-up gaps found by verification

- [ ] Implement explicit admin-only/role-based authorization paths and tests for owner versus admin versus user behavior.
- [ ] Clarify auth design and prove that no readable API keys/provider secrets or session token values are exposed to frontend JavaScript; cookie-only auth, full browser-surface scan, and regression test pass, but deployed runtime trace remains unverified.
- [ ] Add consistent sanitized error handling and audit coverage for every mutation, including logout and database/service failures.
- [ ] Implement and verify all session cancel/unknown lifecycle states; cancel procedure, UI action, audit events and authorization tests exist, full state-matrix tests remain.
- [ ] Persist and validate selected models server-side and expose only safe catalog fields to the client.
- [ ] Add actual scheduled-job and capability enable/disable UI controls with frontend verification; controls are implemented, interactive verification remains.
- [x] Add job-run list/query endpoint and UI for failure, timeout, cancelled, and unknown records; populated runtime/test fixtures remain unavailable for full status-matrix verification.
- [x] Add session list UI wired to server data instead of static placeholders.
- [x] Add real session detail/history UI wired to trpc.sessions.history with selection, empty/error/loading states.
- [x] Add artifact provenance rendering and explicit Preview/Download actions with query/access loading and error states.
- [ ] Verify artifact metadata query and signed URL access interactively with authorized and missing-storage cases.
- [ ] Complete accessibility, responsive, security and frontend critical-flow verification; landmark/focus/reduced-motion and responsive review passed, automated accessibility and interactive checks remain.
- [ ] Run actual desktop and 375px mobile screenshot checks plus interactive session submit, model select, artifact open, and job toggle checks; desktop/mobile captures passed, interactive checks remain.
