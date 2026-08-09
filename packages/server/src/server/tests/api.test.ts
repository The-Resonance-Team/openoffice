import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createApp, AskChannel, type SessionRuntime } from "../index";
import {
  SessionStore,
  DraftManager,
  filePathHash,
  HistoryStore,
  ShareStore,
  AuthRequiredError,
  type Session,
} from "@openoffice/core";

let dir: string;
let store: SessionStore;
let draftManager: DraftManager;
let history: HistoryStore;
let askChannel: AskChannel;
let realFile: string;

let turnCalls: { sessionID: string; message: string }[];
let maxConcurrent = 0;
let concurrent = 0;

const fakeRuntime: SessionRuntime = { tools: {} as any, system: "" };

function fakeRunTurn(
  session: Session,
  message: string,
  _runtime: SessionRuntime,
  _store: SessionStore
): Promise<{ text: string }> {
  return new Promise((resolve) => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    setTimeout(() => {
      turnCalls.push({ sessionID: session.id, message });
      concurrent--;
      resolve({ text: `response to ${message}` });
    }, 10);
  });
}

function makeSession(cwd: string): Session {
  const now = Date.now();
  return {
    id: randomUUID(),
    agent: "build",
    model: "anthropic/claude-sonnet-4-20250514",
    title: "",
    cwd,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function makeApp() {
  return createApp({
    store,
    draftManager,
    history,
    askChannel,
    shareStore: new ShareStore(store.db),
    shareMode: "disabled",
    createSession: makeSession,
    buildRuntime: () => fakeRuntime,
    runTurn: fakeRunTurn,
  });
}

async function post(
  app: any,
  path: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const res = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-api-"));
  realFile = join(dir, "report.docx");
  mkdirSync(dir, { recursive: true });
  writeFileSync(realFile, "original");
  store = new SessionStore(join(dir, "test.db"));
  history = new HistoryStore(dir);
  draftManager = new DraftManager({
    dataDir: dir,
    history,
    execOfficeCli: async () => ({ stdout: "", exitCode: 0 }),
  });
  askChannel = new AskChannel();
  turnCalls = [];
  maxConcurrent = 0;
  concurrent = 0;
});

describe("server API", () => {
  test("creates a session with cwd and loads it", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp/work" });
    expect(created.status).toBe(201);
    const id = created.json.id;
    expect(store.load(id)!.cwd).toBe("/tmp/work");

    const get = await app.request(`/api/sessions/${id}`);
    expect(get.status).toBe(200);
    const session: any = await get.json();
    expect(session.id).toBe(id);
    expect(session.messages).toEqual([]);
  });

  test("lists sessions newest-updated first", async () => {
    const { app } = makeApp();
    const a = await post(app, "/api/sessions", { cwd: "/tmp/a" });
    await Bun.sleep(5);
    const b = await post(app, "/api/sessions", { cwd: "/tmp/b" });

    const list = await app.request("/api/sessions");
    expect(list.status).toBe(200);
    const sessions = (await list.json()) as any[];
    expect(sessions.map((s) => s.id)).toEqual([b.json.id, a.json.id]);
  });

  test("patch renames a session", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const renamed = await app.request(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Quarterly report" }),
    });
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as any).title).toBe("Quarterly report");
    expect(store.load(id)!.title).toBe("Quarterly report");
  });

  test("patch on unknown session returns 404", async () => {
    const { app } = makeApp();
    const res = await app.request(`/api/sessions/${randomUUID()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(404);
  });

  test("delete removes a session", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const res = await app.request(`/api/sessions/${id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ok).toBe(true);
    expect(store.load(id)).toBeNull();
  });

  test("delete on unknown session returns 404", async () => {
    const { app } = makeApp();
    const res = await app.request(`/api/sessions/${randomUUID()}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("runs a turn and returns the text", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const turn = await post(app, `/api/sessions/${id}/turn`, {
      message: "hi",
    });
    expect(turn.status).toBe(200);
    expect(turn.json.text).toBe("response to hi");
    expect(turnCalls).toEqual([{ sessionID: id, message: "hi" }]);
  });

  test("turns on one session are serialized", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const [a, b] = await Promise.all([
      post(app, `/api/sessions/${id}/turn`, { message: "a" }),
      post(app, `/api/sessions/${id}/turn`, { message: "b" }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(maxConcurrent).toBe(1);
    expect(turnCalls.map((t) => t.message).sort()).toEqual(["a", "b"]);
  });

  test("turn with a missing credential returns 401 auth-required with the provider", async () => {
    const { app } = createApp({
      store,
      draftManager,
      history,
      askChannel,
      shareStore: new ShareStore(store.db),
      shareMode: "disabled",
      createSession: makeSession,
      buildRuntime: () => fakeRuntime,
      runTurn: async () => {
        throw new AuthRequiredError(
          "anthropic",
          'Provider "anthropic": no credential.'
        );
      },
    });
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const turn = await post(app, `/api/sessions/${id}/turn`, {
      message: "hi",
    });
    expect(turn.status).toBe(401);
    expect(turn.json).toEqual({
      error: "auth-required",
      provider: "anthropic",
    });
  });

  test("accept copies the draft to the real file", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    await draftManager.resolve(realFile, id, true);
    writeFileSync(
      join(dir, "drafts", filePathHash(realFile), `${id}.docx`),
      "edited"
    );

    const result = await post(app, `/api/sessions/${id}/accept`, {
      filePath: realFile,
    });
    expect(result.status).toBe(200);
    expect(result.json.ok).toBe(true);
    expect(readFileSync(realFile, "utf-8")).toBe("edited");
    expect(history.list(filePathHash(realFile))).toHaveLength(1);
  });

  test("undo discards the draft, real file untouched", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    await draftManager.resolve(realFile, id, true);
    writeFileSync(
      join(dir, "drafts", filePathHash(realFile), `${id}.docx`),
      "edited"
    );

    const result = await post(app, `/api/sessions/${id}/undo`, {
      filePath: realFile,
    });
    expect(result.status).toBe(200);
    expect(readFileSync(realFile, "utf-8")).toBe("original");
    expect(
      (await import("node:fs")).existsSync(
        join(dir, "drafts", filePathHash(realFile), `${id}.docx`)
      )
    ).toBe(false);
  });

  test("revert creates a draft from a snapshot, accept writes it", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const point = await history.record(
      filePathHash(realFile),
      "old-session",
      new TextEncoder().encode("old state"),
      ".docx"
    );

    const revert = await post(app, `/api/sessions/${id}/revert`, {
      filePath: realFile,
      timestamp: point.timestamp,
    });
    expect(revert.status).toBe(200);
    expect(readFileSync(realFile, "utf-8")).toBe("original");

    const accept = await post(app, `/api/sessions/${id}/accept`, {
      filePath: realFile,
    });
    expect(accept.status).toBe(200);
    expect(readFileSync(realFile, "utf-8")).toBe("old state");
  });

  test("ask channel: question resolves from the answer route", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const { on } = await import("@openoffice/core");
    let promptID = "";
    const off = on("session:ask", (d) => {
      if (d.sessionID === id) promptID = d.promptID;
    });

    const promise = askChannel.ask(id, "accept or discard?");
    expect(promptID).not.toBe("");
    const answer = await post(app, `/api/sessions/${id}/ask-answer`, {
      promptID,
      answer: "discard",
    });
    expect(answer.status).toBe(200);
    expect(await promise).toBe("discard");
    off();
  });

  test("ask answer is scoped to its session", async () => {
    const { app } = makeApp();
    const first = await post(app, "/api/sessions", { cwd: "/tmp" });
    const second = await post(app, "/api/sessions", { cwd: "/tmp" });
    let promptID = "";
    const { on } = await import("@openoffice/core");
    const off = on("session:ask", (d) => {
      if (d.sessionID === first.json.id) promptID = d.promptID;
    });
    const promise = askChannel.ask(first.json.id, "continue?");
    expect(promptID).not.toBe("");

    const wrong = await post(
      app,
      `/api/sessions/${second.json.id}/ask-answer`,
      {
        promptID,
        answer: "discard",
      }
    );
    expect(wrong.status).toBe(404);
    expect(askChannel.answer(first.json.id, promptID, "discard")).toBe(true);
    expect(await promise).toBe("discard");
    off();
  });

  test("stream delivers llm tokens over SSE", async () => {
    const { app } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;

    const res = await app.request(`/api/sessions/${id}/stream`);
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const { emit } = await import("@openoffice/core");
    emit("llm:token", { sessionID: id, token: "Hello" });

    const { value } = (await Promise.race([
      reader.read(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), 2000)
      ),
    ])) as { value?: Uint8Array };
    expect(decoder.decode(value)).toContain("token");
    expect(decoder.decode(value)).toContain("Hello");
    reader.cancel();
  });

  test("/end ends only when the caller is the last attached client, once", async () => {
    const { app, attached } = makeApp();
    const created = await post(app, "/api/sessions", { cwd: "/tmp" });
    const id = created.json.id;
    const { on } = await import("@openoffice/core");
    let emits = 0;
    const off = on("session:end", (d) => {
      if (d.sessionID === id) emits++;
    });

    attached.attach(id);
    attached.attach(id);
    await post(app, `/api/sessions/${id}/end`);
    expect(store.load(id)!.endedAt).toBeUndefined();
    expect(emits).toBe(0);

    attached.detach(id);
    await post(app, `/api/sessions/${id}/end`);
    expect(store.load(id)!.endedAt).toBeDefined();
    expect(emits).toBe(1);

    // Second end is a no-op (idempotent against sweep/end races).
    await post(app, `/api/sessions/${id}/end`);
    expect(emits).toBe(1);
    off();
  });
});

describe("MCP routes", () => {
  const initial = {
    fs: { status: "connected" },
    off: { status: "disabled" },
    broken: { status: "error", error: "server is down" },
  } as const;

  function makeMcpApp(overrides: Record<string, any> = {}) {
    let state: Record<string, any> = { ...initial };
    const mcp = {
      status: () => state,
      enable: async (name: string) => {
        state = { ...state, [name]: { status: "connected" } };
        return state[name];
      },
      disable: async (name: string) => {
        state = { ...state, [name]: { status: "disabled" } };
        return state[name];
      },
    };
    return createApp({
      store,
      draftManager,
      history,
      askChannel,
      shareStore: new ShareStore(store.db),
      shareMode: "disabled",
      createSession: makeSession,
      buildRuntime: () => fakeRuntime,
      runTurn: fakeRunTurn,
      mcp,
      ...overrides,
    });
  }

  test("GET /api/mcp reports per-server status", async () => {
    const { app } = makeMcpApp();
    const res = await app.request("/api/mcp");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(initial);
  });

  test("POST enable connects a single server", async () => {
    const { app } = makeMcpApp();
    const res = await app.request("/api/mcp/broken/enable", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "connected" });
  });

  test("POST disable disconnects a single server", async () => {
    const { app } = makeMcpApp();
    const res = await app.request("/api/mcp/fs/disable", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "disabled" });
  });

  test("unknown server name is a 404", async () => {
    const { app } = makeMcpApp();
    for (const action of ["enable", "disable"]) {
      const res = await app.request(`/api/mcp/nope/${action}`, {
        method: "POST",
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toHaveProperty("error");
    }
  });

  test("routes require daemon auth", async () => {
    const { app } = makeMcpApp({
      auth: { username: "u", password: "secret" },
    });
    const res = await app.request("/api/mcp", {
      headers: { authorization: `Basic ${btoa("u:secret")}` },
    });
    expect(res.status).toBe(200);
    const unauthorized = await app.request("/api/mcp");
    expect(unauthorized.status).toBe(401);
  });
});
