import { Hono, type Context } from 'hono';

import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AttachedClients } from './attached';
import {
  on,
  emit,
  filePathHash,
  shareViewerPage,
  type SessionStore,
  type Session,
  type WithParts,
  type TextPart,
  type DraftManager,
  type HistoryStore,
  type ShareStore,
  type ShareMode,
} from '@openoffice/core';
import type { EventMap, McpServerStatusInfo } from '@openoffice/protocol';
import { mapBaseEvent } from '../base';

import type { UpdateStatus } from '../update';

import { createAuthMiddleware, type ServerAuthConfig } from './auth';
import { createCorsMiddleware } from './cors';

export class AskChannel {
  private pending = new Map<string, { sessionID: string; resolve: (answer: string) => void }>();

  constructor(private ttlMs: number = 5 * 60 * 1000) {}

  ask(sessionID: string, question: string): Promise<string> {
    const promptID = randomUUID();
    emit('session:ask', { sessionID, promptID, question });
    return new Promise((resolve) => {
      this.pending.set(promptID, { sessionID, resolve });
      // ponytail: a vanished client must not hang the turn queue forever;
      // "" answers fall through to the default branch (skip/leave) everywhere
      setTimeout(() => {
        if (this.pending.delete(promptID)) resolve('');
      }, this.ttlMs);
    });
  }

  answer(sessionID: string, promptID: string, answer: string): boolean {
    const pending = this.pending.get(promptID);
    if (!pending || pending.sessionID !== sessionID) return false;
    this.pending.delete(promptID);
    pending.resolve(answer);
    return true;
  }
}

// The runtime MCP control surface the daemon exposes over HTTP, proxied to
// the base server (ADR 0033).
export interface McpApi {
  status(): Promise<Record<string, McpServerStatusInfo>>;
  enable(name: string): Promise<McpServerStatusInfo>;
  disable(name: string): Promise<McpServerStatusInfo>;
}

export interface ServerDeps {
  base: import('../base').BaseEngine;
  /** agent/model the wire Session reports; the base owns the actual values. */
  sessionDefaults: { agent: string; model: string };
  store: SessionStore;
  draftManager: DraftManager;
  history: HistoryStore;
  askChannel: AskChannel;
  shareStore: ShareStore;
  shareMode: ShareMode;
  /**
   * The officecli tool executor the base's tool file calls back into (ADR
   * 0033). Runs the draft-aware createDefaultOfficeCliTool. The base token is
   * the password the daemon set on the spawned base server's env — only the
   * base process knows it, so the internal route is unreachable by clients.
   */
  officecliExec: (params: Record<string, unknown>, sessionID: string) => Promise<unknown>;
  baseToken: string;
  updateStatus?: () => Promise<UpdateStatus>;
  /** Runtime MCP control surface; absent means no /api/mcp routes. */
  mcp?: McpApi;
  /** Basic auth. Omit (or pass a null password) to run the daemon unguarded. */
  auth?: ServerAuthConfig;
  /** Allowed browser origins. Empty (the default) sends no CORS headers. */
  corsOrigins?: string[];
}

// Maps a base (opencode) session to the wire Session clients already speak.
// The base owns the session; agent/model defaults are the daemon's config.
function toWireSession(
  sdk: { id: string; title: string; directory: string; time: { created: number; updated: number } },
  defaults: { agent: string; model: string },
): Session {
  return {
    id: sdk.id,
    agent: defaults.agent,
    model: defaults.model,
    title: sdk.title,
    cwd: sdk.directory,
    messages: [],
    createdAt: sdk.time.created,
    updatedAt: sdk.time.updated,
  };
}

function isNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number' &&
    (err as { status: number }).status === 404
  );
}

