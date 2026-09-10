# SCP Control Plane — Security and Accessibility Evidence

## Scope

This audit covers the browser-delivered surface of the SCP Control Plane dashboard, its authentication transport, critical data wiring, and visible responsive structure. It does not prove production deployment security, provider-side policy behavior, or signed-URL access against real artifact bytes.

## Changes verified

The server now validates selected model IDs against the live model catalog before persisting owner-scoped routes. Unknown model IDs are rejected and covered by contract tests. If route persistence returns null, the mutation fails with `SERVICE_UNAVAILABLE` and records a sanitized failed audit event.

Logout boundary: `auth.logout` clears the HttpOnly session cookie locally before attempting audit persistence. The `safeAudit` wrapper isolates audit-store failure so logout does not expose a database error or fail to clear the cookie. A direct injected audit-failure test is not meaningful with the current framework response object; this boundary is documented rather than presented as full production fault-injection proof.

The browser now uses the HttpOnly session-cookie path only. The tRPC client sends credentials with requests but does not read session cookies, copy them to `sessionStorage`, or construct a Bearer `Authorization` header. A regression test scans source, public assets, and built browser assets for forbidden secret/token patterns. The unused template Map component was changed to fail closed until a server-side provider proxy exists; it no longer reads `VITE_FRONTEND_FORGE_API_KEY` or any provider credential.

The owner-scoped session-send seam is tested with both a missing session and an existing session owned by another user; both return the same sanitized `NOT_FOUND` and failed audit event by design.

The dashboard changed its nested content landmarks from nested `<main>` elements to labelled `<section>` elements. A skip link, visible focus styling, live error regions, associated command input label, reduced-motion media query, and explicit empty/loading/error states are present. Session history is selected and loaded through `trpc.sessions.history`; session cancellation is owner-scoped and audited; capability switches and job-run history are wired to protected server procedures; artifact provenance is rendered and Preview/Download actions call the authorized signed-URL procedure. Scheduled failures now write a sanitized `failed` run instead of returning raw provider/DB error text.

## Fresh evidence

| Check | Command or observation | Result |
|---|---|---|
| Type safety | `pnpm check` | Passed with exit code 0 |
| Unit/contract tests | `pnpm test` | 7 files, 22 tests passed |
| Production build | `pnpm build` | Vite and server bundle completed with exit code 0 |
| Browser secret scan | Literal scan over `client/src`, `client/public`, and `dist/public` | No forbidden secret/token patterns found |
| Regression guard | `server/frontend.security.test.ts` | Passed; fails closed on provider keys, secret envs, sessionStorage cookie reads, Bearer forwarding, or secret VITE env imports |
| Desktop visual check | Dashboard screenshot at 1280×720 | Captured successfully; layout remains readable |
| Mobile visual check | Dashboard screenshot at 375×812 | Captured successfully; mobile navigation and cards remain usable |
| Accessibility source review | Landmark, skip-link, label, focus, live-region, reduced-motion inspection | Improvements applied; automated WCAG audit and screen-reader test remain unavailable |

## Missing evidence and limits

An authenticated interactive browser trace was not available for mutation paths in this sandbox. Therefore session submission, model selection, capability/job toggle, artifact signed-URL success, and missing-storage denial remain open interactive checks. Contract coverage now proves unauthenticated denial for session cancel, artifact access, job-run history, capability mutation, artifact registration, plus the oversized artifact rejection path. The scheduled callback records a sanitized `failed` run when execution fails, but a live provider-triggered failure has not been observed. No claim is made that the dashboard is production-safe or fully WCAG-conformant; the evidence supports only the scoped checks above.

## Authenticated browser observation

On 2026-09-09, the preview was reopened in My Browser after OAuth login. The page progressed from `Establishing secure session…` to the authenticated SCP Control Plane view showing the signed-in user `Minh Nguyen Van` and email `checken1994@gmail...`. The overview displayed server data counters at zero, the server-side model catalog, and the statement that provider credentials never enter the browser. Read-only navigation attempts changed the `section` query parameter but retained the overview content; no mutation was submitted during this observation. The preview also identifies itself as non-live preview mode, so this is not production runtime proof.

