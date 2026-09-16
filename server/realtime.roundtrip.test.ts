import { describe, expect, it } from "vitest";
import { publishRealtimeEvent, subscribeRealtime } from "./realtime";

describe("realtime bridge to SSE round trip", () => {
  it("publishes only to the subscribed owner and writes replayable SSE fields", () => {
    const ownerChunks: string[] = [];
    const otherOwnerChunks: string[] = [];
    const ownerResponse = { write: (chunk: string) => { ownerChunks.push(chunk); return true; } } as unknown as Response;
    const otherOwnerResponse = { write: (chunk: string) => { otherOwnerChunks.push(chunk); return true; } } as unknown as Response;
    const closeOwner = subscribeRealtime(101, ownerResponse);
    const closeOther = subscribeRealtime(202, otherOwnerResponse);
    publishRealtimeEvent(101, {
      eventId: "pc-minh:10", bridgeId: "pc-minh", eventType: "heartbeat", sequence: 10,
      schemaVersion: "1", occurredAt: "2026-09-16T00:00:00.000Z", payload: { status: "online" },
    });
    closeOwner();
    closeOther();
    expect(ownerChunks.join("")).toContain("event: heartbeat");
    expect(ownerChunks.join("")).toContain("id: pc-minh:10");
    expect(ownerChunks.join("")).toContain('"sequence":10');
    expect(otherOwnerChunks).toEqual([]);
  });
});
