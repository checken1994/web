import { describe, expect, it } from "vitest";
import { resolveBridgeOwner, type BridgeOwnerCandidate } from "./bridgeOwner";

const admins: BridgeOwnerCandidate[] = [{ id: 7, openId: "owner-7", role: "admin" }];

describe("bridge owner resolution", () => {
  it("prefers the explicitly configured owner", () => {
    expect(resolveBridgeOwner("owner-7", admins)?.id).toBe(7);
    expect(resolveBridgeOwner("other-owner", admins)).toBeUndefined();
  });

  it("allows only a single-admin fallback and fails closed otherwise", () => {
    expect(resolveBridgeOwner("", admins)?.id).toBe(7);
    expect(resolveBridgeOwner("", [...admins, { id: 8, openId: "owner-8", role: "admin" }])).toBeUndefined();
    expect(resolveBridgeOwner("", [{ id: 9, openId: "user-9", role: "user" }])).toBeUndefined();
  });
});
