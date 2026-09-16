import { and, desc, eq, gt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agentCapabilities, agents, artifacts, auditActivities, InsertUser, jobRuns, modelRoutes,
  pcBridgeEvents, pcBridges, scheduledJobs, sessionMessages, sessions, users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { storagePut } from "./storage";
import { decideBridgeIngest, isVisibleReplayEvent } from "./bridgePolicy";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = values[field]; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listControlSessions(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(sessions).where(eq(sessions.ownerId, ownerId)).orderBy(desc(sessions.lastActivityAt)).limit(50);
}

export async function createControlSession(ownerId: number, title: string, selectedModel?: string) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const correlationId = crypto.randomUUID();
  const result = await db.insert(sessions).values({ ownerId, title, selectedModel, correlationId, status: "queued" });
  return { id: Number(result[0].insertId), correlationId };
}

export async function addSessionMessage(ownerId: number, sessionId: number, content: string) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const owned = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerId, ownerId))).limit(1);
  if (!owned[0]) return null;
  const result = await db.insert(sessionMessages).values({ ownerId, sessionId, content, role: "user", status: "queued" });
  await db.update(sessions).set({ lastActivityAt: new Date(), status: "running" }).where(eq(sessions.id, sessionId));
  return { id: Number(result[0].insertId), sessionId };
}

export function canCancelSessionStatus(status: string) {
  return status === "queued" || status === "running";
}

export async function cancelControlSession(ownerId: number, sessionId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const current = await db.select({ id: sessions.id, status: sessions.status }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerId, ownerId))).limit(1);
  if (!current[0]) return null;
  if (!canCancelSessionStatus(current[0].status)) return { id: sessionId, status: current[0].status, changed: false } as const;
  await db.update(sessions).set({ status: "cancelled", lastActivityAt: new Date() }).where(and(eq(sessions.id, sessionId), eq(sessions.ownerId, ownerId)));
  return { id: sessionId, status: "cancelled", changed: true } as const;
}

export async function addAssistantMessage(ownerId: number, sessionId: number, content: string, status: "completed" | "failed" | "unknown" = "completed") {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const owned = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerId, ownerId))).limit(1);
  if (!owned[0]) return null;
  const result = await db.insert(sessionMessages).values({ ownerId, sessionId, content, role: "assistant", status });
  await db.update(sessions).set({ lastActivityAt: new Date(), status: status === "completed" ? "completed" : status }).where(eq(sessions.id, sessionId));
  return { id: Number(result[0].insertId), sessionId };
}

export async function listAgentCapabilities(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(agentCapabilities).where(eq(agentCapabilities.ownerId, ownerId)).orderBy(agentCapabilities.capability).limit(200);
}

export async function listAgents(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(agents).where(eq(agents.ownerId, ownerId)).orderBy(agents.name).limit(100);
}

export async function listModelRoutes(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(modelRoutes).where(eq(modelRoutes.ownerId, ownerId)).orderBy(modelRoutes.displayName).limit(100);
}

export async function upsertModelRoute(ownerId: number, displayName: string, modelId: string, provider: string) {
  const db = await getDb(); if (!db) return null;
  const current = await db.select({ id: modelRoutes.id }).from(modelRoutes).where(and(eq(modelRoutes.ownerId, ownerId), eq(modelRoutes.modelId, modelId))).limit(1);
  if (current[0]) {
    await db.update(modelRoutes).set({ displayName, provider, enabled: 1 }).where(and(eq(modelRoutes.id, current[0].id), eq(modelRoutes.ownerId, ownerId)));
    return current[0].id;
  }
  const inserted = await db.insert(modelRoutes).values({ ownerId, displayName, provider, modelId, enabled: 1 });
  return Number(inserted[0].insertId);
}

export async function listArtifacts(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(artifacts).where(eq(artifacts.ownerId, ownerId)).orderBy(desc(artifacts.createdAt)).limit(100);
}

export async function createArtifactFromBytes(input: {
  ownerId: number;
  sessionId?: number;
  name: string;
  mimeType: string;
  bytes: Buffer;
  provenance?: unknown;
}) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const stored = await storagePut(`${input.ownerId}-artifacts/${input.name}`, input.bytes, input.mimeType);
  const inserted = await db.insert(artifacts).values({
    ownerId: input.ownerId,
    sessionId: input.sessionId,
    name: input.name,
    status: "ready",
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    storageKey: stored.key,
    provenance: input.provenance ?? null,
    sha256,
  });
  return { id: Number(inserted[0].insertId), key: stored.key, sha256, sizeBytes: input.bytes.byteLength };
}

export async function getOwnedArtifact(ownerId: number, artifactId: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(artifacts).where(and(eq(artifacts.id, artifactId), eq(artifacts.ownerId, ownerId))).limit(1);
  return result[0];
}

export async function listScheduledJobs(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(scheduledJobs).where(eq(scheduledJobs.ownerId, ownerId)).orderBy(desc(scheduledJobs.updatedAt)).limit(100);
}

export async function listSessionMessages(ownerId: number, sessionId: number) {
  const db = await getDb(); if (!db) return [];
  const owned = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerId, ownerId))).limit(1);
  if (!owned[0]) return [];
  return db.select().from(sessionMessages).where(and(eq(sessionMessages.ownerId, ownerId), eq(sessionMessages.sessionId, sessionId))).orderBy(sessionMessages.createdAt).limit(500);
}

export async function listJobRuns(ownerId: number, jobId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(jobRuns).where(and(eq(jobRuns.ownerId, ownerId), eq(jobRuns.jobId, jobId))).orderBy(desc(jobRuns.startedAt)).limit(100);
}

export async function listAuditActivities(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(auditActivities).where(eq(auditActivities.ownerId, ownerId)).orderBy(desc(auditActivities.createdAt)).limit(100);
}

