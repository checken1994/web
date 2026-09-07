# SCP Control Plane — Security and Accessibility Evidence

## Scope

This audit covers the browser-delivered surface of the SCP Control Plane dashboard, its authentication transport, critical data wiring, and visible responsive structure. It does not prove production deployment security, provider-side policy behavior, or signed-URL access against real artifact bytes.

## Changes verified

The server now validates selected model IDs against the live model catalog before persisting owner-scoped routes. Unknown model IDs are rejected and covered by contract tests.

The browser now uses the HttpOnly session-cookie path only. The tRPC client sends credentials with requests but does not read session cookies, copy them to `sessionStorage`, or construct a Bearer `Authorization` header. A regression test scans source, public assets, and built browser assets for forbidden secret/token patterns. The unused template Map component was changed to fail closed until a server-side provider proxy exists; it no longer reads `VITE_FRONTEND_FORGE_API_KEY` or any provider credential.

The dashboard changed its nested content landmarks from nested `<main>` elements to labelled `<section>` elements. A skip link, visible focus styling, live error regions, associated command input label, reduced-motion media query, and explicit empty/loading/error states are present. Session history is selected and loaded through `trpc.sessions.history`; session cancellation is owner-scoped and audited; capability switches and job-run history are wired to protected server procedures; artifact provenance is rendered and Preview/Download actions call the authorized signed-URL procedure. Scheduled failures now write a sanitized `failed` run instead of returning raw provider/DB error text.

## Fresh evidence

| Check | Command or observation | Result |
|---|---|---|
| Type safety | `pnpm check` | Passed with exit code 0 |
| Unit/contract tests | `pnpm test` | 3 files, 11 tests passed |
| Production build | `pnpm build` | Vite and server bundle completed with exit code 0 |
| Browser secret scan | Literal scan over `client/src`, `client/public`, and `dist/public` | No forbidden secret/token patterns found |
| Regression guard | `server/frontend.security.test.ts` | Passed; fails closed on provider keys, secret envs, sessionStorage cookie reads, Bearer forwarding, or secret VITE env imports |
| Desktop visual check | Dashboard screenshot at 1280×720 | Captured successfully; layout remains readable |
| Mobile visual check | Dashboard screenshot at 375×812 | Captured successfully; mobile navigation and cards remain usable |
| Accessibility source review | Landmark, skip-link, label, focus, live-region, reduced-motion inspection | Improvements applied; automated WCAG audit and screen-reader test remain unavailable |

## Missing evidence and limits

An authenticated interactive browser trace was not available for mutation paths in this sandbox. Therefore session submission, model selection, capability/job toggle, artifact signed-URL success, and missing-storage denial remain open interactive checks. Contract coverage now proves unauthenticated denial for session cancel, artifact access, job-run history, capability mutation, artifact registration, plus the oversized artifact rejection path. The scheduled callback records a sanitized `failed` run when execution fails, but a live provider-triggered failure has not been observed. No claim is made that the dashboard is production-safe or fully WCAG-conformant; the evidence supports only the scoped checks above.
