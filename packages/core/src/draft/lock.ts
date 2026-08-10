import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

export interface LockInfo {
  sessionID: string;
  filePathHash: string;
  acquiredAt: number;
  lastTouchedAt: number;
}

export type AcquireResult = { ok: true; overridden?: LockInfo } | { ok: false; holder: LockInfo };

export class LockManager {
  constructor(
    private dataDir: string,
    private staleAfterMs: number = 24 * 60 * 60 * 1000,
    private now: () => number = () => Date.now(),
  ) {}

  private lockPath(filePathHash: string): string {
    return join(this.dataDir, 'locks', `${filePathHash}.json`);
  }

  get(filePathHash: string): LockInfo | null {
    const path = this.lockPath(filePathHash);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as LockInfo;
    } catch {
      return null;
    }
  }

  acquire(filePathHash: string, sessionID: string): AcquireResult {
    const path = this.lockPath(filePathHash);
    mkdirSync(join(this.dataDir, 'locks'), { recursive: true });

    const lock: LockInfo = {
      sessionID,
      filePathHash,
      acquiredAt: this.now(),
      lastTouchedAt: this.now(),
    };

    const existing = this.get(filePathHash);
    if (existing) {
      if (existing.sessionID === sessionID) {
        this.writeLock(path, lock);
        return { ok: true };
      }
      if (this.now() - existing.lastTouchedAt <= this.staleAfterMs) {
        return { ok: false, holder: existing };
      }
      // stale — override; report the displaced holder so its draft can be orphaned
      this.writeLock(path, lock);
      return { ok: true, overridden: existing };
    }

    // Atomic create: wx fails if a racer wrote it first, then re-read and fail.
    try {
      this.writeLock(path, lock, true);
      return { ok: true };
    } catch {
      const racer = this.get(filePathHash);
      if (racer && racer.sessionID !== sessionID) {
        return { ok: false, holder: racer };
      }
      return { ok: true };
    }
  }

  release(filePathHash: string, sessionID: string): boolean {
    const existing = this.get(filePathHash);
    if (!existing || existing.sessionID !== sessionID) return false;
    unlinkSync(this.lockPath(filePathHash));
    try {
      rmdirSync(join(this.dataDir, 'locks'));
    } catch {
      // other lock files remain
    }
    return true;
  }

  private writeLock(path: string, lock: LockInfo, exclusive = false): void {
    writeFileSync(path, JSON.stringify(lock), exclusive ? { flag: 'wx' } : undefined);
  }
}
