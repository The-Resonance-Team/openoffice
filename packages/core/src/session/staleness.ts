import type { Session } from "@openoffice/schema";

// One staleness number to reason about (ADR 0022): the same 24h the draft
// lock table uses for its stale-override check.
export const SESSION_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isStaleSession(
  session: Pick<Session, "lastActiveAt" | "createdAt">,
  now: number,
  staleAfterMs: number = SESSION_STALE_AFTER_MS
): boolean {
  const lastActive = session.lastActiveAt ?? session.createdAt;
  return now - lastActive > staleAfterMs;
}
