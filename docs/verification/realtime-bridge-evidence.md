# Realtime Bridge Verification Evidence

## Phạm vi và provenance

Evidence này ghi nhận checkpoint `85dc986f` của dự án `scp-control-plane-web`. Baseline Git trước patch là `f357f06fd94acba53d29ecf551990162f1b56c4c`; checkpoint `85dc986f` là snapshot đã lưu của patch và test evidence bên dưới. Không dùng token thật, cookie, API key hoặc dữ liệu người dùng thật trong các test bridge.

Theo nguyên tắc SCP, mọi kết luận dưới đây chỉ có nghĩa **PASS_WITHIN_SCOPE**. Chúng không chứng minh hệ thống production-ready tuyệt đối và không thay thế việc chạy bridge với SCP thật trên PC.

## Evidence matrix

| Cấp bằng chứng | Kiểm tra | Kết quả quan sát | Giới hạn |
|---|---|---|---|
| Static | `shared/realtime.ts`, `server/_core/index.ts`, `server/db.ts`, `scripts/scp-pc-bridge.mjs` | Schema fail-closed với secret-like keys; ingress yêu cầu token; DB áp dụng duplicate/stale/owner scope; caller truyền số jitter từ `Math.random()` | Static không tự chứng minh runtime |
| Integration | `server/realtime.persistence.integration.test.ts` | `getDb` thật, `ensurePcBridge`, `ingestPcBridgeEvent`, `listPcBridgeEvents` và cleanup DB chạy thành công; duplicate idempotent, stale sequence reject, replay khác owner rỗng | Chạy trong DB môi trường test, không phải production database |
| Fixture round-trip | Persistence helper -> replay -> `subscribeRealtime`/`publishRealtimeEvent` | Event sequence 2 được replay đúng owner và ghi ra SSE `event/id/data`; owner khác không nhận replay | Không đi qua HTTP ingress với token thật |
| Runtime mock | `server/pc-bridge.runtime.test.ts` chạy process `scripts/scp-pc-bridge.mjs` | Mock `/health` và `/api/bridge/events` chứng minh request 503 được retry, sequence được lưu/resume từ 1 lên 2, startup/retry output không chứa token; HTTPS guard chỉ nới khi `NODE_ENV=test` và biến test explicit | Mock HTTP không chứng minh TLS/network Internet hoặc SCP PC thật |
| HTTP fail-closed probe | Dev server `curl` read-only | `/api/realtime/stream` không auth trả `401`; `/api/bridge/events` token sai trả `401` | Chưa gửi event hợp lệ qua token thật |
| Build/test | `pnpm test`, `pnpm check`, `pnpm build` | 15 test files / 52 tests pass; TypeScript check pass; production client/server build pass | Build warning về bundle chunk >500 kB vẫn còn, không thuộc bridge correctness |

## Các thay đổi đã xác minh

Lỗi đã được tìm thấy tại caller thật trong `scripts/scp-pc-bridge.mjs`: `retryDelay` nhận nhầm function `Math.random` thay vì giá trị số. Patch đổi thành `retryDelay(backoffMs, Math.random())` và thêm regression assertion đọc đúng caller. Mock child-process test đã chạy retry thật, không chỉ kiểm tra helper.

Payload realtime hiện từ chối key có dạng `token`, `secret`, `password`, `authorization`, `cookie`, `private-key` hoặc `api-key`, kể cả ở object lồng nhau. PC bridge chỉ đưa các status fields trong allowlist vào heartbeat. Shared token vẫn chỉ được đọc ở server/bridge process và không được đưa vào browser payload.

## Missing evidence / verdict

`VERIFIED_WITHIN_SCOPE` cho duplicate ingestion, stale-sequence rejection, owner-scoped replay, SSE fan-out, reconnect/backoff, sequence persistence và secret non-exposure trong test/mock environment.

`UNPROVEN` cho end-to-end với SCP thật đang chạy trên PC người dùng, HTTPS Internet thật, database production, authenticated browser SSE với storage state thật và recovery sau crash của PC bridge thật. Probe read-only terminal PC trong lần kiểm chứng này bị timeout và đã được dừng an toàn; không được diễn giải thành SCP đang chạy hoặc đang lỗi. Vì vậy mục TODO “Run an end-to-end realtime test with SCP running on the connected PC” vẫn phải giữ unchecked.

## Bidirectional command channel — evidence update

The working tree now includes a bounded command channel. The first release slice deliberately exposes only two read-only capabilities: `scp.health.read` for `http://127.0.0.1:8002/health` and `scp.status.read` for `http://127.0.0.1:8002/status`. Arbitrary shell execution, arbitrary URLs, filesystem writes, deletion, credentials and package installation are not exposed.

The backend stores owner-scoped commands in `pc_commands`, applies idempotency by `idempotencyKey`, leases commands to a specific bridge with a hashed lease token and expiry, fences stale result submissions, records terminal `unknown` when a lease expires, and rejects secret-like result fields. Authenticated tRPC procedures create/list/cancel commands. The outbound PC bridge polls `/api/bridge/commands/next`, executes only the local allowlist, and submits sanitized results to `/api/bridge/commands/result`. The dashboard displays a read-only queue, status journal, cancel action and five-second refresh; realtime `command.status` events trigger a refresh.

Fresh verification on this working tree:

| Check | Result | Meaning | Limit |
|---|---|---|---|
| Contract tests | `server/command.contract.test.ts`: 4 passed | Allowlist, deny-by-default, secret rejection and no arbitrary child-process execution | Static/contract scope |
| Bridge child-process runtime | `server/command.bridge.runtime.test.ts`: 1 passed | Real bridge process polled a mock command, called the allowlisted health resource and submitted a sanitized result | Mock HTTP, not the user's PC |
| DB lifecycle integration | `server/command.persistence.integration.test.ts`: 1 passed | Real DB helper path proved idempotency, lease assignment, result commit and duplicate-result behavior | Test database, not production failure/chaos |
| Full suite | 17 files / 57 tests passed | Current working tree has no test failures | Does not prove live PC |
| Typecheck | `pnpm check` exit 0 | TypeScript contracts compile | Not runtime proof |
| Production build | `pnpm build` exit 0 | Client/server bundle builds | Existing >500 kB chunk advisory remains |
| Preview | Authenticated `/?section=commands` screenshot | New queue/journal view renders and correctly shows no active bridge in the current preview | No command was queued because no live bridge was registered |

### Current verdict

`VERIFIED_WITHIN_SCOPE` for the read-only command contract, durable queue lifecycle, lease/idempotency behavior, secret-result rejection and mock bridge poll/execute/result round-trip.

`UNPROVEN` for an end-to-end command executed by the real SCP process on the user's PC, real Internet/TLS path, production bridge credential, live cancellation after dispatch, crash recovery on the real PC and any capability beyond the two read-only health/status resources. The feature is therefore a safe command-channel foundation, not permission to run arbitrary remote commands.
