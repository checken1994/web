import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, listControlSessions, createControlSession, addSessionMessage, addAssistantMessage, cancelControlSession, listAgents, listAgentCapabilities, listModelRoutes, upsertModelRoute, listArtifacts, createArtifactFromBytes, getOwnedArtifact, listScheduledJobs, listSessionMessages, listJobRuns, listAuditActivities, recordAudit, countDashboard } from "./db";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { agentCapabilities, scheduledJobs } from "../drizzle/schema";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { storageGetSignedUrl } from "./storage";

const titleSchema = z.string().trim().min(1).max(180);

function ownerId(ctx: { user?: { id: number } | null }) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return ctx.user.id;
}

async function safeAudit(input: Parameters<typeof recordAudit>[0]) {
  try { await recordAudit(input); return true; } catch { return false; }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      if (ctx.user) await safeAudit({ ownerId: ctx.user.id, actorOpenId: ctx.user.openId, action: "auth.logout", targetType: "user", targetId: String(ctx.user.id), status: "completed" });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => countDashboard(ownerId(ctx))),
  }),
  sessions: router({
    list: protectedProcedure.query(({ ctx }) => listControlSessions(ownerId(ctx))),
    create: protectedProcedure.input(z.object({ title: titleSchema, selectedModel: z.string().trim().max(180).optional() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const created = await createControlSession(id, input.title, input.selectedModel);
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.create", targetType: "session", targetId: String(created.id), status: "completed", correlationId: created.correlationId });
        return created;
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.create", targetType: "session", status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "database-failure" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Session creation failed" });
      }
    }),
    send: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), content: z.string().trim().min(1).max(12000), model: z.string().trim().max(180).optional() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      let result: Awaited<ReturnType<typeof addSessionMessage>>;
      try {
        result = await addSessionMessage(id, input.sessionId, input.content);
      } catch {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.command.submit", targetType: "session", targetId: String(input.sessionId), status: "failed", metadata: { reason: "database-failure" } });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Session command could not be submitted" });
      }
      if (!result) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.command.submit", targetType: "session", targetId: String(input.sessionId), status: "failed", metadata: { reason: "session-not-found" } });
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.command.submit", targetType: "session", targetId: String(input.sessionId), status: "accepted", metadata: { contentLength: input.content.length, requestedModel: input.model ?? null } });
      try {
        const available = await listLLMModels();
        const requested = input.model ? available.data.find((model) => model.id === input.model) : available.data[0];
        if (!requested) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected model is not available in the server catalog" });
        const response = await invokeLLM({ model: requested.id, messages: [
          { role: "system", content: "You are the SCP Control Plane assistant. Be concise, state uncertainty, and never claim an action happened without evidence." },
          { role: "user", content: input.content },
        ] });
        const assistantText = response.choices?.[0]?.message?.content;
        const text = typeof assistantText === "string" ? assistantText : "The model returned no text response.";
        const assistant = await addAssistantMessage(id, input.sessionId, text, "completed");
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.command.complete", targetType: "session", targetId: String(input.sessionId), status: "completed", metadata: { model: requested.id } });
        return { ...result, assistant, model: requested.id, content: text };
      } catch (error) {
        await addAssistantMessage(id, input.sessionId, "The request could not be verified or completed.", "failed");
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.command.fail", targetType: "session", targetId: String(input.sessionId), status: "failed", metadata: { reason: error instanceof Error ? error.message : "unknown" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Model request failed" });
      }
    }),
    history: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(({ ctx, input }) => listSessionMessages(ownerId(ctx), input.sessionId)),
    cancel: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const result = await cancelControlSession(id, input.sessionId);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: result.changed ? "session.cancel" : "session.cancel.noop", targetType: "session", targetId: String(input.sessionId), status: result.changed ? "completed" : "unknown", metadata: { previousOrCurrentStatus: result.status } });
        return result;
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "session.cancel", targetType: "session", targetId: String(input.sessionId), status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "database-failure" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Session cancellation failed" });
      }
    }),
  }),
  agents: router({
    list: protectedProcedure.query(({ ctx }) => listAgents(ownerId(ctx))),
    capabilities: protectedProcedure.query(({ ctx }) => listAgentCapabilities(ownerId(ctx))),
    toggleCapability: adminProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
        const result = await db.update(agentCapabilities).set({ enabled: input.enabled ? 1 : 0 }).where(and(eq(agentCapabilities.id, input.id), eq(agentCapabilities.ownerId, id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Capability not found" });
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: input.enabled ? "capability.enable" : "capability.disable", targetType: "agent_capability", targetId: String(input.id), status: "completed" });
        return { ok: true };
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: input.enabled ? "capability.enable" : "capability.disable", targetType: "agent_capability", targetId: String(input.id), status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "database-failure" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Capability update failed" });
      }
    }),
  }),
  models: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const configured = await listModelRoutes(ownerId(ctx));
      const catalog = await listLLMModels();
      return { configured, available: catalog.data.map((model) => ({ id: model.id, ownedBy: model.owned_by })) };
    }),
    select: adminProcedure.input(z.object({ model: z.string().trim().min(1).max(180) })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      const model = input.model.trim();
      try {
        const catalog = await listLLMModels();
        if (!catalog.data.some((candidate) => candidate.id === model)) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected model is not available in the server catalog" });
        const provider = model.toLowerCase().includes("gemini") ? "Google" : model.toLowerCase().includes("gpt") ? "OpenAI" : "Manus";
        const routeId = await upsertModelRoute(id, model, model, provider);
        if (!routeId) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Model route persistence unavailable" });
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "model.select", targetType: "model", targetId: model, status: "completed", metadata: { provider, routeId } });
        return { ok: true, model };
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "model.select", targetType: "model", targetId: model, status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "catalog-or-database-failure" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Model selection failed" });
      }
    }),
  }),
  artifacts: router({
    list: protectedProcedure.query(({ ctx }) => listArtifacts(ownerId(ctx))),
    register: protectedProcedure.input(z.object({ name: z.string().trim().regex(/^[A-Za-z0-9._-]{1,220}$/), mimeType: z.string().trim().min(1).max(120), base64: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/).max(11_200_000), sessionId: z.number().int().positive().optional(), provenance: z.unknown().optional() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const bytes = Buffer.from(input.base64, "base64");
        if (bytes.byteLength > 8 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Artifact exceeds the 8 MiB limit" });
        const result = await createArtifactFromBytes({ ownerId: id, sessionId: input.sessionId, name: input.name, mimeType: input.mimeType, bytes, provenance: input.provenance });
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "artifact.register", targetType: "artifact", targetId: String(result.id), status: "completed", metadata: { sizeBytes: result.sizeBytes, sha256: result.sha256, sessionId: input.sessionId ?? null } });
        return result;
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "artifact.register", targetType: "artifact", status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "storage-or-database-failure" } }).catch(() => undefined);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Artifact registration failed" });
      }
    }),
    access: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const artifact = await getOwnedArtifact(id, input.id);
        if (!artifact) throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found" });
        if (!artifact.storageKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Artifact storage reference is missing" });
        const url = await storageGetSignedUrl(artifact.storageKey);
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "artifact.access", targetType: "artifact", targetId: String(input.id), status: "completed" });
        return { url, expiresInSeconds: 300 };
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "artifact.access", targetType: "artifact", targetId: String(input.id), status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "storage-or-database-failure" } }).catch(() => undefined);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Artifact access failed" });
      }
    }),
  }),
  jobs: router({
    list: protectedProcedure.query(({ ctx }) => listScheduledJobs(ownerId(ctx))),
    create: adminProcedure.input(z.object({ name: z.string().trim().min(1).max(160), cron: z.string().regex(/^\d+ \S+ \S+ \S+ \S+ \S+$/, "Use a six-field UTC cron expression"), description: z.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const heartbeat = await createHeartbeatJob({ name: input.name, cron: input.cron, path: "/api/scheduled/control-plane-job", description: input.description ?? "SCP control-plane scheduled job" }, sessionToken);
        const inserted = await db.insert(scheduledJobs).values({ ownerId: id, name: input.name, schedule: input.cron, callbackPath: "/api/scheduled/control-plane-job", scheduleCronTaskUid: heartbeat.taskUid, enabled: 1, nextRunAt: heartbeat.nextExecutionAt ? new Date(heartbeat.nextExecutionAt) : null });
        const jobId = Number(inserted[0].insertId);
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "job.create", targetType: "scheduled_job", targetId: String(jobId), status: "completed", metadata: { taskUid: heartbeat.taskUid, cron: input.cron } });
        return { id: jobId, taskUid: heartbeat.taskUid, nextExecutionAt: heartbeat.nextExecutionAt ?? null };
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "job.create", targetType: "scheduled_job", status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "scheduler-or-database-failure" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Scheduled job creation failed" });
      }
    }),
    toggle: adminProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
        const current = await db.select({ taskUid: scheduledJobs.scheduleCronTaskUid }).from(scheduledJobs).where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.ownerId, id))).limit(1);
        if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Scheduled job not found" });
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        if (current[0].taskUid) await updateHeartbeatJob(current[0].taskUid, { enable: input.enabled }, sessionToken);
        await db.update(scheduledJobs).set({ enabled: input.enabled ? 1 : 0 }).where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.ownerId, id)));
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: input.enabled ? "job.enable" : "job.disable", targetType: "scheduled_job", targetId: String(input.id), status: "completed" });
        return { ok: true };
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: input.enabled ? "job.enable" : "job.disable", targetType: "scheduled_job", targetId: String(input.id), status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "scheduler-or-database-failure" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Scheduled job update failed" });
      }
    }),
    delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const id = ownerId(ctx);
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
        const current = await db.select({ taskUid: scheduledJobs.scheduleCronTaskUid }).from(scheduledJobs).where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.ownerId, id))).limit(1);
        if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Scheduled job not found" });
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        if (current[0].taskUid) await deleteHeartbeatJob(current[0].taskUid, sessionToken);
        await db.delete(scheduledJobs).where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.ownerId, id)));
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "job.delete", targetType: "scheduled_job", targetId: String(input.id), status: "completed" });
        return { ok: true };
      } catch (error) {
        await safeAudit({ ownerId: id, actorOpenId: ctx.user!.openId, action: "job.delete", targetType: "scheduled_job", targetId: String(input.id), status: "failed", metadata: { reason: error instanceof TRPCError ? error.code : "scheduler-or-database-failure" } });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Scheduled job deletion failed" });
      }
    }),
    runs: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).query(({ ctx, input }) => listJobRuns(ownerId(ctx), input.jobId)),
  }),
  audit: router({
    list: protectedProcedure.query(({ ctx }) => listAuditActivities(ownerId(ctx))),
  }),
});

export type AppRouter = typeof appRouter;
