import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pcBridgeEvents, pcBridges } from "../drizzle/schema";
import { ensurePcBridge, getDb, ingestPcBridgeEvent, listPcBridgeEvents } from "./db";
import { publishRealtimeEvent, subscribeRealtime } from "./realtime";

describe("realtime bridge persistence integration", () => {
  it("enforces duplicate idempotency, stale rejection and owner-scoped replay on the real DB helper path", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required for realtime persistence integration");
    const ownerId = 990001;
    const otherOwnerId = 990002;
    const bridgeId = `itest-${randomUUID()}`;
    const eventOne = { ownerId, bridgeId, eventId: `${bridgeId}:1`, eventType: "heartbeat", sequence: 1, schemaVersion: "1", occurredAt: new Date(), payload: { status: "online" } } as const;
    const eventTwo = { ...eventOne, eventId: `${bridgeId}:2`, sequence: 2, occurredAt: new Date() };
    try {
      const bridge = await ensurePcBridge({ ownerId, bridgeId, name: "integration-test", credentialHash: "integration-test-hash" });
      expect(bridge?.status).toBe("active");
      expect((await ingestPcBridgeEvent(eventOne)).accepted).toBe(true);
      expect(await ingestPcBridgeEvent(eventOne)).toEqual({ accepted: true, duplicate: true });
      expect(await ingestPcBridgeEvent({ ...eventOne, eventId: `${bridgeId}:stale`, sequence: 1 })).toEqual({ accepted: false, reason: "stale-sequence" });
      expect(await ingestPcBridgeEvent(eventTwo)).toEqual({ accepted: true, duplicate: false });
      expect((await listPcBridgeEvents(ownerId, bridgeId, 0)).map(event => event.eventId)).toEqual([eventOne.eventId, eventTwo.eventId]);
      expect(await listPcBridgeEvents(otherOwnerId, bridgeId, 0)).toEqual([]);
      const chunks: string[] = [];
      const response = { write: (chunk: string) => { chunks.push(chunk); return true; } } as unknown as Response;
      const unsubscribe = subscribeRealtime(ownerId, response);
      publishRealtimeEvent(ownerId, eventTwo);
      unsubscribe();
      expect(chunks.join("\n")).toContain(`id: ${eventTwo.eventId}`);
      expect(chunks.join("\n")).toContain('"sequence":2');
    } finally {
      await db.delete(pcBridgeEvents).where(eq(pcBridgeEvents.bridgeId, bridgeId));
      await db.delete(pcBridges).where(eq(pcBridges.bridgeId, bridgeId));
    }
  }, 15000);
});