export async function recordAudit(input: {
  ownerId: number; actorOpenId: string; action: string; targetType: string; targetId?: string;
  status: "accepted" | "completed" | "failed" | "denied" | "unknown"; correlationId?: string; metadata?: unknown;
}) {
  const db = await getDb(); if (!db) return;
  await db.insert(auditActivities).values(input);
}

export async function countDashboard(ownerId: number) {
  const db = await getDb(); if (!db) return { sessions: 0, agents: 0, artifacts: 0, jobs: 0, audits: 0 };
  const [sessionRows, agentRows, artifactRows, jobRows, auditRows] = await Promise.all([
    db.select({ id: sessions.id }).from(sessions).where(eq(sessions.ownerId, ownerId)).limit(1000),
    db.select({ id: agents.id }).from(agents).where(eq(agents.ownerId, ownerId)).limit(1000),
    db.select({ id: artifacts.id }).from(artifacts).where(eq(artifacts.ownerId, ownerId)).limit(1000),
    db.select({ id: scheduledJobs.id }).from(scheduledJobs).where(eq(scheduledJobs.ownerId, ownerId)).limit(1000),
    db.select({ id: auditActivities.id }).from(auditActivities).where(eq(auditActivities.ownerId, ownerId)).limit(1000),
  ]);
  return { sessions: sessionRows.length, agents: agentRows.length, artifacts: artifactRows.length, jobs: jobRows.length, audits: auditRows.length };
}

export async function ensurePcBridge(input: { ownerId: number; bridgeId: string; name: string; credentialHash: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const current = await db.select({ id: pcBridges.id, ownerId: pcBridges.ownerId, bridgeId: pcBridges.bridgeId, status: pcBridges.status, lastSequence: pcBridges.lastSequence }).from(pcBridges).where(and(eq(pcBridges.bridgeId, input.bridgeId), eq(pcBridges.ownerId, input.ownerId))).limit(1);
  if (current[0]) {
    if (current[0].status === "revoked") return null;
    await db.update(pcBridges).set({ lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(pcBridges.id, current[0].id));
    return { id: current[0].id, bridgeId: current[0].bridgeId, status: current[0].status, lastSequence: current[0].lastSequence };
  }
  const inserted = await db.insert(pcBridges).values({ ownerId: input.ownerId, name: input.name, bridgeId: input.bridgeId, credentialHash: input.credentialHash, status: "active", lastSeenAt: new Date() });
  return { id: Number(inserted[0].insertId), bridgeId: input.bridgeId, status: "active" as const, lastSequence: 0 };
}

export async function ingestPcBridgeEvent(input: {
  ownerId: number;
  bridgeId: string;
  eventId: string;
  eventType: string;
  sequence: number;
  schemaVersion: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const bridge = await db.select({ id: pcBridges.id, status: pcBridges.status, lastSequence: pcBridges.lastSequence }).from(pcBridges).where(and(eq(pcBridges.bridgeId, input.bridgeId), eq(pcBridges.ownerId, input.ownerId))).limit(1);
  const duplicate = await db.select({ id: pcBridgeEvents.id }).from(pcBridgeEvents).where(eq(pcBridgeEvents.eventId, input.eventId)).limit(1);
  const decision = decideBridgeIngest({ active: Boolean(bridge[0] && bridge[0].status === "active"), duplicate: Boolean(duplicate[0]), lastSequence: bridge[0]?.lastSequence ?? 0, incomingSequence: input.sequence });
  if (!decision.accepted) return decision;
  if (decision.duplicate) {
    if (bridge[0]) await db.update(pcBridges).set({ lastSeenAt: new Date() }).where(eq(pcBridges.id, bridge[0].id));
    return decision;
  }
  await db.insert(pcBridgeEvents).values(input);
  await db.update(pcBridges).set({ lastSequence: input.sequence, lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(pcBridges.id, bridge[0].id));
  return { accepted: true as const, duplicate: false as const };
}

export async function listPcBridgeEvents(ownerId: number, bridgeId: string, afterSequence = 0, limit = 100) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ eventId: pcBridgeEvents.eventId, ownerId: pcBridgeEvents.ownerId, bridgeId: pcBridgeEvents.bridgeId, eventType: pcBridgeEvents.eventType, sequence: pcBridgeEvents.sequence, schemaVersion: pcBridgeEvents.schemaVersion, occurredAt: pcBridgeEvents.occurredAt, payload: pcBridgeEvents.payload, receivedAt: pcBridgeEvents.receivedAt }).from(pcBridgeEvents).where(and(eq(pcBridgeEvents.ownerId, ownerId), eq(pcBridgeEvents.bridgeId, bridgeId), gt(pcBridgeEvents.sequence, afterSequence))).orderBy(pcBridgeEvents.sequence).limit(Math.min(Math.max(limit, 1), 500));
  return rows.filter((row) => isVisibleReplayEvent({ eventOwnerId: row.ownerId, eventBridgeId: row.bridgeId, requestedOwnerId: ownerId, requestedBridgeId: bridgeId, sequence: row.sequence, afterSequence })).map(({ ownerId: _ownerId, ...row }) => row);
}

export async function listPcBridges(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({ id: pcBridges.id, bridgeId: pcBridges.bridgeId, name: pcBridges.name, status: pcBridges.status, lastSeenAt: pcBridges.lastSeenAt, lastSequence: pcBridges.lastSequence, createdAt: pcBridges.createdAt, updatedAt: pcBridges.updatedAt }).from(pcBridges).where(eq(pcBridges.ownerId, ownerId)).orderBy(desc(pcBridges.updatedAt)).limit(20);
}

export { jobRuns };
