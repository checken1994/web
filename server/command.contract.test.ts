import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { commandRequestSchema, commandResultSchema, containsSecretLikeValue, isAllowedCommand } from "../shared/command";

describe("bidirectional command channel contract", () => {
  it("allows only the two read-only SCP resources", () => {
    expect(isAllowedCommand("scp.health.read", "http://127.0.0.1:8002/health")).toBe(true);
    expect(isAllowedCommand("scp.status.read", "http://127.0.0.1:8002/status")).toBe(true);
    expect(isAllowedCommand("scp.health.read", "http://127.0.0.1:8002/shell")).toBe(false);
    expect(isAllowedCommand("scp.status.read", "https://evil.example/collect")).toBe(false);
  });

  it("fails closed for unsupported capability, resource and extra fields", () => {
    expect(commandRequestSchema.safeParse({ capability: "shell.exec", resource: "http://127.0.0.1:8002/health", expiresInSeconds: 60 }).success).toBe(false);
    expect(commandRequestSchema.safeParse({ capability: "scp.health.read", resource: "https://example.com", expiresInSeconds: 60 }).success).toBe(false);
    expect(commandRequestSchema.safeParse({ capability: "scp.health.read", resource: "http://127.0.0.1:8002/health", expiresInSeconds: 60, token: "secret" }).success).toBe(false);
  });

  it("rejects secret-like result fields at any nesting level", () => {
    expect(containsSecretLikeValue({ status: "online", nested: { apiKey: "never" } })).toBe(true);
    expect(containsSecretLikeValue({ status: "online", uptime: 4 })).toBe(false);
    expect(commandResultSchema.safeParse({ commandId: "not-a-uuid", bridgeId: "pc-one", leaseToken: "x", status: "succeeded" }).success).toBe(false);
  });

  it("wires the bridge to poll and submit results without exposing arbitrary execution", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../scripts/scp-pc-bridge.mjs"), "utf8");
    expect(source).toContain("/api/bridge/commands/next");
    expect(source).toContain("/api/bridge/commands/result");
    expect(source).toContain("capability-denied");
    expect(source).not.toContain("child_process");
    expect(source).not.toContain("exec(");
  });
});