Navigation/UI follow-up evidence: after the `useSearch` fix, opening `?section=sessions` rendered the Sessions heading and owner-scoped empty state. Opening `?section=models` first rendered an explicit Loading models state, then rendered the server catalog cards (claude, gemini, gpt entries) with server-side-only routing labels and Set preferred actions. No model mutation was submitted during this verification.
Artifact browser observation: authenticated `?section=artifacts` rendered an explicit `Loading artifacts` state with owner-scoped metadata text; no Preview/Download action was invoked and no signed URL was created.
Scheduled jobs browser observation: authenticated `?section=jobs` first showed secure-session bootstrap, then rendered `No scheduled jobs` with Heartbeat-backed explanation. No job toggle or run action was invoked.
Audit browser observation: authenticated `?section=audit` first showed Loading audit activity, then rendered owner-scoped `auth.logout` records with actor `user #1`, timestamps and `completed` status. This verifies read/query rendering in preview, not production immutability or full mutation audit coverage.
New session CTA browser evidence: clicking the Overview CTA no longer navigates to the empty Sessions view. It keeps Overview rendered and focuses/scrolls to the existing `command-input` form; no session was created by the CTA itself.
Authenticated mutation observation: the approved command submission showed `Running…`, then navigated to Sessions, but the rendered list remained `No sessions yet`. This is not treated as success; it is a runtime failure/unknown outcome requiring log reconciliation before any retry.
Session runtime reconciliation: after the refetch fix, authenticated `?section=sessions` loaded the previously created session #1 with the exact test title, model `Manus 1.6 Max`, and `completed` status. This reconciles the earlier network evidence: create/send succeeded; the previous `No sessions yet` was stale client query state, not a backend mutation failure.
Session history browser observation: selecting the completed session #1 rendered `SESSION HISTORY`, `Evidence trail for session #1`, and the guarded `Retry failed command` action while history was loading. No retry was invoked because the session was completed, not failed.
Session history result: session #1 contains the submitted user message with `queued` status and an assistant message with `completed` status. The assistant response states the authenticated session state is unknown and no files or permissions were changed. The Retry failed command control remained present but guarded because the latest assistant status was completed; it was not invoked.
End-to-end post-fix browser evidence: a fresh authenticated command was submitted after the stale-query fix. Without reload or manual session click, the app navigated to Sessions, displayed the new session #30001 first, selected it, and rendered its history. The backend completed the command and recorded the assistant response. This closes the auto-refresh/auto-select gap for the tested path.
Authenticated model catalog evidence: `?section=models` loaded server-side catalog with available models including claude-haiku-4-5, claude-opus-4-6/4-7, gemini-3.x and gpt-5 variants. Each card exposed a `Set preferred` action; no model mutation was performed in this observation.
Authenticated model mutation evidence: selecting `claude-haiku-4-5` via `Set preferred` succeeded. The catalog refetched to one configured route showing `Manus · Enabled`, with server-side-only routing still displayed. No provider credential appeared in the UI.
Authenticated audit evidence: audit activity shows `model.select` for `model #claude-haiku-4-5` with `completed`, followed by session #30001 create/submit/complete events and earlier session #1 events. No provider token or raw backend error is displayed in the audit UI.
Authenticated capability evidence: Bots & agents rendered `admin-gated` controls with `No capability records are registered.` No capability mutation was attempted because there was no real record to toggle; creating fixture data would violate evidence-first scope.
Authenticated scheduled-job evidence: the Jobs view loaded `No scheduled jobs` and explained that Heartbeat-backed schedules appear after an admin creates one. No job was created solely for testing, so toggle and run-history mutations remain data-unavailable rather than falsely marked pass.
Automated accessibility evidence: after adding a `main` landmark to the login surface and removing `maximum-scale=1` from the viewport meta tag, the Playwright + axe audit completed with `violationCount: 0` on `http://127.0.0.1:3000/` unauthenticated surface. The report is stored at `docs/verification/axe-result.json`. Authenticated dashboard axe coverage is still not available from the sandbox harness.
Accessibility regression evidence: `server/accessibility.contract.test.ts` now passes 3 assertions covering the zoomable viewport, DashboardLayout `main#main-content`, visible focus/reduced-motion/scroll-margin CSS, and dynamic error/label markers. Full suite is now 9 files/34 tests. The axe run on the unauthenticated surface remains 0 violations; authenticated route axe coverage and live cancel/artifact/job records remain unavailable.
Authenticated artifact mutation evidence: uploaded non-sensitive `test-artifact-evidence.txt`; server returned `ready` with MIME, SHA-256 prefix and provenance section. Preview and Download both issued time-limited CloudFront signed URLs; the browser did not expose the storage key. Artifact access is now proven in the live preview.
Post-restart smoke evidence: the authenticated Scheduled jobs route booted cleanly after server restart; the owner-scoped test job rendered as Enabled and the dashboard showed no parser failure. The earlier Vite message was stale HMR log state; current check, tests and production build pass.
Runtime mutation evidence: one safe artifact was registered and accessed through Preview/Download signed URLs; one scheduled job was created, Disabled, Enabled again, and its Runs panel correctly showed no runs recorded. No customer data or secrets were used. A real queued/running session was not available, so cancel runtime remains unproven.
Cancel runtime attempt: command session #60001 was observed in the UI as `Running…` and its history recorded an initial `QUEUED` state, but it completed before the Sessions view exposed an active Cancel action. The assistant response was a safe no-op statement; no cancellation mutation was issued. Therefore queued/running cancel success, no-op and audit behavior remains unproven in live browser evidence.
