# Realtime Bridge Verification Evidence

## Phạm vi và provenance

Evidence này ghi nhận working tree của dự án `scp-control-plane-web` tại thời điểm kiểm chứng. Baseline Git trước patch là `f357f06fd94acba53d29ecf551990162f1b56c4c`; checkpoint sau khi lưu sẽ là provenance chính thức của patch. Không dùng token thật, cookie, API key hoặc dữ liệu người dùng thật trong các test bridge.

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

`UNPROVEN` cho end-to-end với SCP thật đang chạy trên PC người dùng, HTTPS Internet thật, database production, authenticated browser SSE với storage state thật và recovery sau crash của PC bridge thật. Vì vậy mục TODO “Run an end-to-end realtime test with SCP running on the connected PC” vẫn phải giữ unchecked.
