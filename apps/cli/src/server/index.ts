import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { on, emit, type EventMap } from "../events";
import type { SessionStore, Session } from "../session";
import type { ToolRegistry } from "../tool";
import { filePathHash, type DraftManager } from "../draft";
import type { HistoryStore } from "../history";
import type { UpdateStatus } from "../update";
import { AuthRequiredError } from "../llm";
import { createAuthMiddleware, type ServerAuthConfig } from "./auth";
import { createCorsMiddleware } from "./cors";

export class AskChannel {
  private pending = new Map<string, (answer: string) => void>();

  constructor(private ttlMs: number = 5 * 60 * 1000) {}

  ask(sessionID: string, question: string): Promise<string> {
    const promptID = randomUUID();
    emit("session:ask", { sessionID, promptID, question });
    return new Promise((resolve) => {
      this.pending.set(promptID, resolve);
      // ponytail: a vanished client must not hang the turn queue forever;
      // "" answers fall through to the default branch (skip/leave) everywhere
      setTimeout(() => {
        if (this.pending.delete(promptID)) resolve("");
      }, this.ttlMs);
    });
  }

  answer(promptID: string, answer: string): boolean {
    const resolve = this.pending.get(promptID);
    if (!resolve) return false;
    this.pending.delete(promptID);
    resolve(answer);
    return true;
  }
}

export interface SessionRuntime {
  tools: ToolRegistry;
  system: string;
}

export interface ServerDeps {
  store: SessionStore;
  draftManager: DraftManager;
  history: HistoryStore;
  askChannel: AskChannel;
  createSession: (cwd: string) => Session;
  buildRuntime: (session: Session) => SessionRuntime;
  runTurn: (
    session: Session,
    message: string,
    runtime: SessionRuntime,
    store: SessionStore
  ) => Promise<{ text: string }>;
  updateStatus?: () => Promise<UpdateStatus>;
  /** Basic auth. Omit (or pass a null password) to run the daemon unguarded. */
  auth?: ServerAuthConfig;
  /** Allowed browser origins. Empty (the default) sends no CORS headers. */
  corsOrigins?: string[];
}

