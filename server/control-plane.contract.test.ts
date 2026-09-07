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

  it("rejects session cancellation without an authenticated user", async () => {
    const call = appRouter.createCaller(contextWithUser(null)).sessions.cancel({ sessionId: 1 });
    await expect(call).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unknown model selection before persistence", async () => {
    const user = {
      id: 11, openId: "model-user", email: "model@example.com", name: "Model User", loginMethod: "manus",
      role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    const call = appRouter.createCaller(contextWithUser(user)).models.select({ model: "definitely-not-in-live-catalog" });
    await expect(call).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects capability mutation for a non-admin user", async () => {
    const user = {
      id: 9, openId: "capability-user", email: "capability@example.com", name: "Capability User", loginMethod: "manus",
      role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    const call = appRouter.createCaller(contextWithUser(user)).agents.toggleCapability({ id: 1, enabled: true });
    await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects artifact registration without an authenticated user", async () => {
    const call = appRouter.createCaller(contextWithUser(null)).artifacts.register({ name: "evidence.txt", mimeType: "text/plain", base64: "ZXZpZGVuY2U=" });
    await expect(call).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects artifact access and job-run history without an authenticated user", async () => {
    const caller = appRouter.createCaller(contextWithUser(null));
    await expect(caller.artifacts.access({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.jobs.runs({ jobId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an oversized artifact before storage is called", async () => {
    const user = {
      id: 10, openId: "size-user", email: "size@example.com", name: "Size User", loginMethod: "manus",
      role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    const oversized = "A".repeat(11_200_000);
    const call = appRouter.createCaller(contextWithUser(user)).artifacts.register({ name: "large.bin", mimeType: "application/octet-stream", base64: oversized });
    await expect(call).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
});
