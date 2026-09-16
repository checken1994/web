import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildHeartbeatEvent, nextBackoff, readSequence, retryDelay, sanitizeLocalStatus, writeSequence } from "../scripts/scp-pc-bridge-lib.mjs";

describe("PC bridge offline runtime contract", () => {
  it("emits only the allowlisted local status fields", () => {
    const safe = sanitizeLocalStatus({ status: "online", version: "1.0", uptime: 12, activeSessions: 2, port: 8002, mode: "api", SCP_BRIDGE_SHARED_TOKEN: "secret", apiKey: "secret" });
    expect(safe).toEqual({ status: "online", version: "1.0", uptime: 12, activeSessions: 2, port: 8002, mode: "api" });
    expect(JSON.stringify(safe)).not.toMatch(/secret|token|apiKey/i);
  });

  it("builds a heartbeat event without credentials", () => {
    const event = buildHeartbeatEvent({ bridgeId: "pc-minh", sequence: 3, occurredAt: "2026-09-16T00:00:00.000Z", localStatus: { status: "online", cookie: "secret" } });
    expect(event.eventId).toBe("pc-minh:3");
    expect(event.eventType).toBe("heartbeat");
    expect(event.payload).toEqual({ bridge: "scp-pc", connection: "outbound", status: "online" });
    expect(JSON.stringify(event)).not.toMatch(/secret|cookie|authorization|api[_-]?key/i);
  });

  it("persists and resumes sequence for the same bridge only", () => {
    const dir = mkdtempSync(join(tmpdir(), "scp-bridge-"));
    const stateFile = join(dir, "sequence.json");
    expect(writeSequence(stateFile, "pc-minh", 12)).toBe(true);
    expect(readSequence(stateFile, "pc-minh")).toBe(12);
    expect(readSequence(stateFile, "other-bridge")).toBe(0);
    expect(JSON.parse(readFileSync(stateFile, "utf8"))).toEqual({ bridgeId: "pc-minh", sequence: 12 });
  });

  it("uses bounded exponential retry backoff", () => {
    expect(retryDelay(1000, 0)).toBe(1000);
    expect(retryDelay(1000, 1)).toBe(1500);
    expect(nextBackoff(1000)).toBe(2000);
    expect(nextBackoff(30000)).toBe(30000);
  });

  it("calls retryDelay with a sampled number in the live bridge loop", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../scripts/scp-pc-bridge.mjs"), "utf8");
    expect(source).toContain("retryDelay(backoffMs, Math.random())");
    expect(source).not.toContain("retryDelay(backoffMs, Math.random));");
  });

  it("executes reconnect and sequence resume against a mock HTTP bridge", async () => {
    const token = "test-only-bridge-token-012345678901234567890123";
    const events: Array<Record<string, unknown>> = [];
    let failures = 1;
    const server = createServer((request, response) => {
      if (request.url === "/health") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ status: "online", version: "mock", uptime: 1, port: 8002, mode: "api", token: "must-not-escape" }));
        return;
      }
      if (request.url !== "/api/bridge/events") { response.statusCode = 404; response.end(); return; }
      let body = "";
      request.on("data", chunk => { body += chunk; });
      request.on("end", () => {
        const event = JSON.parse(body) as Record<string, unknown>;
        const accepted = failures === 0;
        events.push({ ...event, __accepted: accepted });
        if (failures > 0) { failures -= 1; response.statusCode = 503; response.end("retry"); return; }
        response.statusCode = 200; response.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>(resolveListen => server.listen(0, "127.0.0.1", () => resolveListen()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("mock server did not bind");
    const dir = mkdtempSync(join(tmpdir(), "scp-live-bridge-"));
    const stateFile = join(dir, "sequence.json");
    const script = resolve(import.meta.dirname, "../scripts/scp-pc-bridge.mjs");
    const run = (waitFor: (event: Record<string, unknown>) => boolean) => new Promise<{ output: string; code: number | null }>((resolveRun, rejectRun) => {
      const child = spawn(process.execPath, [script], { env: { ...process.env, NODE_ENV: "test", SCP_BRIDGE_ENDPOINT: `http://127.0.0.1:${address.port}`, SCP_BRIDGE_SHARED_TOKEN: token, SCP_BRIDGE_ID: "mock-pc", SCP_LOCAL_STATUS_URL: `http://127.0.0.1:${address.port}/health`, SCP_BRIDGE_STATE_FILE: stateFile, SCP_BRIDGE_INTERVAL_MS: "1000", SCP_BRIDGE_ALLOW_HTTP: "1" } });
      let output = "";
      const collect = (chunk: Buffer) => { output += chunk.toString(); };
      child.stdout.on("data", collect); child.stderr.on("data", collect);
      const timer = setTimeout(() => { child.kill("SIGTERM"); rejectRun(new Error("mock bridge timeout")); }, 7000);
      const poll = setInterval(() => {
        const event = events.at(-1);
        if (event && waitFor(event)) { clearInterval(poll); clearTimeout(timer); child.kill("SIGTERM"); child.once("close", code => resolveRun({ output, code })); }
      }, 50);
    });
    try {
      const first = await run(event => event.sequence === 1 && event.__accepted === true);
      expect(first.output).not.toContain(token);
      expect(readSequence(stateFile, "mock-pc")).toBe(1);
      expect(events).toHaveLength(2);
      const second = await run(event => event.sequence === 2 && event.__accepted === true);
      expect(second.output).not.toContain(token);
      expect(readSequence(stateFile, "mock-pc")).toBe(2);
      expect(events.at(-1)?.sequence).toBe(2);
      expect(events.every(event => !Object.keys(event).some(key => /token|secret|authorization|cookie|api[_-]?key/i.test(key)))).toBe(true);
    } finally {
      server.close();
    }
  });
});
