import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { ensurePcBridge, getDb, getUserByOpenId, ingestPcBridgeEvent, recordAudit } from "../db";
import { jobRuns, scheduledJobs } from "../../drizzle/schema";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { isValidBridgeToken } from "../bridgeAuth";
import { realtimeEventSchema } from "../../shared/realtime";
import { publishRealtimeEvent, subscribeRealtime } from "../realtime";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/api/realtime/stream", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user?.id) return res.status(401).json({ error: "unauthorized" });
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.write(": connected\\n\\n");
      const unsubscribe = subscribeRealtime(user.id, res);
      req.on("close", unsubscribe);
    } catch {
      if (!res.headersSent) return res.status(401).json({ error: "unauthorized" });
      res.end();
    }
  });
  app.post("/api/bridge/events", async (req, res) => {
    const candidate = req.header("x-scp-bridge-token");
    if (!isValidBridgeToken(candidate)) return res.status(401).json({ error: "bridge-unauthorized" });
    const parsed = realtimeEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid-event" });
    try {
      const owner = await getUserByOpenId(ENV.ownerOpenId);
      if (!owner) return res.status(503).json({ error: "bridge-owner-unavailable" });
      const tokenHash = createHash("sha256").update(process.env.SCP_BRIDGE_SHARED_TOKEN ?? "").digest("hex");
      const bridge = await ensurePcBridge({ ownerId: owner.id, bridgeId: parsed.data.bridgeId, name: "SCP PC bridge", credentialHash: tokenHash });
      if (!bridge) return res.status(403).json({ error: "bridge-revoked" });
      const result = await ingestPcBridgeEvent({ ...parsed.data, ownerId: owner.id, occurredAt: new Date(parsed.data.occurredAt) });
      if (!result.accepted && result.reason === "stale-sequence") return res.status(409).json({ error: result.reason });
      if (!result.accepted) return res.status(403).json({ error: result.reason });
      await recordAudit({ ownerId: owner.id, actorOpenId: "pc-bridge", action: result.duplicate ? "bridge.event.duplicate" : "bridge.event.ingest", targetType: "pc_bridge", targetId: parsed.data.bridgeId, status: "completed", metadata: { eventType: parsed.data.eventType, sequence: parsed.data.sequence } });
      if (!result.duplicate) publishRealtimeEvent(owner.id, parsed.data);
      return res.json({ ok: true, duplicate: result.duplicate ?? false, sequence: parsed.data.sequence });
    } catch {
      return res.status(500).json({ error: "bridge-ingest-failed" });
    }
  });
  app.post("/api/scheduled/control-plane-job", async (req, res) => {
    const startedAt = new Date();
    let db: Awaited<ReturnType<typeof getDb>> = null;
    let jobId: number | undefined;
    let runId: number | undefined;
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      db = await getDb();
      if (!db) return res.status(503).json({ error: "database-unavailable" });
      const rows = await db.select().from(scheduledJobs).where(eq(scheduledJobs.scheduleCronTaskUid, user.taskUid)).limit(1);
      const job = rows[0];
      if (!job) return res.json({ ok: true, skipped: "orphan" });
      jobId = job.id;
      const run = await db.insert(jobRuns).values({ jobId: job.id, ownerId: job.ownerId, status: "running", startedAt });
      runId = Number(run[0].insertId);
      await db.update(jobRuns).set({ status: "success", finishedAt: new Date() }).where(eq(jobRuns.id, runId));
      await db.update(scheduledJobs).set({ lastRunAt: new Date(), lastStatus: "success", lastError: null }).where(eq(scheduledJobs.id, job.id));
      return res.json({ ok: true, taskUid: user.taskUid, runId });
    } catch (error) {
      const safeMessage = "scheduled-job-failed";
      if (db && runId && jobId) {
        await db.update(jobRuns).set({ status: "failed", finishedAt: new Date(), error: safeMessage }).where(eq(jobRuns.id, runId)).catch(() => undefined);
        await db.update(scheduledJobs).set({ lastRunAt: new Date(), lastStatus: "failed", lastError: safeMessage }).where(eq(scheduledJobs.id, jobId)).catch(() => undefined);
      }
      return res.status(500).json({ error: safeMessage, timestamp: new Date().toISOString() });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
