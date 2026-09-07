import { describe, expect, it, vi } from "vitest";

const recordAudit = vi.hoisted(() => vi.fn().mockRejectedValue(new Error("audit store unavailable")));
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, recordAudit };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";

describe("auth.logout audit failure boundary", () => {
  it("still clears the cookie and returns success when audit persistence fails", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: { id: 1, openId: "logout-failure-user", email: "logout@example.com", name: "Logout User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { headers: {} } as TrpcContext["req"],
      res: { clearCookie: (name: string) => cleared.push(name) } as TrpcContext["res"],
    };
    await expect(appRouter.createCaller(ctx).auth.logout()).resolves.toEqual({ success: true });
    expect(cleared).toEqual([COOKIE_NAME]);
    expect(recordAudit).toHaveBeenCalled();
  });
});
