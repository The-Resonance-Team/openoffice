import { describe, expect, test } from 'bun:test';
import { spawnBaseServer } from '../spawn';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeStub(extra: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'openoffice-base-'));
  const path = join(dir, 'opencode-stub.ts');
  writeFileSync(
    path,
    `
import { $ } from 'bun';
const args = process.argv.slice(2);
const port = Number(args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 0);
const hostname = args.find((a) => a.startsWith('--hostname='))?.split('=')[1] ?? '127.0.0.1';
${extra}
const server = Bun.serve({
  port,
  hostname,
  fetch() { return new Response('ok'); },
});
console.log(\`opencode server listening on http://\${hostname}:\${server.port}\`);
`,
  );
  return path;
}

const bun = process.execPath;

describe('spawnBaseServer', () => {
  test('spawns a stub binary and parses the listening URL', async () => {
    const stub = makeStub('');
    const { url, close } = await spawnBaseServer({
      command: [bun, 'run', stub],
      password: 'test-pw',
      config: { share: 'disabled' },
      timeout: 5000,
    });
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    await close();
  });

  test('passes password and config to the child via env', async () => {
    const stub = makeStub(`
      const pwd = process.env.OPENCODE_SERVER_PASSWORD;
      const cfg = process.env.OPENCODE_CONFIG_CONTENT;
      if (pwd !== 's3cret') { console.error('bad password'); process.exit(3); }
      if (!cfg || !cfg.includes('"share":"disabled"')) { console.error('bad config'); process.exit(4); }
    `);
    const { close } = await spawnBaseServer({
      command: [bun, 'run', stub],
      password: 's3cret',
      config: { share: 'disabled' },
      timeout: 5000,
    });
    await close();
  });

  test('rejects with the child output when the binary exits before listening', async () => {
    const stub = makeStub(`console.error('boom'); process.exit(1);`);
    await expect(
      spawnBaseServer({ command: [bun, 'run', stub], password: 'pw', timeout: 5000 }),
    ).rejects.toThrow(/boom/);
  });

  test('rejects on timeout when no listening line arrives', async () => {
    const stub = makeStub(`await Bun.sleep(10_000);`);
    await expect(
      spawnBaseServer({ command: [bun, 'run', stub], password: 'pw', timeout: 200 }),
    ).rejects.toThrow(/Timeout waiting for server/);
  });

  test('rejects when the binary does not exist', async () => {
    await expect(
      spawnBaseServer({ command: ['/nonexistent/opencode'], password: 'pw', timeout: 2000 }),
    ).rejects.toThrow();
  });
});
