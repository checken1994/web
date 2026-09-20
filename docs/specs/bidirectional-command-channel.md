# Spec: SCP Bidirectional Command Channel

## Objective

Cho phép người dùng đã xác thực tạo một command có phạm vi hẹp trên dashboard; backend xếp hàng command; PC bridge chủ động lấy command qua HTTPS; bridge chỉ dispatch capability allowlist tới SCP local; bridge gửi acknowledgement/result về backend; dashboard hiển thị trạng thái và audit. Không mở port inbound trên PC và không cho web chạy shell tùy ý.

## Scope v1

Capabilities v1 chỉ gồm `scp.health.read` (đọc health endpoint local) và `scp.status.read` (đọc status endpoint được cấu hình). Không thực hiện delete, upload, credential, install, shell, process-kill hoặc filesystem write. Mọi capability chưa có allowlist bị DENY.

## Security contract

Mỗi command có owner, commandId, capability, resource URL/path chuẩn hóa, risk tier, idempotency key, expiry, status, lease token/expiry và audit correlation ID. Bridge xác thực bằng shared token ở header, chỉ nhận command thuộc đúng bridge/owner, kiểm tra expiry và capability trước khi gọi local endpoint. Payload/log không chứa token, cookie, API key, environment hoặc raw secret.

## State machine

`queued → leased → dispatched → running → succeeded|failed|unknown|cancelled|expired`.

Command ở `unknown` không được retry side effect tự động. Lease hết hạn phải fence worker cũ. Command terminal không quay lại running. Cancel chỉ được áp dụng trước side-effect boundary hoặc ghi nhận `unknown` nếu đã dispatch mà chưa có result.

## Commands

- Test: `pnpm test`
- Typecheck: `pnpm check`
- Build: `pnpm build`

## Project structure

- `drizzle/schema.ts`: command table.
- `server/db.ts`: owner-scoped enqueue/lease/result/cancel helpers.
- `server/routers.ts`: authenticated command procedures.
- `server/_core/index.ts`: bridge poll/result HTTP routes.
- `scripts/scp-pc-bridge.mjs`: outbound poll/dispatch/result loop.
- `shared/command.ts`: envelope and allowlist schemas.
- `server/*.test.ts`: policy, lifecycle, idempotency and secret tests.

## Testing strategy

Contract tests cover deny-by-default, owner scope, capability/resource validation, expiry, duplicate result, stale lease, cancel semantics and secret non-exposure. Integration tests cover DB helper lifecycle where a test database is available. Mock bridge runtime covers poll, dispatch, retry and result. Live PC execution remains a separate evidence gate and cannot be claimed by mock tests.

## Boundaries

- Always: validate capability/resource, owner scope, expiry, lease fencing, idempotency, audit and fail-closed errors.
- Ask first: adding new side-effect capability, changing token/credential model, production migration or public deployment.
- Never: arbitrary shell execution, secret access, bypassing policy, frontend token storage, accepting unverified success.

## Success criteria

1. An authenticated user can enqueue only allowlisted read-only commands.
2. Unauthenticated, non-owner, expired, revoked and unsupported commands are rejected.
3. A bridge can claim a command only with a valid token and active owner-scoped bridge.
4. A stale/expired lease cannot commit a result.
5. Duplicate result delivery is idempotent.
6. Cancellation and unknown states are explicit and audited.
7. `pnpm test`, `pnpm check`, and `pnpm build` pass.
8. Documentation clearly separates mock/integration proof from live-PC proof.

## Open questions

Live SCP endpoint names and Windows service installation are not assumed. The first implementation uses configurable local health/status URLs and keeps arbitrary command execution disabled.
