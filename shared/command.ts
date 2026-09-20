import { z } from "zod";

export const commandCapabilitySchema = z.enum(["scp.health.read", "scp.status.read"]);
export type CommandCapability = z.infer<typeof commandCapabilitySchema>;

export const commandStatusSchema = z.enum(["queued", "leased", "dispatched", "running", "succeeded", "failed", "unknown", "cancelled", "expired"]);
export type CommandStatus = z.infer<typeof commandStatusSchema>;

export const commandResourceSchema = z.enum(["http://127.0.0.1:8002/health", "http://127.0.0.1:8002/status"]);

export const commandRequestSchema = z.object({
  capability: commandCapabilitySchema,
  resource: commandResourceSchema,
  expiresInSeconds: z.number().int().min(10).max(300).default(60),
}).strict();

export const commandEnvelopeSchema = z.object({
  commandId: z.string().uuid(),
  ownerId: z.number().int().positive(),
  bridgeId: z.string().min(1).max(80),
  capability: commandCapabilitySchema,
  resource: commandResourceSchema,
  idempotencyKey: z.string().min(16).max(160),
  leaseToken: z.string().min(32).max(200),
  leaseExpiresAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();

export const commandResultSchema = z.object({
  commandId: z.string().uuid(),
  bridgeId: z.string().min(1).max(80),
  leaseToken: z.string().min(32).max(200),
  status: z.enum(["succeeded", "failed", "unknown"]),
  result: z.record(z.string(), z.unknown()).optional(),
  errorCode: z.string().max(80).optional(),
}).strict();

export const terminalCommandStatuses = new Set<CommandStatus>(["succeeded", "failed", "unknown", "cancelled", "expired"]);

export function isAllowedCommand(capability: CommandCapability, resource: string) {
  return (capability === "scp.health.read" && resource === "http://127.0.0.1:8002/health") ||
    (capability === "scp.status.read" && resource === "http://127.0.0.1:8002/status");
}

export function containsSecretLikeValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (/(token|secret|password|authorization|cookie|api[-_]?key|private[-_]?key)/i.test(key)) return true;
    if (containsSecretLikeValue(child)) return true;
  }
  return false;
}
