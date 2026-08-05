import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp, AskChannel } from "../index";
import { createAuthMiddleware } from "../auth";
import { SessionStore, type Session } from "../../session";
import { DraftManager } from "../../draft";
import { HistoryStore } from "../../history";
import { ShareStore } from "../../share";
import type { SessionRuntime } from "../index";
import type { ShareMode } from "../../config";

let dir: string;
let store: SessionStore;
let shareStore: ShareStore;
let draftManager: DraftManager;
let history: HistoryStore;
let askChannel: AskChannel;

const fakeRuntime: SessionRuntime = { tools: {} as any, system: "" };

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

function makeApp(shareMode: ShareMode = "auto", auth = false) {
  return createApp({
    store,
    draftManager,
    history,
    askChannel,
    shareStore,
    shareMode,
    authMiddleware: auth
      ? createAuthMiddleware({ username: "openoffice", password: "secret" })
      : undefined,
    createSession: makeSession,
    buildRuntime: () => fakeRuntime,
    runTurn: async () => ({ text: "ok" }),
  });
}

async function post(
  app: any,
  path: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const res = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", host: "127.0.0.1:1234" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function createSession(app: any): Promise<string> {
  const res = await post(app, "/api/sessions", { cwd: "/tmp" });
  return res.json.id;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-share-"));
  mkdirSync(dir, { recursive: true });
  store = new SessionStore(join(dir, "test.db"));
  shareStore = new ShareStore(store.db);
  history = new HistoryStore(dir);
  draftManager = new DraftManager({
    dataDir: dir,
    history,
    execOfficeCli: async () => ({ stdout: "", exitCode: 0 }),
  });
  askChannel = new AskChannel();
});

