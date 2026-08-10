import { describe, expect, test, beforeEach } from 'bun:test';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { HistoryStore } from '../index';

let dir: string;
let store: HistoryStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'oo-history-'));
  store = new HistoryStore(dir);
});

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const BYTES_A = new TextEncoder().encode('draft contents A');
const BYTES_B = new TextEncoder().encode('draft contents B');

describe('HistoryStore', () => {
  test('record writes snapshot bytes and an index entry', async () => {
    const point = await store.record('hash1', 'sess-1', BYTES_A, '.docx');

    expect(point.sessionID).toBe('sess-1');
    expect(point.snapshotHash).toBe(sha256(BYTES_A));
    expect(existsSync(point.snapshotPath)).toBe(true);
    expect(readFileSync(point.snapshotPath).equals(Buffer.from(BYTES_A))).toBe(true);

    const listed = store.list('hash1');
    expect(listed).toHaveLength(1);
    expect(listed[0].snapshotHash).toBe(point.snapshotHash);
  });

  test('list returns most recent first', async () => {
    const a = await store.record('hash1', 's1', BYTES_A, '.docx');
    const b = await store.record('hash1', 's2', BYTES_B, '.docx');

    const listed = store.list('hash1');
    expect(listed.map((p) => p.timestamp)).toEqual([b.timestamp, a.timestamp]);
  });

  test('list is scoped by file hash', async () => {
    await store.record('hash1', 's1', BYTES_A, '.docx');
    await store.record('hash2', 's1', BYTES_B, '.docx');

    expect(store.list('hash1')).toHaveLength(1);
    expect(store.list('hash2')).toHaveLength(1);
    expect(store.list('nope')).toHaveLength(0);
  });

  test('index survives a reload', async () => {
    await store.record('hash1', 's1', BYTES_A, '.docx');

    const reopened = new HistoryStore(dir);
    const listed = reopened.list('hash1');
    expect(listed).toHaveLength(1);
    expect(listed[0].sessionID).toBe('s1');
  });

  test('restore returns the exact snapshot bytes', async () => {
    await store.record('hash1', 's1', BYTES_A, '.docx');
    await store.record('hash1', 's2', BYTES_B, '.docx');

    const restored = store
      .list('hash1')
      .map((p) => new TextDecoder().decode(store.restore('hash1', p.timestamp)!));
    expect(restored).toContain('draft contents A');
    expect(restored).toContain('draft contents B');
  });

  test('restore of an unknown timestamp returns null', async () => {
    expect(store.restore('hash1', 123456)).toBeNull();
  });
});
