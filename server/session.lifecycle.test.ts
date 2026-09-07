import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelControlSession, recordAudit } = vi.hoisted(() => ({
  cancelControlSession: vi.fn(),
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, cancelControlSession, recordAudit };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function adminContext(): TrpcContext {
  return {
    user: { id: 1, openId: "lifecycle-user", email: "life@example.com", name: "Lifecycle User", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("session cancellation lifecycle", () => {
  beforeEach(() => { cancelControlSession.mockReset(); recordAudit.mockClear(); });

  it.each(["queued", "running"] as const)("transitions %s to cancelled and records audit", async (previousStatus) => {
    cancelControlSession.mockResolvedValue({ id: 7, previousStatus, status: "cancelled", changed: true });
    await expect(appRouter.createCaller(adminContext()).sessions.cancel({ sessionId: 7 })).resolves.toMatchObject({ previousStatus, changed: true, status: "cancelled" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.cancel", status: "completed", targetId: "7", metadata: { previousOrCurrentStatus: "cancelled" } }));
  });

  it.each(["completed", "failed", "cancelled", "unknown"] as const)("preserves %s as a no-op", async (status) => {
    cancelControlSession.mockResolvedValue({ id: 7, status, changed: false });
    await expect(appRouter.createCaller(adminContext()).sessions.cancel({ sessionId: 7 })).resolves.toMatchObject({ changed: false, status });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.cancel.noop", status: "unknown", targetId: "7" }));
  });
});

// The shared DB helper test covers the exact queued/running predicate; this router test proves its outward contract and audit side effect.
