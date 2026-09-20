import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pcCommands, pcBridges } from "../drizzle/schema";
import { claimPcCommand, createPcCommand, ensurePcBridge, getDb, submitPcCommandResult } from "./db";

describe("bidirectional command persistence integration", () => {
  it("enforces idempotency, lease ownership and duplicate result handling", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required for command persistence integration");
    const ownerId = 991001;
    const bridgeId = `command-itest-${randomUUID()}`;
    try {
      expect((await ensurePcBridge({ ownerId, bridgeId, name: "command-integration", credentialHash: "test-hash" }))?.status).toBe("active");
      const first = await createPcCommand({ ownerId, bridgeId, capability: "scp.health.read", resource: "http://127.0.0.1:8002/health", expiresInSeconds: 60, idempotencyKey: `command-idempotency-${randomUUID()}` });
      expect(first?.status).toBe("queued");
      const same = await createPcCommand({ ownerId, bridgeId, capability: "scp.health.read", resource: "http://127.0.0.1:8002/health", expiresInSeconds: 60, idempotencyKey: first!.idempotencyKey });
      expect(same?.commandId).toBe(first?.commandId);
      const lease = await claimPcCommand({ ownerId, bridgeId, leaseSeconds: 30 });
      expect(lease?.commandId).toBe(first?.commandId);
      expect(lease?.leaseToken).toBeTypeOf("string");
      expect(await submitPcCommandResult({ ownerId, commandId: first!.commandId, bridgeId, leaseToken: lease!.leaseToken, status: "succeeded", result: { status: "online", uptime: 2 } })).toEqual({ accepted: true, duplicate: false, status: "succeeded" });
      expect(await submitPcCommandResult({ ownerId, commandId: first!.commandId, bridgeId, leaseToken: lease!.leaseToken, status: "succeeded", result: { status: "online" } })).toEqual({ accepted: true, duplicate: true, status: "succeeded" });
      expect(await submitPcCommandResult({ ownerId, commandId: first!.commandId, bridgeId, leaseToken: lease!.leaseToken, status: "succeeded", result: { apiKey: "blocked" } })).toEqual({ accepted: false, reason: "secret-like-result" });
    } finally {
      await db.delete(pcCommands).where(eq(pcCommands.bridgeId, bridgeId));
      await db.delete(pcBridges).where(eq(pcBridges.bridgeId, bridgeId));
    }
  }, 15000);
});
