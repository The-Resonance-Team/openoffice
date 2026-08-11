import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  SessionStore,
  HistoryStore,
  DraftManager,
  filePathHash,
  ShareStore,
  on,
  createDefaultOfficeCliTool,
} from '@openoffice/core';

import {
  AskChannel,
  createApp,
  startBase,
  buildBaseConfig,
  writeOfficeCliToolFile,
  type BaseEngine,
} from '@openoffice/server';
import { startFakeLLM, tempDir, docContains, officecliAvailable } from './helpers';

// Full-stack draft lifecycle against the base engine (ADR 0033): the agent
// turn runs in the opencode server, so the real e2e needs the vendored base
// binary and the officecli tool file round trip (writeOfficeCliToolFile +
// /internal/officecli). Until the base binary is vendored into releases, gate
// on the env var — same as daemon.test.ts.
const skip = !officecliAvailable() || !process.env.OPENOFFICE_OPENCODE_BIN;

// bun:test supports { timeout } at runtime; the bundled types lag behind.
const dataDir = tempDir('ooo-lifecycle-data-');
const projectDir = tempDir('ooo-lifecycle-project-');

let fake: {
  port: number;
  stop: () => void;
  setScript: (s: (call: { index: number }) => any) => void;
};
let base: BaseEngine;
let store: SessionStore;
let history: HistoryStore;
let draftManager: DraftManager;
let askChannel: AskChannel;
let api: ReturnType<typeof createApp>['app'];
let draftDir: string;

function toolCall(file: string, command: string, extra: Record<string, unknown> = {}) {
  return {
    kind: 'tool-call' as const,
    name: 'officecli',
    args: JSON.stringify({ command, file, ...extra }),
  };
}

/** Scripted per-test LLM: create+add, then edit, then extra paragraph. */
function standardScript(file: string) {
  return (call: { index: number }) =>
    (
      [
        toolCall(file, 'create'),
        toolCall(file, 'add', {
          parent: '/body',
          type: 'paragraph',
          props: { text: 'Hello E2E' },
        }),
        { kind: 'text', content: 'Created.' },
        toolCall(file, 'set', {
          path: '/body/p[@paraId=00100000]',
          find: 'Hello',
          replace: 'World',
        }),
        { kind: 'text', content: 'Edited.' },
        toolCall(file, 'add', {
          parent: '/body',
          type: 'paragraph',
          props: { text: 'Undo me' },
        }),
        { kind: 'text', content: 'Added.' },
      ] as const
    )[call.index] ?? { kind: 'text', content: 'Done.' };
}

let fileCounter = 0;

function freshFile(): string {
  return join(projectDir, `report-${fileCounter++}.docx`);
}

beforeAll(async () => {
  // One fake LLM + one base server for the whole suite: the base's provider
  // config pins the fake's port at spawn. Each test swaps the fake's script
  // (setScript) to drive its own turn sequence.
  fake = await startFakeLLM(() => ({ kind: 'text', content: 'idle' }));
  store = new SessionStore(join(dataDir, 'openoffice.db'));
  history = new HistoryStore(dataDir);
  askChannel = new AskChannel(10_000);
  draftManager = new DraftManager({
    dataDir,
    history,
    askUser: (question, sessionID) => askChannel.ask(sessionID, question),
    execOfficeCli: async (args) => {
      try {
        const stdout = execFileSync('officecli', args, {
          encoding: 'utf-8',
          timeout: 30000,
        });
        return { stdout, exitCode: 0 };
      } catch (e: any) {
        return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
      }
    },
  });
  draftDir = join(dataDir, 'drafts');

  // The tool file must exist before the base starts: the base discovers
  // tool files from its config dir at boot (ADR 0033).
  writeOfficeCliToolFile(join(dataDir, 'base'));
  base = await startBase({
    command: [process.env.OPENOFFICE_OPENCODE_BIN!],
    password: 'e2e-base-pw',
    config: buildBaseConfig({
      model: 'openai/e2e',
      provider: { openai: { apiKey: 'test-key', baseURL: `http://127.0.0.1:${fake.port}/v1` } },
    }),
    env: {
      OPENCODE_CONFIG_DIR: join(dataDir, 'base'),
      OPENOFFICE_DATA_DIR: dataDir,
    },
  });
  const app = createApp({
    base,
    sessionDefaults: { agent: 'office', model: 'openai/e2e' },
    store,
    draftManager,
    history,
    askChannel,
    shareStore: new ShareStore(store.db),
    shareMode: 'auto',
    baseToken: 'e2e-base-pw',
    officecliExec: async (params: Record<string, unknown>, sessionID: string) => {
      const tool = createDefaultOfficeCliTool({ draftManager });
      return tool.execute(params as never, { sessionID });
    },
  });
  // The officecli tool file in the base calls back into the daemon at the
  // port in daemon.json (ADR 0033): serve the in-process app on a real port
  // and write that file so the round trip works end to end.
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: app.app.fetch });
  writeFileSync(
    join(dataDir, 'daemon.json'),
    JSON.stringify({ pid: process.pid, port: server.port! }),
  );
  api = app.app;
});