// Bridges the base server's event stream into the daemon event bus. The bus
// is the single redaction choke point (CONTEXT.md Event safety): mapped events
// are emitted here so every consumer — stream routes, share replay, anything
// future — sees redacted payloads without remembering to redact (ADR 0023).
//
// Turn semantics: opencode streams `session.next.text.delta` fragments and
// ends the turn with `session.status: idle`. The bridge accumulates deltas per
// session and emits ONE `llm:done` per turn at idle — matching the wire
// protocol's "one done per turn" contract — and persists the user message
// (prompt.admitted) and the assistant reply so share replay has a transcript
// even when no client stream was open (ADR 0033).
export async function bridgeBaseEvents(
  base: import('../base').BaseEngine,
  store?: SessionStore,
  userTexts?: Map<string, string>,
): Promise<void> {
  const events = await base.client.subscribeEvents();
  const acc = new Map<string, string>();
  for await (const event of events) {
    const mapped = mapBaseEvent(event);
    if (!mapped) continue;

    if (mapped.type === 'llm:token') {
      acc.set(mapped.sessionID, (acc.get(mapped.sessionID) ?? '') + mapped.token);
      emit(mapped.type, mapped);
      continue;
    }
    if (mapped.type === 'llm:done') {
      // text.ended carries the full part text; keep it as the fallback for
      // the turn's final done, but don't emit per-part — one done per turn
      // at idle keeps the wire contract and the turn route's await correct.
      acc.set(mapped.sessionID, mapped.response);
      continue;
    }
    if (mapped.type === 'session:status' && mapped.status === 'idle') {
      let text = acc.get(mapped.sessionID);
      acc.delete(mapped.sessionID);
      // The base re-emits the user's message as a text part during the turn;
      // strip the known user text so the reply is assistant-only.
      const userText = userTexts?.get(mapped.sessionID);
      if (text !== undefined && userText && text.startsWith(userText)) {
        text = text.slice(userText.length);
      }
      if (text !== undefined) {
        const done = { type: 'llm:done' as const, sessionID: mapped.sessionID, response: text };
        emit(done.type, done);
        persistAssistant(store, done.sessionID, done.response);
      }
      continue;
    }
    if (mapped.type === 'session:status' && mapped.status === 'busy') {
      // Turn boundary: assistant text starts accumulating after busy; the
      // user echo (emitted as a text part before busy) must not leak into
      // the assistant reply.
      acc.set(mapped.sessionID, '');
      continue;
    }
    if (mapped.type === 'session:status' && mapped.status === 'retry') {
      emit('llm:retry', {
        sessionID: mapped.sessionID,
        attempt: mapped.attempt ?? 0,
        message: mapped.message ?? 'retrying',
        next: mapped.next ?? 0,
      });
      continue;
    }

    // Remaining types are wire EventMap members only (status was handled
    // above); narrow for the emit call.
    const wire = mapped as { [K in keyof EventMap]: { type: K } & EventMap[K] }[keyof EventMap];
    emit(wire.type, wire);
  }
}

function persistUser(store: SessionStore | undefined, sessionID: string, content: string): void {
  if (!store) return;
  const messageID = randomUUID();
  store.updateMessage(sessionID, {
    id: messageID,
    role: 'user',
    time: { created: Date.now() },
  });
  store.updatePart(sessionID, messageID, {
    id: undefined,
    type: 'text',
    text: content,
  });
}

function persistAssistant(store: SessionStore | undefined, sessionID: string, text: string): void {
  if (!store) return;
  const messageID = randomUUID();
  store.updateMessage(sessionID, {
    id: messageID,
    role: 'assistant',
    finish: 'done',
    time: { created: Date.now() },
  });
  store.updatePart(sessionID, messageID, {
    id: undefined,
    type: 'text',
    text,
  });
}

// Fires a turn on the base and waits for its completion. The base streams
// text deltas and ends the turn with `session.status: idle`; the bridge turns
// that into one llm:done per turn, which the stream routes also relay. The
// blocking POST /turn contract is preserved by awaiting that done here.
async function runTurnViaBase(
  deps: ServerDeps,
  sessionID: string,
  message: string,
): Promise<string> {
  let doneOff: (() => void) | undefined;
  const done = new Promise<string>((resolve) => {
    const timer = setTimeout(
      () => {
        // A stuck turn must not hold the queue forever; resolve with "" so the
        // client can reconnect and read the stream.
        doneOff?.();
        resolve('');
      },
      5 * 60 * 1000,
    );
    doneOff = on('llm:done', (d) => {
      if (d.sessionID !== sessionID) return;
      doneOff?.();
      clearTimeout(timer);
      resolve(d.response);
    });
  });

  await deps.base.client.prompt(sessionID, message);
  const text = await done;
  return text;
}

