import { beforeEach, describe, expect, it, vi } from "vitest";

const { addSessionMessage, addAssistantMessage, recordAudit, listLLMModels, invokeLLM } = vi.hoisted(() => ({
  addSessionMessage: vi.fn().mockResolvedValue(null),
  addAssistantMessage: vi.fn().mockResolvedValue({ id: 2, sessionId: 1001 }),
  recordAudit: vi.fn().mockResolvedValue(undefined),
  listLLMModels: vi.fn().mockResolvedValue({ data: [{ id: "test-model", owned_by: "test" }] }),
  invokeLLM: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, addSessionMessage, addAssistantMessage, recordAudit };
});
vi.mock("./_core/llm", async () => {
  const actual = await vi.importActual<typeof import("./_core/llm")>("./_core/llm");
  return { ...actual, listLLMModels, invokeLLM };
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
    addAssistantMessage.mockReset();
    addAssistantMessage.mockResolvedValue({ id: 2, sessionId: 1001 });
    listLLMModels.mockResolvedValue({ data: [{ id: "test-model", owned_by: "test" }] });
    invokeLLM.mockReset();
    addSessionMessage.mockImplementation(async (ownerId: number, sessionId: number) => {
      const fixtures = new Map([[1000, { ownerId: 99, id: 1000 }], [1001, { ownerId: 2, id: 1001 }]]);
      const session = fixtures.get(sessionId);
      if (!session || session.ownerId !== ownerId) return null;
      return { id: session.id, sessionId };
    });
  });

  it.each([
    [999, "missing session"],
    [1000, "existing non-owner session"],
  ])("records failed audit and returns sanitized not-found for a %s", async (sessionId) => {
    await expect(appRouter.createCaller(userContext()).sessions.send({ sessionId, content: "hello" })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Session not found" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.command.submit", status: "failed", targetId: String(sessionId), metadata: { reason: "session-not-found" } }));
  });

  it("sanitizes database failure before message insert and records failed audit", async () => {
    addSessionMessage.mockRejectedValue(new Error("raw database details"));
    await expect(appRouter.createCaller(userContext()).sessions.send({ sessionId: 1001, content: "hello" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Session command could not be submitted" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.command.submit", status: "failed", targetId: "1001", metadata: { reason: "database-failure" } }));
  });

  it("sanitizes provider failure after accepted audit and records failed audit", async () => {
    invokeLLM.mockRejectedValue(new Error("raw provider token or HTTP details"));
    await expect(appRouter.createCaller(userContext()).sessions.send({ sessionId: 1001, content: "hello", model: "test-model" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Model request failed" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.command.submit", status: "accepted", targetId: "1001" }));
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.command.fail", status: "failed", targetId: "1001", metadata: { reason: "raw provider token or HTTP details" } }));
    expect(addAssistantMessage).toHaveBeenCalledWith(2, 1001, "The request could not be verified or completed.", "failed");
  });
});
