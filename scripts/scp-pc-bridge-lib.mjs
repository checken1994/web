import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const ALLOWED_STATUS_KEYS = ["status", "version", "uptime", "activeSessions", "port", "mode"];

export function sanitizeLocalStatus(value) {
  if (!value || typeof value !== "object") return { localStatus: "invalid" };
  const source = value;
  const safe = {};
  for (const key of ALLOWED_STATUS_KEYS) {
    const item = source[key];
    if (["string", "number", "boolean"].includes(typeof item)) safe[key] = item;
  }
  return safe;
}

export function buildHeartbeatEvent({ bridgeId, sequence, occurredAt, localStatus }) {
  return {
    eventId: `${bridgeId}:${sequence}`,
    bridgeId,
    eventType: "heartbeat",
    sequence,
    schemaVersion: "1",
    occurredAt,
    payload: { bridge: "scp-pc", connection: "outbound", ...sanitizeLocalStatus(localStatus) },
  };
}

export function readSequence(stateFile, bridgeId) {
  try {
    const value = JSON.parse(readFileSync(stateFile, "utf8"));
    return value.bridgeId === bridgeId && Number.isInteger(value.sequence) ? value.sequence : 0;
  } catch {
    return 0;
  }
}

export function writeSequence(stateFile, bridgeId, sequence) {
  const parent = dirname(stateFile);
  if (!existsSync(parent)) return false;
  writeFileSync(stateFile, JSON.stringify({ bridgeId, sequence }) + "\n", { mode: 0o600 });
  return true;
}

export function nextBackoff(currentMs) {
  return Math.min(Math.max(currentMs, 1000) * 2, 30_000);
}

export function retryDelay(currentMs, randomValue = 0) {
  return Math.max(currentMs, 1000) + Math.round(Math.max(0, Math.min(1, randomValue)) * 500);
}