// Share URLs are scoped to the daemon's own address (the request's Host), so
// they stay correct the day Sync widens the bind beyond loopback.
function shareUrl(c: Context, token: string): string {
  const host = c.req.header('host') ?? new URL(c.req.url).host;
  return `http://${host}/share/${token}`;
}

// Transcript text of a message for share replay: its text parts, joined.
function textOf(message: WithParts): string {
  return message.parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

// The single session-end operation: every side effect of a session ending
// lives here, so future end paths (heartbeat sweep, #39) call this instead
// of re-implementing pieces and leaking a share or an orphaned draft.
// Races (sweep vs /end) resolve atomically: markEnded is a null → set claim,
// so exactly one caller runs the side-effects — the loser's orphanAll may
// still have run (idempotent), but revoke + emit happen exactly once.
export async function endSession(deps: ServerDeps, sessionID: string): Promise<void> {
  const session = deps.store.load(sessionID);
  if (!session || session.endedAt) return;
  await deps.draftManager.orphanAll(sessionID);
  if (!deps.store.markEnded(sessionID, Date.now())) return;
  deps.shareStore.revoke(sessionID);
  emit('session:end', { sessionID });
}

export function createApp(deps: ServerDeps) {
  const app = new Hono();
  // The base event stream is per-instance (per-directory), so the bridge
  // starts after the first session pins the instance directory (ADR 0033).
  const userTexts = new Map<string, string>();
  let bridgeStarted = false;
  const startBridge = () => {
    if (bridgeStarted) return;
    bridgeStarted = true;
    // The bus is the single redaction choke point (CONTEXT.md Event safety).
    // Messages are also mirrored to the store for share replay. A bridge
    // failure (base gone) must not crash the daemon; streams go quiet.
    void bridgeBaseEvents(deps.base, deps.store, userTexts).catch((err) => {
      console.error(`base event bridge failed: ${err instanceof Error ? err.message : err}`);
    });
  };
  const attached = new AttachedClients();

  // Cross-cutting middleware must be registered before any route: a Hono
  // route handler is terminal, so middleware added afterwards never runs.
  // CORS goes first so that preflight OPTIONS is answered without auth.
  if (deps.corsOrigins && deps.corsOrigins.length > 0) {
    app.use('*', createCorsMiddleware(deps.corsOrigins));
  }
  if (deps.auth) {
    app.use('/api/*', createAuthMiddleware(deps.auth));
  }

  // Per-session turn mutex: one turn at a time, queued.
  const turnQueues = new Map<string, Promise<unknown>>();
  function enqueueTurn<T>(sessionID: string, fn: () => Promise<T>): Promise<T> {
    const prev = turnQueues.get(sessionID) ?? Promise.resolve();
    const next = prev.then(fn);
    const tail = next.catch(() => undefined);
    turnQueues.set(sessionID, tail);
    void tail.then(() => {
      if (turnQueues.get(sessionID) === tail) turnQueues.delete(sessionID);
    });
    return next;
  }

  app.post('/api/sessions', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const cwd = typeof body.cwd === 'string' ? body.cwd : process.cwd();
    const sdk = await deps.base.client.createSession(cwd);
    const session = toWireSession(sdk, deps.sessionDefaults);
    deps.store.save(session);
    startBridge();
    emit('session:create', { sessionID: session.id });
    // ponytail: best-effort auto-share, opencode parity — a failed share must
    // never fail session creation
    if (deps.shareMode === 'auto') {
      try {
        deps.shareStore.create(session.id);
      } catch {
        // ignore
      }
    }
    return c.json(session, 201);
  });

  app.get('/api/sessions', async (c) => {
    // List all sessions, newest first. The desktop GUI sidebar needs this;
    // the CLI keeps it in-process.
    const sdkSessions = await deps.base.client.listSessions();
    const sessions = sdkSessions
      .map((s) => toWireSession(s, deps.sessionDefaults))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return c.json(sessions);
  });

  app.get('/api/sessions/:id', async (c) => {
    const sessionID = c.req.param('id');
    let sdk;
    try {
      sdk = await deps.base.client.getSession(sessionID);
    } catch (err) {
      if (isNotFound(err)) return c.json({ error: 'Session not found' }, 404);
      throw err;
    }
    const session = toWireSession(sdk, deps.sessionDefaults);
    const token = deps.shareStore.get(session.id);
    return c.json({
      ...session,
      share: token ? { url: shareUrl(c, token) } : null,
    });
  });

  app.patch('/api/sessions/:id', async (c) => {
    const sessionID = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.title !== 'string') {
      return c.json({ error: 'title is required' }, 400);
    }
    let sdk;
    try {
      sdk = await deps.base.client.updateSession(sessionID, body.title);
    } catch (err) {
      if (isNotFound(err)) return c.json({ error: 'Session not found' }, 404);
      throw err;
    }
    const session = toWireSession(sdk, deps.sessionDefaults);
    deps.store.save(session);
    return c.json(session);
  });

  app.delete('/api/sessions/:id', async (c) => {
    const sessionID = c.req.param('id');
    try {
      await deps.base.client.deleteSession(sessionID);
    } catch (err) {
      if (isNotFound(err)) return c.json({ error: 'Session not found' }, 404);
      throw err;
    }
    await deps.draftManager.orphanAll(sessionID);
    deps.store.delete(sessionID);
    emit('session:end', { sessionID });
    return c.json({ ok: true });
  });

  app.post('/api/sessions/:id/turn', async (c) => {
    const sessionID = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message : '';
    if (!message) return c.json({ error: 'message is required' }, 400);

    try {
      const text = await enqueueTurn(sessionID, async () => {
        // Persist the user message only when the session exists in the
        // mirror (the base 404s unknown sessions; the FK would reject).
        if (deps.store.load(sessionID)) {
          persistUser(deps.store, sessionID, message);
        }
        userTexts.set(sessionID, message);
        return runTurnViaBase(deps, sessionID, message);
      });
      return c.json({ text });
    } catch (err) {
      if (isNotFound(err)) return c.json({ error: 'Session not found' }, 404);
      // Provider auth errors surface from the base with its own shape; the
      // daemon passes them through as 500s rather than guessing opencode's
      // error vocabulary (ADR 0033).
      throw err;
    }
  });

  app.get('/api/sessions/:id/stream', (c) => {
    const sessionID = c.req.param('id');
    return streamSSE(c, async (stream) => {
      // An open event stream is an attached client (ADR 0022). Attach after
      // the stream exists: a request aborted before this callback runs never
      // attached, so it cannot leak a count.
      attached.attach(sessionID);
      const offs: (() => void)[] = [];
      const subscribe = <K extends keyof EventMap>(event: K, fn: (d: EventMap[K]) => void) => {
        offs.push(
          on(event, (d) => {
            if (d.sessionID === sessionID) void fn(d);
          }),
        );
      };
      const write = async (data: unknown) => {
        try {
          await stream.writeSSE({ data: JSON.stringify(data) });
        } catch {
          // client gone
        }
      };

      // Every event type flows through the bus (bridgeBaseEvents emits the
      // base's mapped events into it, redacted at the single choke point —
      // CONTEXT.md Event safety). Frame shaping lives here, once per type.
      subscribe('llm:token', (d) => write({ type: 'token', token: d.token }));
      subscribe('llm:done', (d) => write({ type: 'done', response: d.response }));
      subscribe('tool:start', (d) => write({ type: 'toolStart', tool: d.tool, params: d.params }));
      subscribe('tool:done', (d) => write({ type: 'toolDone', tool: d.tool, result: d.result }));
      subscribe('session:message', (d) =>
        write({ type: 'message', role: d.role, content: d.content }),
      );
      subscribe('session:ask', (d) =>
        write({ type: 'ask', promptID: d.promptID, question: d.question }),
      );
      subscribe('session:end', () => write({ type: 'sessionEnd' }));
      subscribe('todo:updated', (d) => write({ type: 'todoUpdated', todos: d.todos }));
      subscribe('session:step-limit', (d) => write({ type: 'stepLimit', maxSteps: d.maxSteps }));

      stream.onAbort(() => {
        attached.detach(sessionID);
        for (const off of offs) off();
      });
      await new Promise(() => undefined);
    });
  });

  app.post('/api/sessions/:id/accept', async (c) => {
    const sessionID = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.filePath !== 'string') {
      return c.json({ error: 'filePath is required' }, 400);
    }
    const result = await deps.draftManager.accept(sessionID, body.filePath);
    if (!result.ok) {
      return c.json({ error: result.error }, 404);
    }
    return c.json({ ok: true });
  });

  app.post('/api/sessions/:id/undo', async (c) => {
    const sessionID = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.filePath !== 'string') {
      return c.json({ error: 'filePath is required' }, 400);
    }
    await deps.draftManager.undo(sessionID, body.filePath);
    return c.json({ ok: true });
  });

  app.post('/api/sessions/:id/revert', async (c) => {
    const sessionID = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.filePath !== 'string' || typeof body.timestamp !== 'number') {
      return c.json({ error: 'filePath and timestamp are required' }, 400);
    }
    const snapshot = deps.history.restore(filePathHash(body.filePath), body.timestamp);
    if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);
    const result = await deps.draftManager.createDraftFromBytes(
      sessionID,
      body.filePath,
      snapshot,
      extname(body.filePath).toLowerCase(),
    );
    if (!result.ok) return c.json({ error: result.error }, 409);
    return c.json({ ok: true });
  });

  app.post('/api/sessions/:id/ask-answer', async (c) => {
    const sessionID = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.promptID !== 'string' || typeof body.answer !== 'string') {
      return c.json({ error: 'promptID and answer are required' }, 400);
    }
    // Base permission requests (per_* ids) resolve through the base server;
    // local AskChannel prompts (draft orphan / question tool) resolve locally.
    if (body.promptID.startsWith('per_')) {
      const reply =
        body.answer === 'always' ? 'always' : body.answer === 'reject' ? 'reject' : 'once';
      try {
        await deps.base.client.replyPermission(sessionID, body.promptID, reply);
      } catch (err) {
        if (isNotFound(err)) return c.json({ error: 'Unknown prompt' }, 404);
        throw err;
      }
      return c.json({ ok: true });
    }
    if (!deps.askChannel.answer(sessionID, body.promptID, body.answer)) {
      return c.json({ error: 'Unknown prompt' }, 404);
    }
    return c.json({ ok: true });
  });

  app.post('/api/sessions/:id/end', async (c) => {
    // Gated on the attached-client count (ADR 0022): with Sync multi-client
    // attach, one client closing must not end the session for the others.
    // Today's single-client CLI always sees count <= 1, so behavior is
    // unchanged until multi-client attach exists.
    if (attached.shouldEndOnExplicitEnd(c.req.param('id'))) {
      await endSession(deps, c.req.param('id'));
    }
    return c.json({ ok: true });
  });

  // Share/unshare — authenticated (Basic auth mounted in the daemon). A share
  // token never reaches these routes: /share/:token is the only pair that
  // accepts one, and it is read-only.
  app.post('/api/sessions/:id/share', (c) => {
    if (deps.shareMode === 'disabled') {
      return c.json({ error: 'Sharing is disabled in configuration' }, 403);
    }
    const session = deps.store.load(c.req.param('id'));
    if (!session) return c.json({ error: 'Session not found' }, 404);
    if (session.endedAt) {
      return c.json({ error: 'Session has ended' }, 409);
    }
    const token = deps.shareStore.create(session.id);
    return c.json({ url: shareUrl(c, token) });
  });

  app.post('/api/sessions/:id/unshare', (c) => {
    const sessionID = c.req.param('id');
    if (!deps.store.load(sessionID)) {
      return c.json({ error: 'Session not found' }, 404);
    }
    deps.shareStore.revoke(sessionID);
    return c.json({ ok: true });
  });

  app.get('/share/:token', (c) => {
    if (!deps.shareStore.findByToken(c.req.param('token'))) {
      // 410, not 404: unknown and revoked tokens are indistinguishable — a
      // revoked share's URL is "gone", not "never existed"
      return c.json({ error: 'Share not found or revoked' }, 410);
    }
    return c.html(shareViewerPage);
  });

  app.get('/share/:token/stream', (c) => {
    const token = c.req.param('token');
    if (!deps.shareStore.findByToken(token)) {
      return c.json({ error: 'Share not found or revoked' }, 410);
    }
    return streamSSE(c, async (stream) => {
      const sessionID = deps.shareStore.findByToken(token)!;
      const offs: (() => void)[] = [];
      // Lazy per-event revoke check: a revoked share stops streaming within
      // one event's latency — no connection registry needed.
      const alive = () => deps.shareStore.findByToken(token) === sessionID;
      const write = async (data: unknown) => {
        if (!alive()) return;
        try {
          await stream.writeSSE({ data: JSON.stringify(data) });
        } catch {
          // client gone
        }
      };
      // Subscribe before replaying and buffer events until the snapshot is
      // sent, so events emitted during the read are delivered exactly once.
      let replaying = true;
      const replayBuffer: (() => void)[] = [];
      const subscribe = <K extends keyof EventMap>(event: K, fn: (d: EventMap[K]) => void) => {
        offs.push(
          on(event, (d) => {
            if (d.sessionID !== sessionID) return;
            if (replaying) {
              replayBuffer.push(() => void fn(d));
              return;
            }
            void fn(d);
          }),
        );
      };
      subscribe(
        'session:message',
        (d) => void write({ type: 'message', role: d.role, content: d.content }),
      );
      subscribe(
        'llm:done',
        (d) =>
          void write({
            type: 'message',
            role: 'assistant',
            content: d.response,
          }),
      );
      subscribe('session:ask', (d) => void write({ type: 'ask', question: d.question }));
      for (const m of deps.store.messages(sessionID)) {
        if (m.info.role === 'user' || m.info.role === 'assistant') {
          await write({
            type: 'message',
            role: m.info.role,
            content: textOf(m),
          });
        }
      }
      replaying = false;
      for (const event of replayBuffer) event();
      stream.onAbort(() => {
        for (const off of offs) off();
      });
      await new Promise(() => undefined);
    });
  });

  if (deps.updateStatus) {
    app.get('/api/update', async (c) => {
      try {
        return c.json(await deps.updateStatus!());
      } catch (e) {
        return c.json(
          {
            check: true,
            available: false,
            error: e instanceof Error ? e.message : 'update check failed',
          },
          502,
        );
      }
    });
  }

  // The base server's officecli tool file calls back here to execute real,
  // draft-aware officecli commands (ADR 0033). Outside /api/*: gated by the
  // per-spawn base token, not Basic auth — only the base process holds it.
  app.post('/internal/officecli', async (c) => {
    if (c.req.header('x-openoffice-base-token') !== deps.baseToken) {
      return c.json({ error: 'forbidden' }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    if (
      typeof body.sessionID !== 'string' ||
      typeof body.params !== 'object' ||
      body.params === null
    ) {
      return c.json({ error: 'sessionID and params are required' }, 400);
    }
    try {
      const result = await deps.officecliExec(
        body.params as Record<string, unknown>,
        body.sessionID,
      );
      return c.json(result);
    } catch (e) {
      return c.json({ success: false, error: e instanceof Error ? e.message : 'officecli failed' });
    }
  });

  // Runtime MCP control: per-server status and enable/disable toggles that
  // connect/disconnect without a daemon restart. In-scope toggles only —
  // adding/editing servers stays a config-file + restart operation.
  if (deps.mcp) {
    app.get('/api/mcp', async (c) => c.json(await deps.mcp!.status()));

    app.post('/api/mcp/:name/enable', async (c) => {
      const name = c.req.param('name');
      const statuses = await deps.mcp!.status();
      if (!statuses[name]) {
        return c.json({ error: `MCP server "${name}" not found` }, 404);
      }
      return c.json(await deps.mcp!.enable(name));
    });

    app.post('/api/mcp/:name/disable', async (c) => {
      const name = c.req.param('name');
      const statuses = await deps.mcp!.status();
      if (!statuses[name]) {
        return c.json({ error: `MCP server "${name}" not found` }, 404);
      }
      return c.json(await deps.mcp!.disable(name));
    });
  }

  return { app, attached, askChannel: deps.askChannel };
}
