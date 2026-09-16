import { describe, expect, it } from "vitest";
import { isValidBridgeToken } from "./bridgeAuth";

describe("SCP bridge shared token", () => {
  it("accepts the configured token and rejects missing or incorrect credentials", () => {
    const configured = process.env.SCP_BRIDGE_SHARED_TOKEN;
    expect(configured).toBeTruthy();
    expect(configured).toHaveLength(64);
    expect(isValidBridgeToken(configured ?? "")).toBe(true);
    expect(isValidBridgeToken("")).toBe(false);
    expect(isValidBridgeToken("wrong-token")).toBe(false);
  });
});
