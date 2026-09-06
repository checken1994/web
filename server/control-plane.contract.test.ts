import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextWithUser(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("control-plane authorization contracts", () => {
  it("allows an authenticated user to record model selection without returning secrets", async () => {
    const user = {
      id: 7,
      openId: "contract-user",
      email: "contract@example.com",
      name: "Contract User",
      loginMethod: "manus",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const result = await appRouter.createCaller(contextWithUser(user)).models.select({ model: "gpt-5" });
    expect(result).toEqual({ ok: true, model: "gpt-5" });
    expect(JSON.stringify(result)).not.toContain("key");
    expect(JSON.stringify(result)).not.toContain("token");
  });

  it("rejects configuration mutation for a non-admin user", async () => {
    const user = {
      id: 8, openId: "regular-user", email: "regular@example.com", name: "Regular User", loginMethod: "manus",
      role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    const call = appRouter.createCaller(contextWithUser(user)).models.select({ model: "gpt-5" });
    await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects session access without an authenticated user", async () => {
    const call = appRouter.createCaller(contextWithUser(null)).sessions.list();
    await expect(call).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
