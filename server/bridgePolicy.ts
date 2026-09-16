export type BridgeIngestDecision =
  | { accepted: false; reason: "bridge-not-active" | "stale-sequence" }
  | { accepted: true; duplicate: boolean };

export function decideBridgeIngest(input: { active: boolean; duplicate: boolean; lastSequence: number; incomingSequence: number }): BridgeIngestDecision {
  if (!input.active) return { accepted: false, reason: "bridge-not-active" };
  if (input.duplicate) return { accepted: true, duplicate: true };
  if (input.incomingSequence <= input.lastSequence) return { accepted: false, reason: "stale-sequence" };
  return { accepted: true, duplicate: false };
}

export function isVisibleReplayEvent(input: { eventOwnerId: number; eventBridgeId: string; requestedOwnerId: number; requestedBridgeId: string; sequence: number; afterSequence: number }) {
  return input.eventOwnerId === input.requestedOwnerId && input.eventBridgeId === input.requestedBridgeId && input.sequence > input.afterSequence;
}
