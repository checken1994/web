# SCP PC-to-Web Realtime Bridge

## Mục tiêu

Khi SCP chạy trên máy Windows của Minh, dashboard web phải nhận được trạng thái session, agent, model, artifact, scheduled job và audit gần như ngay lập tức. Trình duyệt không được đọc trực tiếp filesystem, process list, cookie hay API key trên PC.

## Hai phương án khả thi

| Phương án | Cách chạy | Ưu điểm | Đánh đổi | Chi phí vận hành | Độ phức tạp |
|---|---|---|---|---|---|
| **PC bridge → HTTPS/SSE backend** | Một tiến trình bridge trên PC chủ động mở kết nối HTTPS/SSE tới dashboard backend; backend lưu event và đẩy tiếp cho browser | Không mở port inbound trên PC; phù hợp mạng gia đình; reconnect dễ; audit tập trung | Cần cài và giữ bridge chạy trên PC; cần cấp một identity riêng | Thấp, dùng hạ tầng dashboard hiện có | Vừa |
| **PC bridge → WebSocket backend Reserved** | Bridge giữ WebSocket hai chiều tới một backend persistent; dashboard subscribe qua backend | Độ trễ thấp, phù hợp stream dày và lệnh hai chiều | Cần process persistent; backend bị giới hạn 1 vCPU/512 MB và chi phí Reserved tối đa khoảng $37.50/tháng trước credit/egress theo mức dùng [1] | Trung bình | Cao |

## Quyết định

Chọn phương án **PC bridge chủ động kết nối outbound tới HTTPS backend**, với SSE hoặc long-polling có heartbeat cho chiều PC → server và tRPC/stream subscription cho chiều server → dashboard. Không mở port 8002/3000 trên router, không expose SCP API trực tiếp và không đưa token bridge vào JavaScript.

Nếu sau này event rate cao hoặc cần điều khiển hai chiều liên tục, có thể chuyển transport giữa bridge và backend sang WebSocket mà không đổi event envelope hoặc authorization model.

## Luồng dữ liệu

```text
SCP process on Windows
  -> local bridge (localhost only)
  -> outbound HTTPS, scoped bridge identity, heartbeat, reconnect
  -> WebDev backend ingestion
  -> owner-scoped DB event log + idempotency check
  -> authenticated dashboard subscription
```

## Event envelope bắt buộc

Mỗi event có `eventId` duy nhất do bridge tạo, `bridgeId`, `ownerScope`, `eventType`, `occurredAt`, `sequence`, `payload`, `schemaVersion` và chữ ký/identity ở tầng transport. Payload chỉ chứa trạng thái đã sanitize: không có cookie, bearer token, API key, raw prompt chứa secret, filesystem path nhạy cảm hoặc process environment.

Backend phải kiểm tra bridge identity, owner scope, schema, clock skew hợp lý và duplicate `eventId`. Event duplicate được acknowledge nhưng không ghi lặp. Event đến trễ không được ghi đè snapshot mới hơn nếu `sequence` cũ hơn.

## Kết nối và mất mạng

Bridge dùng reconnect với exponential backoff có jitter, heartbeat định kỳ, last acknowledged sequence và replay window. Dashboard hiển thị `online`, `degraded`, `offline`, `lastSeenAt` và `lastEventAt`; mất kết nối không được coi là SCP đã dừng.

## Bảo mật

Bridge credential phải là secret server-side hoặc credential file có quyền Windows tối thiểu; frontend chỉ nhận trạng thái và event đã lọc. Backend phải revoke được bridge, giới hạn bridge theo owner, ghi audit cho register/revoke/ingest và fail-closed khi identity không hợp lệ.

## References

[1]: https://home.manus.computer/skills/persistent-computing/references/reserved-hosting-reference.md "Reserved Hosting reference"
