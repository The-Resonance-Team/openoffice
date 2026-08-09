// The attached-client ref-count primitive (ADR 0022): sessions count open
// event streams in memory. An explicit end call ends the session only when
// the caller is the last attached client; a plain disconnect only decrements
// — crash recovery belongs to the heartbeat sweep. Counts are in-memory by
// design: a daemon restart resets them, which is safe because the sweep still
// waits on the heartbeat before ending anything.
export class AttachedClients {
  private counts = new Map<string, number>();

  attach(sessionID: string): void {
    this.counts.set(sessionID, (this.counts.get(sessionID) ?? 0) + 1);
  }

  detach(sessionID: string): void {
    const next = (this.counts.get(sessionID) ?? 1) - 1;
    if (next <= 0) this.counts.delete(sessionID);
    else this.counts.set(sessionID, next);
  }

  count(sessionID: string): number {
    return this.counts.get(sessionID) ?? 0;
  }

  /** An explicit end is honored only when the caller is the last client. */
  shouldEndOnExplicitEnd(sessionID: string): boolean {
    return this.count(sessionID) <= 1;
  }
}
