import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LockManager } from "../lock";

let dir: string;
let now: number;
let lock: LockManager;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-lock-"));
  now = 1_000_000;
  lock = new LockManager(dir, 24 * 60 * 60 * 1000, () => now);
});

describe("LockManager", () => {
  test("acquire creates a lock file owned by the session", () => {
    const result = lock.acquire("hash1", "sess-a");
    expect(result.ok).toBe(true);
    expect(lock.get("hash1")).toEqual({
      sessionID: "sess-a",
      filePathHash: "hash1",
      acquiredAt: now,
      lastTouchedAt: now,
    });
  });

  test("second session is blocked and sees the holder", () => {
    lock.acquire("hash1", "sess-a");
    const result = lock.acquire("hash1", "sess-b");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.holder.sessionID).toBe("sess-a");
    }
  });

  test("same session re-acquires and refreshes the touch", () => {
    lock.acquire("hash1", "sess-a");
    now += 60_000;
    const result = lock.acquire("hash1", "sess-a");
    expect(result.ok).toBe(true);
    expect(lock.get("hash1")!.lastTouchedAt).toBe(now);
  });

  test("a stale lock can be overridden by another session", () => {
    lock.acquire("hash1", "sess-a");
    now += 25 * 60 * 60 * 1000;
    const result = lock.acquire("hash1", "sess-b");
    expect(result.ok).toBe(true);
    expect(lock.get("hash1")!.sessionID).toBe("sess-b");
  });

  test("a fresh lock cannot be overridden", () => {
    lock.acquire("hash1", "sess-a");
    now += 60_000;
    const result = lock.acquire("hash1", "sess-b");
    expect(result.ok).toBe(false);
  });

  test("release removes the lock only for the holder", () => {
    lock.acquire("hash1", "sess-a");
    lock.release("hash1", "sess-b");
    expect(existsSync(join(dir, "locks", "hash1.json"))).toBe(true);
    lock.release("hash1", "sess-a");
    expect(existsSync(join(dir, "locks", "hash1.json"))).toBe(false);
  });

  test("lock files are scoped per file hash", () => {
    lock.acquire("hash1", "sess-a");
    const result = lock.acquire("hash2", "sess-b");
    expect(result.ok).toBe(true);
  });
});
