import { beforeEach, describe, expect, it, vi } from "vitest";

const { addSessionMessage, recordAudit } = vi.hoisted(() => ({
  addSessionMessage: vi.fn().mockResolvedValue(null),
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, addSessionMessage, recordAudit };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function userContext(): TrpcContext {
  return {
    user: { id: 2, openId: "send-user", email: "send@example.com", name: "Send User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("session send failure audit", () => {
  beforeEach(() => {
    recordAudit.mockClear();
    addSessionMessage.mockImplementation(async (ownerId: number, sessionId: number) => {
      const fixtures = new Map([[1000, { ownerId: 99, id: 1000 }]]);
      const session = fixtures.get(sessionId);
      if (!session || session.ownerId !== ownerId) return null;
      return { id: session.id, sessionId };
    });
  });

  it.each([
    [999, "missing session"],
    [1000, "existing non-owner session"],
  ])("records failed audit and returns sanitized not-found for a %s", async (sessionId) => {
    // The fixture models the DB owner-scope seam: 1000 exists but belongs to owner 99, while the caller is owner 2.
    await expect(appRouter.createCaller(userContext()).sessions.send({ sessionId, content: "hello" })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Session not found" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.command.submit", status: "failed", targetId: String(sessionId), metadata: { reason: "session-not-found" } }));
  });
});
