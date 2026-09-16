import { z } from "zod";

const forbiddenPayloadKey = /(token|secret|password|authorization|cookie|private[_-]?key|api[_-]?key)/i;

const sanitizedPayloadSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  const visit = (current: unknown, path: string[]) => {
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) return current.forEach((item, index) => visit(item, [...path, String(index)]));
    for (const [key, child] of Object.entries(current)) {
      if (forbiddenPayloadKey.test(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, key], message: "secret-like payload field is not allowed" });
      visit(child, [...path, key]);
    }
  };
  visit(value, []);
});

export const realtimeEventSchema = z.object({
  eventId: z.string().trim().min(8).max(120),
  bridgeId: z.string().trim().min(3).max(80),
  eventType: z.enum(["heartbeat", "session.status", "agent.status", "artifact.ready", "job.status", "audit.activity"]),
  sequence: z.number().int().nonnegative(),
  schemaVersion: z.string().trim().min(1).max(20),
  occurredAt: z.string().datetime({ offset: true }),
  payload: sanitizedPayloadSchema.refine(value => JSON.stringify(value).length <= 100_000, "payload-too-large"),
});

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
