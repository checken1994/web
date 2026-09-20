# Plan: Bidirectional SCP Command Channel

## Capability map

| Module | Responsibility | Depends on |
|---|---|---|
| command-contract | schema, allowlist, state transitions | — |
| command-store | durable queue, lease, result, cancel | command-contract, database |
| bridge-transport | poll/claim/submit-result over outbound HTTPS | command-contract, command-store |
| dashboard-control | create/list/cancel command UI and tRPC procedures | command-contract, command-store |
| verification | security, lifecycle, mock runtime and evidence | all modules |

Build order: command-contract → command-store → bridge-transport → dashboard-control → verification.

## Tasks

- [ ] Add command schema and capability allowlist.
  - Acceptance: unsupported capability/resource is rejected before DB write.
  - Verify: contract tests.
- [ ] Add durable command table and DB helpers.
  - Acceptance: owner-scoped enqueue, atomic lease, fencing and idempotent result.
  - Verify: lifecycle tests and integration test when DB is available.
- [ ] Add authenticated tRPC procedures.
  - Acceptance: create/list/cancel are protected and audited.
  - Verify: auth/owner/cancel tests.
- [ ] Add bridge poll/claim/result routes.
  - Acceptance: valid bridge only; expiry, owner and lease checked.
  - Verify: HTTP contract tests.
- [ ] Extend PC bridge loop.
  - Acceptance: poll, execute only read-only allowlist, submit sanitized result; retry without duplicate side effect.
  - Verify: child-process mock runtime test.
- [ ] Add dashboard command controls.
  - Acceptance: explicit capability/resource form, status list, cancel; no arbitrary shell field.
  - Verify: typecheck/build and browser/source contracts.
- [ ] Run full verification and update evidence.
  - Acceptance: test/check/build pass; live PC remains separately labelled until observed.
