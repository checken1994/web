import { describe, expect, it } from "vitest";
import { decideBridgeIngest, isVisibleReplayEvent } from "./bridgePolicy";

describe("bridge ingest and replay policy", () => {
  it("accepts a strictly newer event for an active bridge", () => {
    expect(decideBridgeIngest({ active: true, duplicate: false, lastSequence: 4, incomingSequence: 5 })).toEqual({ accepted: true, duplicate: false });
  });

  it("accepts duplicate event ids idempotently without advancing sequence", () => {
    expect(decideBridgeIngest({ active: true, duplicate: true, lastSequence: 4, incomingSequence: 4 })).toEqual({ accepted: true, duplicate: true });
  });

  it("rejects stale or inactive events fail-closed", () => {
    expect(decideBridgeIngest({ active: true, duplicate: false, lastSequence: 4, incomingSequence: 4 })).toEqual({ accepted: false, reason: "stale-sequence" });
    expect(decideBridgeIngest({ active: false, duplicate: false, lastSequence: 0, incomingSequence: 1 })).toEqual({ accepted: false, reason: "bridge-not-active" });
  });

  it("allows replay only for the requested owner, bridge and sequence window", () => {
    const base = { eventOwnerId: 7, eventBridgeId: "pc-minh", requestedOwnerId: 7, requestedBridgeId: "pc-minh", sequence: 9, afterSequence: 8 };
    expect(isVisibleReplayEvent(base)).toBe(true);
    expect(isVisibleReplayEvent({ ...base, eventOwnerId: 8 })).toBe(false);
    expect(isVisibleReplayEvent({ ...base, eventBridgeId: "other-bridge" })).toBe(false);
    expect(isVisibleReplayEvent({ ...base, sequence: 8 })).toBe(false);
  });
});