export function createApp(deps: ServerDeps) {
  const app = new Hono();

  // Cross-cutting middleware must be registered before any route: a Hono
  // route handler is terminal, so middleware added afterwards never runs.
  // CORS goes first so that preflight OPTIONS is answered without auth.
  if (deps.corsOrigins && deps.corsOrigins.length > 0) {
    app.use("*", createCorsMiddleware(deps.corsOrigins));
  }
  if (deps.auth) {
    app.use("*", createAuthMiddleware(deps.auth));
  }

  // Per-session turn mutex: one turn at a time, queued.
  const turnQueues = new Map<string, Promise<unknown>>();
  function enqueueTurn<T>(sessionID: string, fn: () => Promise<T>): Promise<T> {
    const prev = turnQueues.get(sessionID) ?? Promise.resolve();
    const next = prev.then(fn);
    turnQueues.set(
      sessionID,
      next.catch(() => undefined)
    );
    return next;
  }

  app.post("/api/sessions", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const session = deps.createSession(
      typeof body.cwd === "string" ? body.cwd : process.cwd()
    );
    deps.store.save(session);
    emit("session:create", { sessionID: session.id });
    return c.json(session, 201);
  });

  app.get("/api/sessions/:id", (c) => {
    const session = deps.store.load(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json(session);
  });

  app.post("/api/sessions/:id/turn", async (c) => {
    const sessionID = c.req.param("id");
    const session = deps.store.load(sessionID);
    if (!session) return c.json({ error: "Session not found" }, 404);
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : "";
    if (!message) return c.json({ error: "message is required" }, 400);

    try {
      const text = await enqueueTurn(sessionID, async () => {
        const runtime = deps.buildRuntime(session);
        const result = await deps.runTurn(
          session,
          message,
          runtime,
          deps.store
        );
        return result.text;
      });
      return c.json({ text });
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        return c.json({ error: "auth-required", provider: err.provider }, 401);
      }
      throw err;
    }
  });

  app.get("/api/sessions/:id/stream", (c) => {
    const sessionID = c.req.param("id");
    return streamSSE(c, async (stream) => {
      const offs: (() => void)[] = [];
      const subscribe = <K extends keyof EventMap>(
        event: K,
        fn: (d: EventMap[K]) => void
      ) => {
        offs.push(
          on(event, (d) => {
            if (d.sessionID === sessionID) void fn(d);
          })
        );
      };
      const write = async (data: unknown) => {
        try {
          await stream.writeSSE({ data: JSON.stringify(data) });
        } catch {
          // client gone
        }
      };

      subscribe("llm:token", (d) => write({ type: "token", token: d.token }));
      subscribe("llm:done", (d) =>
        write({ type: "done", response: d.response })
      );
      subscribe("tool:start", (d) =>
        write({ type: "toolStart", tool: d.tool, params: d.params })
      );
      subscribe("tool:done", (d) =>
        write({ type: "toolDone", tool: d.tool, result: d.result })
      );
      subscribe("session:message", (d) =>
        write({ type: "message", role: d.role, content: d.content })
      );
      subscribe("session:ask", (d) =>
        write({ type: "ask", promptID: d.promptID, question: d.question })
      );

      stream.onAbort(() => {
        for (const off of offs) off();
      });
      await new Promise(() => undefined);
    });
  });

  app.post("/api/sessions/:id/accept", async (c) => {
    const sessionID = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.filePath !== "string") {
      return c.json({ error: "filePath is required" }, 400);
    }
    const result = await deps.draftManager.accept(sessionID, body.filePath);
    if (!result.ok) {
      return c.json({ error: result.error }, 404);
    }
    return c.json({ ok: true });
  });

  app.post("/api/sessions/:id/undo", async (c) => {
    const sessionID = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.filePath !== "string") {
      return c.json({ error: "filePath is required" }, 400);
    }
    await deps.draftManager.undo(sessionID, body.filePath);
    return c.json({ ok: true });
  });

  app.post("/api/sessions/:id/revert", async (c) => {
    const sessionID = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (
      typeof body.filePath !== "string" ||
      typeof body.timestamp !== "number"
    ) {
      return c.json({ error: "filePath and timestamp are required" }, 400);
    }
    const snapshot = deps.history.restore(
      filePathHash(body.filePath),
      body.timestamp
    );
    if (!snapshot) return c.json({ error: "Snapshot not found" }, 404);
    const result = await deps.draftManager.createDraftFromBytes(
      sessionID,
      body.filePath,
      snapshot,
      extname(body.filePath).toLowerCase()
    );
    if (!result.ok) return c.json({ error: result.error }, 409);
    return c.json({ ok: true });
  });

  app.post("/api/sessions/:id/ask-answer", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.promptID !== "string" || typeof body.answer !== "string") {
      return c.json({ error: "promptID and answer are required" }, 400);
    }
    if (!deps.askChannel.answer(body.promptID, body.answer)) {
      return c.json({ error: "Unknown prompt" }, 404);
    }
    return c.json({ ok: true });
  });

  app.post("/api/sessions/:id/end", async (c) => {
    const sessionID = c.req.param("id");
    await deps.draftManager.orphanAll(sessionID);
    emit("session:end", { sessionID });
    return c.json({ ok: true });
  });

  if (deps.updateStatus) {
    app.get("/api/update", async (c) => {
      try {
        return c.json(await deps.updateStatus!());
      } catch (e) {
        return c.json(
          {
            check: true,
            available: false,
            error: e instanceof Error ? e.message : "update check failed",
          },
          502
        );
      }
    });
  }

  return { app, askChannel: deps.askChannel };
}