describe("session share routes", () => {
  test("share returns a URL with an unguessable token and persists it", async () => {
    const { app } = makeApp();
    const id = await createSession(app);

    const res = await post(app, `/api/sessions/${id}/share`);
    expect(res.status).toBe(200);
    expect(res.json.url).toMatch(
      /^http:\/\/127\.0\.0\.1:1234\/share\/[0-9a-f]{64}$/
    );
    expect(shareStore.findByToken(res.json.url.split("/share/")[1])).toBe(id);
  });

  test("share errors when sharing is disabled", async () => {
    const { app } = makeApp("disabled");
    const id = await createSession(app);

    const res = await post(app, `/api/sessions/${id}/share`);
    expect(res.status).toBe(403);
  });

  test("re-sharing replaces the URL (old token 410s)", async () => {
    const { app } = makeApp();
    const id = await createSession(app);

    const first = await post(app, `/api/sessions/${id}/share`);
    const second = await post(app, `/api/sessions/${id}/share`);
    expect(second.json.url).not.toBe(first.json.url);

    const oldToken = first.json.url.split("/share/")[1];
    const gone = await app.request(`/share/${oldToken}`);
    expect(gone.status).toBe(410);
  });

  test("unshare revokes the token; subsequent view is 410", async () => {
    const { app } = makeApp();
    const id = await createSession(app);

    const shared = await post(app, `/api/sessions/${id}/share`);
    const token = shared.json.url.split("/share/")[1];

    const unshared = await post(app, `/api/sessions/${id}/unshare`);
    expect(unshared.status).toBe(200);

    const gone = await app.request(`/share/${token}`);
    expect(gone.status).toBe(410);
  });

  test("unshare is idempotent", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    const res = await post(app, `/api/sessions/${id}/unshare`);
    expect(res.status).toBe(200);
  });

  test("unknown token is 410 (unknown ≡ revoked)", async () => {
    const { app } = makeApp();
    const res = await app.request(
      "/share/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(res.status).toBe(410);
  });

  test("unknown session share/unshare is 404", async () => {
    const { app } = makeApp();
    const res = await post(app, `/api/sessions/nope/share`);
    expect(res.status).toBe(404);
    const un = await post(app, `/api/sessions/nope/unshare`);
    expect(un.status).toBe(404);
  });

  test("GET /api/sessions/:id surfaces the share URL when shared", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    const shared = await post(app, `/api/sessions/${id}/share`);

    const res = await app.request(`/api/sessions/${id}`, {
      headers: { host: "127.0.0.1:1234" },
    });
    expect(res.status).toBe(200);
    const session: any = await res.json();
    expect(session.share).toEqual({ url: shared.json.url });
  });

  test("GET /api/sessions/:id shows share null when not shared", async () => {
    const { app } = makeApp("disabled");
    const id = await createSession(app);

    const res = await app.request(`/api/sessions/${id}`, {
      headers: { host: "127.0.0.1:1234" },
    });
    const session: any = await res.json();
    expect(session.share).toBeNull();
  });

  test("ending a session revokes its share", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    const shared = await post(app, `/api/sessions/${id}/share`);
    const token = shared.json.url.split("/share/")[1];

    const ended = await post(app, `/api/sessions/${id}/end`);
    expect(ended.status).toBe(200);

    const gone = await app.request(`/share/${token}`);
    expect(gone.status).toBe(410);
  });

  test("sharing an ended session errors", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    await post(app, `/api/sessions/${id}/end`);

    const res = await post(app, `/api/sessions/${id}/share`);
    expect(res.status).toBe(409);
  });

  test("auto mode shares every session on creation", async () => {
    const { app } = makeApp("auto");
    const id = await createSession(app);
    expect(shareStore.get(id)).toBeTruthy();
  });

  test("share viewer serves a read-only HTML page", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    const shared = await post(app, `/api/sessions/${id}/share`);
    const token = shared.json.url.split("/share/")[1];

    const res = await app.request(`/share/${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Read-only");
    expect(html).toContain('location.pathname + "/stream"');
  });

  test("share stream replays the transcript as message events", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    const shared = await post(app, `/api/sessions/${id}/share`);
    const token = shared.json.url.split("/share/")[1];

    const now = Date.now();
    store.updateMessage(id, { id: "m1", role: "user", time: { created: now } });
    store.updatePart(id, "m1", {
      id: "p1",
      messageID: "m1",
      type: "text",
      text: "hello?",
    });
    store.updateMessage(id, {
      id: "m2",
      role: "assistant",
      time: { created: now },
    });
    store.updatePart(id, "m2", {
      id: "p2",
      messageID: "m2",
      type: "text",
      text: "world!",
    });

    const res = await app.request(`/share/${token}/stream`);
    expect(res.status).toBe(200);
    const data = await readSSE(res, 2);
    expect(data).toContain("hello?");
    expect(data).toContain("world!");
    expect(data).not.toContain("toolStart");
  });

  test("share stream delivers live message and ask events", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    const shared = await post(app, `/api/sessions/${id}/share`);
    const token = shared.json.url.split("/share/")[1];

    const res = await app.request(`/share/${token}/stream`);
    expect(res.status).toBe(200);
    const { emit } = await import("../../events");
    emit("session:message", { sessionID: id, role: "user", content: "hi" });
    emit("llm:done", { sessionID: id, response: "yo" });
    emit("session:ask", {
      sessionID: id,
      promptID: "p1",
      question: "proceed?",
    });

    const data = await readSSE(res, 3);
    expect(data).toContain("hi");
    expect(data).toContain("yo");
    expect(data).toContain("proceed?");
  });

  test("share stream stops delivering after revoke", async () => {
    const { app } = makeApp();
    const id = await createSession(app);
    const shared = await post(app, `/api/sessions/${id}/share`);
    const token = shared.json.url.split("/share/")[1];

    const res = await app.request(`/share/${token}/stream`);
    const reader = res.body!.getReader();
    const { emit } = await import("../../events");
    emit("session:message", { sessionID: id, role: "user", content: "before" });
    const first = (await Promise.race([
      reader.read(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), 2000)
      ),
    ])) as { value?: Uint8Array };
    expect(new TextDecoder().decode(first.value)).toContain("before");

    await post(app, `/api/sessions/${id}/unshare`);
    emit("session:message", { sessionID: id, role: "user", content: "after" });

    const silent = await Promise.race([
      reader.read().then(() => "data"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
    ]);
    expect(silent).toBe("timeout");
    reader.cancel();
  });

  test("share stream rejects unknown tokens with 410", async () => {
    const { app } = makeApp();
    const res = await app.request(
      "/share/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/stream"
    );
    expect(res.status).toBe(410);
  });

  test("write routes reject a share token even when guessed", async () => {
    const { app } = makeApp("auto", true);
    const session = makeSession("/tmp");
    store.save(session);
    const token = shareStore.create(session.id);

    const withShareToken = await app.request(
      `/api/sessions/${session.id}/accept`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }
    );
    // A share token can never be a valid Basic credential — rejected with
    // 401 (malformed auth normalized by createAuthMiddleware) before the
    // route logic is ever reached.
    expect(withShareToken.status).toBe(401);

    const bare = await app.request(`/api/sessions/${session.id}/accept`, {
      method: "POST",
    });
    expect(bare.status).toBe(401);

    const view = await app.request(`/share/${token}`);
    expect(view.status).toBe(200);
  });
});

async function readSSE(res: Response, chunks: number): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let data = "";
  for (let i = 0; i < chunks; i++) {
    const { value } = (await Promise.race([
      reader.read(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), 2000)
      ),
    ])) as { value?: Uint8Array };
    data += decoder.decode(value);
  }
  reader.cancel();
  return data;
}
