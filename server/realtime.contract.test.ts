import { describe, expect, it } from "vitest";
import { realtimeEventSchema } from "../shared/realtime";
import { isValidBridgeToken } from "./bridgeAuth";

describe("SCP realtime bridge contract", () => {
  it("accepts a sanitized heartbeat envelope", () => {
    const result = realtimeEventSchema.safeParse({
      eventId: "bridge-a:1",
      bridgeId: "bridge-a",
      eventType: "heartbeat",
      sequence: 1,
      schemaVersion: "1",
      occurredAt: "2026-09-15T12:00:00.000Z",
      payload: { status: "online", activeSessions: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing identity, invalid timestamps and oversized payloads", () => {
    expect(realtimeEventSchema.safeParse({}).success).toBe(false);
    expect(realtimeEventSchema.safeParse({
      eventId: "bridge-a:1", bridgeId: "bridge-a", eventType: "heartbeat", sequence: 1,
      schemaVersion: "1", occurredAt: "not-a-date", payload: {},
    }).success).toBe(false);
    expect(realtimeEventSchema.safeParse({
      eventId: "bridge-a:1", bridgeId: "bridge-a", eventType: "heartbeat", sequence: 1,
      schemaVersion: "1", occurredAt: "2026-09-15T12:00:00.000Z", payload: { data: "x".repeat(100_001) },
    }).success).toBe(false);
  });

  it("rejects secret-like payload keys at any nesting level", () => {
    const result = realtimeEventSchema.safeParse({
      eventId: "bridge-a:2", bridgeId: "bridge-a", eventType: "heartbeat", sequence: 2,
      schemaVersion: "1", occurredAt: "2026-09-15T12:00:00.000Z", payload: { status: "online", metadata: { authorization: "secret" } },
    });
    expect(result.success).toBe(false);
    expect(isValidBridgeToken("wrong-token")).toBe(false);
  });

  it("does not include credentials in a valid event payload", () => {
    const event = realtimeEventSchema.parse({
      eventId: "bridge-a:2", bridgeId: "bridge-a", eventType: "heartbeat", sequence: 2,
      schemaVersion: "1", occurredAt: "2026-09-15T12:00:00.000Z", payload: { status: "online" },
    });
    expect(JSON.stringify(event)).not.toMatch(/SCP_BRIDGE_SHARED_TOKEN|authorization|api[_-]?key|cookie/i);
  });
});