afterAll(async () => {
  await base?.close();
  fake?.stop();
});

async function newSession(): Promise<string> {
  const res = await api.request('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cwd: projectDir }),
  });
  const session = (await res.json()) as { id: string };
  return session.id;
}

async function turn(id: string, message: string): Promise<{ status: number; body: any }> {
  const res = await api.request(`/api/sessions/${id}/turn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function post(id: string, route: string, body: Record<string, unknown>): Promise<number> {
  const res = await api.request(`/api/sessions/${id}/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status;
}

function historyPoints(file: string): Array<{ timestamp: number }> {
  const indexPath = join(dataDir, 'history', `${filePathHash(file)}.json`);
  if (!existsSync(indexPath)) return [];
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

function draftMetaFiles(sessionID: string): string[] {
  if (!existsSync(draftDir)) return [];
  const out: string[] = [];
  for (const hash of readdirSync(draftDir)) {
    for (const entry of readdirSync(join(draftDir, hash))) {
      if (entry.startsWith(sessionID) && entry.endsWith('.meta.json')) {
        out.push(join(draftDir, hash, entry));
      }
    }
  }
  return out;
}

function metaOf(sessionID: string): { status: string } | null {
  const metas = draftMetaFiles(sessionID);
  return metas.length ? JSON.parse(readFileSync(metas[0], 'utf-8')) : null;
}

function nextAsk(sessionID: string): Promise<{ promptID: string }> {
  return new Promise((resolve) => {
    const off = on('session:ask', (d) => {
      if (d.sessionID === sessionID) {
        off();
        resolve({ promptID: d.promptID });
      }
    });
  });
}

async function answer(sessionID: string, promptID: string, text: string) {
  const res = await api.request(`/api/sessions/${sessionID}/ask-answer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ promptID, answer: text }),
  });
  return res.status;
}

describe('draft lifecycle E2E (full stack, scripted LLM)', () => {
  test.skipIf(skip)('create → agent edit → accept → history', async () => {
    const file = freshFile();
    fake.setScript(standardScript(file));

    const id = await newSession();
    const { status } = await turn(id, "Create report.docx with paragraph 'Hello E2E'");
    expect(status).toBe(200);

    expect(draftMetaFiles(id).length).toBe(1);
    expect(existsSync(file)).toBe(false); // draft-born doc: real file appears on accept

    expect(await post(id, 'accept', { filePath: file })).toBe(200);
    expect(existsSync(file)).toBe(true);
    expect(docContains(file, 'Hello E2E')).toBe(true);
    expect(historyPoints(file).length).toBe(1);
  });

  test.skipIf(skip)('undo discards the draft, real file untouched', async () => {
    const file = freshFile();
    fake.setScript(standardScript(file));

    const id = await newSession();
    await turn(id, 'Create and accept a document');
    await post(id, 'accept', { filePath: file });
    expect(historyPoints(file).length).toBe(1);

    const { status } = await turn(id, 'Add another paragraph');
    expect(status).toBe(200);
    expect(draftMetaFiles(id).length).toBe(1);

    expect(await post(id, 'undo', { filePath: file })).toBe(200);
    expect(draftMetaFiles(id).length).toBe(0);
    expect(docContains(file, 'Undo me')).toBe(false);
    expect(historyPoints(file).length).toBe(1); // no new accept-point
  });

  test.skipIf(skip)('revert restores through a new draft, never a direct write', async () => {
    const file = freshFile();
    fake.setScript(standardScript(file));

    const id = await newSession();
    await turn(id, 'Create a document');
    await post(id, 'accept', { filePath: file });
    const before = historyPoints(file)[0].timestamp;

    await turn(id, 'Change Hello to World');
    expect(await post(id, 'accept', { filePath: file })).toBe(200);
    expect(docContains(file, 'World')).toBe(true);
    expect(historyPoints(file).length).toBe(2);

    const rv = await post(id, 'revert', {
      filePath: file,
      timestamp: before,
    });
    expect(rv).toBe(200);
    // revert only plants a draft — the real file still shows the accepted state
    expect(docContains(file, 'World')).toBe(true);
    expect(draftMetaFiles(id).length).toBe(1);

    expect(await post(id, 'accept', { filePath: file })).toBe(200);
    expect(docContains(file, 'Hello E2E')).toBe(true);
    expect(historyPoints(file).length).toBe(3);
  });

  test.skipIf(skip)('cross-session orphan recovery (ended session)', async () => {
    const file = freshFile();
    fake.setScript(
      (call) =>
        (
          [
            toolCall(file, 'create'),
            toolCall(file, 'add', {
              parent: '/body',
              type: 'paragraph',
              props: { text: 'Orphaned edits' },
            }),
            { kind: 'text', content: 'Created.' },
            toolCall(file, 'create'),
            toolCall(file, 'add', {
              parent: '/body',
              type: 'paragraph',
              props: { text: 'Recovered edits' },
            }),
            { kind: 'text', content: 'Created.' },
          ] as const
        )[call.index] ?? { kind: 'text', content: 'Done.' },
    );

    const sessionA = await newSession();
    const { status } = await turn(sessionA, 'Create an orphaned draft');
    expect(status).toBe(200);
    expect(metaOf(sessionA)?.status).toBe('active');

    await api.request(`/api/sessions/${sessionA}/end`, { method: 'POST' });
    expect(metaOf(sessionA)?.status).toBe('orphaned');

    // Session B reopens the file: orphan discovery prompts; "discard" resolves it
    const sessionB = await newSession();
    const askPromise = nextAsk(sessionB);
    const turnPromise = turn(sessionB, 'Create a fresh draft');
    const { promptID } = await askPromise;
    expect(await answer(sessionB, promptID, 'discard')).toBe(200);
    expect((await turnPromise).status).toBe(200);

    expect(await post(sessionB, 'accept', { filePath: file })).toBe(200);
    expect(docContains(file, 'Recovered edits')).toBe(true);
    expect(docContains(file, 'Orphaned edits')).toBe(false);
  });

  test.skipIf(skip)(
    'stale-lock override orphans the displaced draft, still recoverable',
    async () => {
      const file = freshFile();
      fake.setScript(
        (call) =>
          (
            [
              toolCall(file, 'create'),
              toolCall(file, 'add', {
                parent: '/body',
                type: 'paragraph',
                props: { text: "A's edits" },
              }),
              { kind: 'text', content: 'Created.' },
              toolCall(file, 'create'),
              toolCall(file, 'add', {
                parent: '/body',
                type: 'paragraph',
                props: { text: "B's edits" },
              }),
              { kind: 'text', content: 'Created.' },
            ] as const
          )[call.index] ?? { kind: 'text', content: 'Done.' },
      );

      const sessionA = await newSession();
      await turn(sessionA, 'Create a draft then go stale');
      expect(draftMetaFiles(sessionA).length).toBe(1);

      // Age A's lock beyond the 24h staleness window
      const hash = filePathHash(file);
      const lockPath = join(dataDir, 'locks', `${hash}.json`);
      const lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
      lock.lastTouchedAt = Date.now() - 25 * 60 * 60 * 1000;
      writeFileSync(lockPath, JSON.stringify(lock));

      // B's mutating command overrides the stale lock; A's draft is orphaned
      // and offered to B for recovery. B accepts it, then proceeds with its own.
      const sessionB = await newSession();
      const askPromise = nextAsk(sessionB);
      const turnPromise = turn(sessionB, 'Take over the file');
      const { promptID } = await askPromise;
      expect(await answer(sessionB, promptID, 'accept')).toBe(200);
      expect((await turnPromise).status).toBe(200);
      expect(draftMetaFiles(sessionB).length).toBe(1);
      expect(metaOf(sessionA)).toBeNull(); // A's draft was consumed by the accept

      expect(await post(sessionB, 'accept', { filePath: file })).toBe(200);
      expect(docContains(file, "B's edits")).toBe(true);
    },
  );

  test.skipIf(skip)('share round-trip: URL, viewer, replay, revoke', async () => {
    const file = freshFile();
    fake.setScript(standardScript(file));

    const id = await newSession();
    await turn(id, "Create report.docx with paragraph 'Hello E2E'");
    await post(id, 'accept', { filePath: file });
    expect(docContains(file, 'Hello E2E')).toBe(true);
    console.log(
      'STORE MESSAGES',
      JSON.stringify(
        store.messages(id).map((m: any) => ({
          role: m.info.role,
          text: m.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join(''),
        })),
      ),
    );

    const shareRes = await api.request(`/api/sessions/${id}/share`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(shareRes.status).toBe(200);
    const { url } = (await shareRes.json()) as { url: string };
    expect(url).toMatch(/\/share\/[0-9a-f]{64}$/);
    const token = url.split('/share/')[1];

    const view = await api.request(`/share/${token}`);
    expect(view.status).toBe(200);
    expect(await view.text()).toContain('Read-only');

    const stream = await api.request(`/share/${token}/stream`);
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    let data = '';
    for (;;) {
      const chunk = (await Promise.race([
        reader.read(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
      ]).catch(() => null)) as { value?: Uint8Array } | null;
      if (!chunk) break;
      data += decoder.decode(chunk.value);
    }
    reader.cancel();
    expect(data).toContain('Create report.docx');
    expect(data).not.toContain('toolStart');

    expect(await post(id, 'unshare', {})).toBe(200);
    const gone = await api.request(`/share/${token}`);
    expect(gone.status).toBe(410);

    expect(await post(id, 'end', {})).toBe(200);
    const again = await api.request(`/api/sessions/${id}/share`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(again.status).toBe(409);
  });
});
