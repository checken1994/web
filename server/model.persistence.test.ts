import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsertModelRoute, recordAudit, listLLMModels } = vi.hoisted(() => ({
  upsertModelRoute: vi.fn(),
  recordAudit: vi.fn().mockResolvedValue(undefined),
  listLLMModels: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, upsertModelRoute, recordAudit };
});
vi.mock("./_core/llm", async () => {
  const actual = await vi.importActual<typeof import("./_core/llm")>("./_core/llm");
  return { ...actual, listLLMModels };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function adminContext(): TrpcContext {
  return {
    user: { id: 1, openId: "model-persist-user", email: "persist@example.com", name: "Persist User", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("model route persistence failure", () => {
  beforeEach(() => { upsertModelRoute.mockReset(); recordAudit.mockClear(); listLLMModels.mockReset(); });

  it("fails closed and records a failed audit when persistence returns null", async () => {
    listLLMModels.mockResolvedValue({ data: [{ id: "catalog-model", owned_by: "server" }] });
    upsertModelRoute.mockResolvedValue(null);
    await expect(appRouter.createCaller(adminContext()).models.select({ model: "catalog-model" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "model.select", status: "failed", targetId: "catalog-model" }));
  });
});
