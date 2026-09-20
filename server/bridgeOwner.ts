export type BridgeOwnerCandidate = { openId: string; role: "admin" | "user"; id: number };

export function resolveBridgeOwner(configuredOpenId: string, candidates: BridgeOwnerCandidate[]) {
  const configured = configuredOpenId.trim();
  if (configured) return candidates.find(candidate => candidate.openId === configured);
  const admins = candidates.filter(candidate => candidate.role === "admin");
  return admins.length === 1 && candidates.length === 1 ? admins[0] : undefined;
}
