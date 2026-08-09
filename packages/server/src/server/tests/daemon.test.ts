import { describe, expect, test, beforeEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readDaemonInfo, isAlive } from '../daemon';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'daemon-info-'));
});

test('readDaemonInfo returns null when the file is missing or malformed', () => {
  expect(readDaemonInfo(dir)).toBeNull();
  writeFileSync(join(dir, 'daemon.json'), 'not json');
  expect(readDaemonInfo(dir)).toBeNull();
});

test('readDaemonInfo parses the daemon.json written by spawnDaemon', () => {
  writeFileSync(join(dir, 'daemon.json'), JSON.stringify({ pid: 1234, port: 9999 }));
  expect(readDaemonInfo(dir)).toEqual({ pid: 1234, port: 9999 });
});

test('isAlive distinguishes a live pid from a dead one', () => {
  expect(isAlive(process.pid)).toBe(true);
  expect(isAlive(2_147_483_647)).toBe(false);
});
