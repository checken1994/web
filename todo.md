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
- [x] Add safe retry behavior for the latest failed command; retry reuses the latest user message only when the latest assistant result is failed, via the existing server-side send procedure. Full runtime lifecycle verification remains pending.

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
- [x] Add server tests for authorization and secret non-exposure; frontend browser-surface regression and targeted mutation/lifecycle coverage are present, with 9 test files/34 tests passing.
- [ ] Add frontend verification for desktop/mobile navigation and critical flows; session/model/audit, artifact register/Preview/Download and job create/Disable/Enable/Runs are browser-verified, including user screenshot confirmation that the temporary job ended Disabled; cancel runtime remains unexercised.
- [ ] Run typecheck, unit tests, build, accessibility review, and security review before first delivery; latest check/build pass, 9 files/34 tests pass, unauthenticated axe is clean, authenticated Overview axe is 0/25/0 and artifact/job evidence is recorded, but all-route axe and cancel runtime remain.
- [x] Save a checkpoint after all items with completed evidence were marked [x]; remaining unproven runtime/interactive items remain explicitly pending.

## Follow-up gaps found by verification

- [x] Implement explicit admin-only/role-based authorization paths and tests for admin versus user behavior; owner scoping is enforced in server helpers and remains subject to database-backed integration proof.
- [x] Clarify auth design and verify the browser source/build surface contains no readable API keys/provider secrets or session token values; cookie-only auth, full browser-surface scan, and regression test pass. Deployed runtime trace remains a stated limitation.
- [x] Add consistent sanitized error handling and audit coverage for every dashboard mutation, including logout and database/provider/service failures; targeted fault-path tests now cover all dashboard mutation families, including sessions.send DB/provider failures. Exhaustive provider permutations remain outside scope.
- [ ] Implement and verify all session cancel/unknown lifecycle states; pure matrix/router tests and UI/audit wiring pass, but live attempts #60001, #120001 and #150001 completed before Cancel could be issued.
- [x] Persist and validate selected models server-side and expose only safe catalog fields to the client; admin selection authorization is contract-tested.
- [x] Add actual scheduled-job and capability enable/disable UI controls with frontend/source verification; interactive verification remains a documented limitation.
- [x] Add job-run list/query endpoint and UI for failure, timeout, cancelled, and unknown records; populated runtime/test fixtures remain unavailable for full status-matrix verification.
- [x] Add session list UI wired to server data instead of static placeholders.
- [x] Add real session detail/history UI wired to trpc.sessions.history with selection, empty/error/loading states.
- [x] Add artifact provenance rendering and explicit Preview/Download actions with query/access loading and error states.
- [x] Verify artifact metadata query and signed URL access interactively; a safe owner-scoped artifact reached ready state and authenticated Preview/Download returned time-limited signed URLs with provenance/hash.
- [ ] Complete accessibility, responsive, security and frontend critical-flow verification; manual review, responsive screenshots, cookie-only auth, browser scan and unauthenticated automated checks pass, but authenticated automated WCAG and missing mutation flows remain.
- [x] Run desktop and 375px mobile screenshot checks plus authenticated session submit, model selection, artifact Preview/Download and scheduled-job toggle checks; all listed flows except cancel are exercised, with post-restart Scheduled jobs smoke capture also passing.
- [x] Validate models.select against the live server catalog before persistence and add invalid-model plus authorization contract tests; owner-scoped persistence remains database-integration scoped.
- [x] Add router-level cancel tests for distinct queued/running active cancellation and no-op terminal/unknown statuses; DB-backed integration remains outside the current test harness.
- [x] Add an explicit unknown-session-status router test proving cancel preserves it and records a no-op audit event.
- [ ] Capture authenticated interactive evidence for cancel pending/error/audit/state behavior; session #150001 was observed by an automated 10-second poll, but completed before Cancel appeared, so cancellation remains unproven.
- [x] Add distinct router-level queued->cancelled and running->cancelled tests instead of a generic changed=true case; suite passes with both cases plus terminal/unknown no-op cases.
- [x] Fail closed when models.select persistence returns null and audit the failure; dedicated fault-path test passes.
- [x] Add fault-path contract coverage for sanitized model persistence errors and failed audit status; broad injected failure matrix remains a future expansion.
- [x] Document and test the logout audit failure boundary: cookie clearing is local/observable, safeAudit isolates audit-store failure, and the focused injected failure test passes.
- [x] Add targeted failure-path contract coverage for session create/send/cancel, capability toggle, model select, artifact register/access, and job create/toggle/delete; 8 files/31 tests pass.
- [x] Record and test a failed audit event when sessions.send targets a missing or unauthorized session; both fail-closed cases now pass at the owner-scoped router boundary.
- [x] Add a contract test proving sessions.send for an existing non-owner session returns sanitized NOT_FOUND and records failed audit; the DB helper intentionally collapses missing/non-owner to the same safe result.
- [x] Fix authenticated navigation so `?section=sessions|agents|models|artifacts|jobs|audit` changes the rendered view, not only the URL; verified Sessions, Models, Artifacts, Jobs and Audit views in authenticated preview.
- [x] Add explicit loading/error/empty states to models, sessions, jobs, and audit detail views; authenticated preview verified Models loading/catalog, Artifacts loading, Jobs empty and Audit loading/records states.
- [x] Add targeted artifact access storage/presign failure test and verify sanitized error plus failed audit.
- [x] Add targeted sessions.send database failure test before message insert with sanitized error and failed audit.
- [x] Add targeted sessions.send provider/invokeLLM failure test after accepted audit with sanitized error and failed audit.
- [x] Fix New session flow: clicking the Overview CTA focuses and scrolls to the accessible server-backed command form instead of routing to an empty Sessions view; authenticated browser verified.
- [x] Refresh session list and select the created session after successful command submission; authenticated network/browser evidence reconciled session #1, completed status, and message history after the stale-query fix.
- [x] Run a fresh authenticated command after the stale-query fix and verify automatic navigation to Sessions with the new session selected and history visible without reload or manual click; end-to-end browser evidence passed for session #30001.
- [ ] Run authenticated cancel-flow testing against a real queued/running session and verify pending, success/no-op, error and audit outcomes; three controlled attempts completed before the action was available.
- [x] Create one safe owner-scoped artifact and one safe owner-scoped scheduled job through explicit dashboard forms, then verify artifact Preview/Download, job Disable/Enable and empty Runs state without fake customer data.
- [x] Run automated accessibility checks for the unauthenticated surface and source contracts; Playwright + axe reports zero violations and 3 accessibility contract assertions pass.
- [ ] Complete automated accessibility coverage for all authenticated dashboard routes, including labels, focus order, contrast and reduced-motion behavior; authenticated Overview axe now reports 0 violations/25 passes/0 incomplete, while all-route repetition and standalone storage-state execution remain.
- [x] Create one safe owner-scoped artifact and one safe owner-scoped scheduled job through the explicit dashboard forms; artifact register/Preview/Download and job create/Disable/Enable/Runs empty-state were verified end-to-end without fake customer data.
- [ ] Run authenticated cancel-flow testing against a real queued/running session and verify pending, success/no-op, error and audit outcomes; three controlled attempts completed before the action was available.
- [x] Reconcile the stale Vite parser error reported at Home.tsx line 104; current source is valid, restart boot is clean, typecheck passes, 34 tests pass and production build succeeds.
- [x] Fix session list row semantics so the active-session Cancel control is not nested inside a `<button>`; rows now use keyboard-accessible role=button semantics, child Cancel remains a real button, and browser smoke/typecheck/tests/build pass.
- [ ] Add and verify an authenticated axe harness that accepts an external Playwright storage-state file without embedding cookies/tokens; connected-browser axe passed with 0 violations, but the standalone storage-state harness has not been run with a real state file.
- [x] Fix authenticated landmark regression: SidebarInset supplies the single main landmark; `#main-content` is now a focusable DIV, skip-link target remains valid, `mainCount=1`, and nested buttons remain zero in authenticated DOM inspection.
- [x] Fix authenticated axe `button-name` violation: the model-options icon button in Home.tsx now has `aria-label="More model options"`; authenticated axe rerun reports zero violations.
- [x] Make dashboard contrast auditable: decorative gradients were replaced with opaque backgrounds/inset shadow and contrast tokens were raised; authenticated axe now reports 0 violations, 25 passes and 0 incomplete results.
