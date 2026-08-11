import { describe, expect, test } from 'bun:test';
import { startBase } from '../engine';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const stub = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../..',
  'test',
  'fixtures',
  'stub-opencode.ts',
);

describe('startBase', () => {
  test('spawns the base server and drives sessions over the wire', async () => {
    const base = await startBase({
      command: [process.execPath, 'run', stub],
      password: 'test-pw',
      config: { share: 'disabled' },
    });
    try {
      expect(base.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const session = await base.client.createSession('/tmp', 'hello');
      expect(session.id).toBe('sess_1');
      await base.client.prompt('sess_1', 'hi');
      const events = await base.client.subscribeEvents();
      const seen: string[] = [];
      for await (const event of events) {
        seen.push(event.type);
        if (seen.length >= 3) break;
      }
      expect(seen).toEqual([
        'session.next.text.delta',
        'session.next.text.delta',
        'session.next.text.ended',
      ]);
    } finally {
      await base.close();
    }
  });
});
