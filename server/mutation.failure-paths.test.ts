import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, createControlSession, cancelControlSession, createArtifactFromBytes, getOwnedArtifact, recordAudit, createHeartbeatJob, updateHeartbeatJob, deleteHeartbeatJob, storageGetSignedUrl } = vi.hoisted(() => ({
  getDb: vi.fn(),
  createControlSession: vi.fn(),
  cancelControlSession: vi.fn(),
  createArtifactFromBytes: vi.fn(),
  getOwnedArtifact: vi.fn(),
  recordAudit: vi.fn().mockResolvedValue(undefined),
  createHeartbeatJob: vi.fn(),
  updateHeartbeatJob: vi.fn(),
  deleteHeartbeatJob: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb, createControlSession, cancelControlSession, createArtifactFromBytes, getOwnedArtifact, recordAudit };
});
vi.mock("./storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  return { ...actual, storageGetSignedUrl };
});
vi.mock("./_core/heartbeat", async () => {
  const actual = await vi.importActual<typeof import("./_core/heartbeat")>("./_core/heartbeat");
  return { ...actual, createHeartbeatJob, updateHeartbeatJob, deleteHeartbeatJob };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const admin = { id: 21, openId: "failure-admin", email: "failure@example.com", name: "Failure Admin", loginMethod: "manus", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

function adminContext(): TrpcContext {
  return { user: admin, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("mutation failure-path contracts", () => {
  beforeEach(() => {
    getDb.mockReset();
    createControlSession.mockReset();
    cancelControlSession.mockReset();
    createArtifactFromBytes.mockReset();
    getOwnedArtifact.mockReset();
    recordAudit.mockClear();
    createHeartbeatJob.mockReset();
    updateHeartbeatJob.mockReset();
    deleteHeartbeatJob.mockReset();
    storageGetSignedUrl.mockReset();
  });

  it("sanitizes session create database failure and records failed audit", async () => {
    createControlSession.mockRejectedValue(new Error("raw database details"));
    await expect(appRouter.createCaller(adminContext()).sessions.create({ title: "Failure session" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Session creation failed" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.create", status: "failed" }));
  });

  it("sanitizes session cancel database failure and records failed audit", async () => {
    cancelControlSession.mockRejectedValue(new Error("raw database details"));
    await expect(appRouter.createCaller(adminContext()).sessions.cancel({ sessionId: 91 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Session cancellation failed" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.cancel", status: "failed" }));
  });

  it("fails closed for capability toggle when database is unavailable", async () => {
    getDb.mockResolvedValue(null);
    await expect(appRouter.createCaller(adminContext()).agents.toggleCapability({ id: 4, enabled: true })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "capability.enable", status: "failed" }));
  });

  it("sanitizes artifact storage failure and records failed audit", async () => {
    createArtifactFromBytes.mockRejectedValue(new Error("raw storage details"));
    await expect(appRouter.createCaller(adminContext()).artifacts.register({ name: "evidence.txt", mimeType: "text/plain", base64: "ZXZpZGVuY2U=" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Artifact registration failed" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "artifact.register", status: "failed" }));
  });

  it("sanitizes artifact presign failure and records failed audit", async () => {
    getOwnedArtifact.mockResolvedValue({ id: 55, storageKey: "private/artifact" });
    storageGetSignedUrl.mockRejectedValue(new Error("raw presign details"));
    await expect(appRouter.createCaller(adminContext()).artifacts.access({ id: 55 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Artifact access failed" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "artifact.access", status: "failed", targetId: "55" }));
  });

  it("fails closed for job create when database is unavailable", async () => {
    getDb.mockResolvedValue(null);
    await expect(appRouter.createCaller(adminContext()).jobs.create({ name: "Failure job", cron: "0 0 * * * *" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "job.create", status: "failed" }));
  });

  it("fails closed for job toggle and delete when database is unavailable", async () => {
    getDb.mockResolvedValue(null);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.jobs.toggle({ id: 4, enabled: true })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(caller.jobs.delete({ id: 4 })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "job.enable", status: "failed" }));
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "job.delete", status: "failed" }));
  });
});

void updateHeartbeatJob;
void deleteHeartbeatJob;
void createHeartbeatJob;
