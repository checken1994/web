import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("PC bridge bidirectional command runtime", () => {
  it("polls an allowlisted health command and submits a sanitized result", async () => {
    const token = "command-test-token-012345678901234567890123";
    const commandId = "11111111-1111-4111-8111-111111111111";
    const leaseToken = "lease-token-012345678901234567890123456789";
    let commandDelivered = false;
    let resultBody: Record<string, unknown> | null = null;
    const server = createServer((request, response) => {
      if (request.url === "/health") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ status: "online", version: "mock", uptime: 12, port: 8002, apiKey: "must-not-escape" }));
        return;
      }
      if (request.url === "/api/bridge/events") { response.statusCode = 200; response.end(JSON.stringify({ ok: true })); return; }
      if (request.url?.startsWith("/api/bridge/commands/next")) {
        if (commandDelivered) { response.statusCode = 204; response.end(); return; }
        commandDelivered = true;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ commandId, ownerId: 1, bridgeId: "command-pc", capability: "scp.health.read", resource: "http://127.0.0.1:8002/health", idempotencyKey: "command-idempotency-001", leaseToken, leaseExpiresAt: new Date(Date.now() + 30000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() }));
        return;
      }
      if (request.url === "/api/bridge/commands/result") {
        let body = "";
        request.on("data", chunk => { body += chunk; });
        request.on("end", () => { resultBody = JSON.parse(body); response.statusCode = 200; response.end(JSON.stringify({ ok: true })); });
        return;
      }
      response.statusCode = 404; response.end();
    });
    await new Promise<void>(resolveListen => server.listen(8002, "127.0.0.1", () => resolveListen()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("mock server did not bind");
    const dir = mkdtempSync(join(tmpdir(), "scp-command-bridge-"));
    const child = spawn(process.execPath, [resolve(import.meta.dirname, "../scripts/scp-pc-bridge.mjs")], { env: { ...process.env, NODE_ENV: "test", SCP_BRIDGE_ENDPOINT: "http://127.0.0.1:8002", SCP_BRIDGE_SHARED_TOKEN: token, SCP_BRIDGE_ID: "command-pc", SCP_LOCAL_STATUS_URL: "http://127.0.0.1:8002/health", SCP_BRIDGE_STATE_FILE: join(dir, "sequence.json"), SCP_BRIDGE_INTERVAL_MS: "1000", SCP_BRIDGE_ALLOW_HTTP: "1" } });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk.toString(); });
    child.stderr.on("data", chunk => { output += chunk.toString(); });
    try {
      await new Promise<void>((resolveResult, rejectResult) => {
        const timer = setTimeout(() => rejectResult(new Error("command bridge timeout")), 7000);
        const poll = setInterval(() => { if (resultBody) { clearTimeout(timer); clearInterval(poll); resolveResult(); } }, 50);
        child.once("error", rejectResult);
      });
      expect(resultBody?.commandId).toBe(commandId);
      expect(resultBody?.status).toBe("succeeded");
      expect(resultBody).toMatchObject({ bridgeId: "command-pc" });
      expect(JSON.stringify(resultBody?.result ?? {})).not.toMatch(/apiKey|must-not-escape|secret/i);
      expect(output).not.toContain(token);
    } finally {
      child.kill("SIGTERM");
      server.close();
    }
  }, 15000);
});
