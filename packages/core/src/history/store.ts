import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AcceptPoint {
  sessionID: string;
  timestamp: number;
  snapshotHash: string;
  snapshotPath: string;
}

export class HistoryStore {
  constructor(private dataDir: string) {}

  private indexPath(filePathHash: string): string {
    return join(this.dataDir, 'history', `${filePathHash}.json`);
  }

  private snapshotDir(filePathHash: string): string {
    return join(this.dataDir, 'history', filePathHash);
  }

  async record(
    filePathHash: string,
    sessionID: string,
    snapshotBytes: Uint8Array,
    extension: string,
  ): Promise<AcceptPoint> {
    const dir = this.snapshotDir(filePathHash);
    mkdirSync(dir, { recursive: true });
    let timestamp = Date.now();
    let snapshotPath = join(dir, `${timestamp}${extension}`);
    while (existsSync(snapshotPath)) {
      timestamp += 1;
      snapshotPath = join(dir, `${timestamp}${extension}`);
    }
    writeFileSync(snapshotPath, snapshotBytes);
    const snapshotHash = createHash('sha256').update(snapshotBytes).digest('hex');

    const points = this.list(filePathHash);
    points.push({ sessionID, timestamp, snapshotHash, snapshotPath });
    const tmp = `${this.indexPath(filePathHash)}.tmp`;
    writeFileSync(tmp, JSON.stringify(points));
    renameSync(tmp, this.indexPath(filePathHash));

    return { sessionID, timestamp, snapshotHash, snapshotPath };
  }

  list(filePathHash: string): AcceptPoint[] {
    const indexPath = this.indexPath(filePathHash);
    if (!existsSync(indexPath)) return [];
    try {
      const points = JSON.parse(readFileSync(indexPath, 'utf-8')) as AcceptPoint[];
      return points.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  restore(filePathHash: string, timestamp: number): Uint8Array | null {
    const point = this.list(filePathHash).find((p) => p.timestamp === timestamp);
    if (!point || !existsSync(point.snapshotPath)) return null;
    return readFileSync(point.snapshotPath);
  }
}
