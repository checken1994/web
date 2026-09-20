import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { buildHeartbeatEvent, nextBackoff, readSequence, retryDelay, sanitizeLocalStatus, writeSequence } from "./scp-pc-bridge-lib.mjs";

const baseEndpoint = (process.env.SCP_BRIDGE_ENDPOINT ?? "").replace(/\/$/, "");
const endpoint = baseEndpoint + "/api/bridge/events";
const commandPollEndpoint = baseEndpoint + "/api/bridge/commands/next";
const commandResultEndpoint = baseEndpoint + "/api/bridge/commands/result";
const token = process.env.SCP_BRIDGE_SHARED_TOKEN;
const bridgeId = process.env.SCP_BRIDGE_ID ?? `pc-${randomUUID()}`;
const localStatusUrl = process.env.SCP_LOCAL_STATUS_URL ?? "http://127.0.0.1:8002/health";
const stateFile = resolve(process.env.SCP_BRIDGE_STATE_FILE ?? ".scp-bridge-sequence.json");
const intervalMs = Math.max(Number(process.env.SCP_BRIDGE_INTERVAL_MS ?? 5000), 1000);

const allowTestHttp = process.env.NODE_ENV === "test" && process.env.SCP_BRIDGE_ALLOW_HTTP === "1";
if (!endpoint.startsWith("https://") && !allowTestHttp) throw new Error("SCP_BRIDGE_ENDPOINT must use https://");
if (!token || token.length < 32) throw new Error("SCP_BRIDGE_SHARED_TOKEN is required and must be at least 32 characters");

async function readLocalStatus() {
  try {
    const response = await fetch(localStatusUrl, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return { localStatus: "unreachable", httpStatus: response.status };
    return sanitizeLocalStatus(await response.json());
  } catch {
    return { localStatus: "unreachable" };
  }
}

async function publish(sequence) {
  const event = buildHeartbeatEvent({ bridgeId, sequence, occurredAt: new Date().toISOString(), localStatus: await readLocalStatus() });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-scp-bridge-token": token },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`bridge-http-${response.status}`);
}

function allowedCommand(command) {
  return (command?.capability === "scp.health.read" && command?.resource === "http://127.0.0.1:8002/health") ||
    (command?.capability === "scp.status.read" && command?.resource === "http://127.0.0.1:8002/status");
}

async function sendCommandResult(command, result) {
  const response = await fetch(commandResultEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-scp-bridge-token": token },
    body: JSON.stringify({ commandId: command.commandId, bridgeId, leaseToken: command.leaseToken, ...result }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`command-result-http-${response.status}`);
}

async function executeCommand(command) {
  if (!allowedCommand(command)) {
    await sendCommandResult(command, { status: "failed", errorCode: "capability-denied" });
    return;
  }
  try {
    const response = await fetch(command.resource, { signal: AbortSignal.timeout(3000) });
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    const result = { ...sanitizeLocalStatus(body), httpStatus: response.status };
    await sendCommandResult(command, response.ok ? { status: "succeeded", result } : { status: "failed", result, errorCode: `local-http-${response.status}` });
  } catch {
    await sendCommandResult(command, { status: "failed", errorCode: "local-request-failed" });
  }
}

async function pollAndExecute() {
  const response = await fetch(`${commandPollEndpoint}?bridgeId=${encodeURIComponent(bridgeId)}`, {
    headers: { "x-scp-bridge-token": token },
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(`command-poll-http-${response.status}`);
  const command = await response.json();
  await executeCommand(command);
  console.log(JSON.stringify({ event: "bridge-command-processed", commandId: command.commandId, status: "result-submitted" }));
}

let sequence = readSequence(stateFile, bridgeId);
let stopped = false;
let backoffMs = 1000;

async function tick() {
  if (stopped) return;
  const next = sequence + 1;
  try {
    await publish(next);
    sequence = next;
    writeSequence(stateFile, bridgeId, sequence);
    backoffMs = 1000;
    console.log(JSON.stringify({ event: "bridge-heartbeat-sent", bridgeId, sequence }));
  } catch (error) {
    console.warn(JSON.stringify({ event: "bridge-retry", bridgeId, delayMs: backoffMs, reason: error instanceof Error ? error.message : "unknown" }));
    setTimeout(tick, retryDelay(backoffMs, Math.random()));
    backoffMs = nextBackoff(backoffMs);
    return;
  }
  try { await pollAndExecute(); }
  catch (error) { console.warn(JSON.stringify({ event: "bridge-command-retry", reason: error instanceof Error ? error.message : "unknown" })); }
  setTimeout(tick, intervalMs);
}

process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
console.log(JSON.stringify({ event: "bridge-started", bridgeId, intervalMs, localStatusUrl }));
tick();
