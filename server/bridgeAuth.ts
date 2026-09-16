import { timingSafeEqual } from "node:crypto";

export function isValidBridgeToken(candidate: string | undefined): boolean {
  const configured = process.env.SCP_BRIDGE_SHARED_TOKEN;
  if (!configured || !candidate) return false;
  const expected = Buffer.from(configured, "utf8");
  const actual = Buffer.from(candidate, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
