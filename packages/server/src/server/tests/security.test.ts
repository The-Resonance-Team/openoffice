import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp, AskChannel, type SessionRuntime } from "../index";
import {
  SessionStore,
  DraftManager,
  HistoryStore,
  ShareStore,
  type Session,
} from "@openoffice/core";

let store: SessionStore;
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

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "openoffice-security-test-"));
  mkdirSync(dir, { recursive: true });
  store = new SessionStore(join(dir, "test.db"));
  history = new HistoryStore(dir);
  draftManager = new DraftManager({
    dataDir: dir,
    history,
    execOfficeCli: async () => ({ stdout: "", exitCode: 0 }),
  });
  askChannel = new AskChannel();
});

function makeApp(opts: {
  auth?: { username: string; password: string | null };
  corsOrigins?: string[];
}) {
  return createApp({
    store,
    draftManager,
    history,
    askChannel,
    shareStore: new ShareStore(store.db),
    shareMode: "disabled",
    createSession: makeSession,
    buildRuntime: () => fakeRuntime,
    runTurn: async () => ({ text: "ok" }),
    ...opts,
  }).app;
}

describe("auth wiring", () => {
  // createApp used to receive the auth middleware from the daemon after all
  // routes were already registered, which made it a no-op in production
  // (Hono routes are terminal). This pins the fix: auth must be a createApp
  // input, applied before any route.
  test("route requires credentials when auth is configured", async () => {
    const app = makeApp({ auth: { username: "u", password: "secret" } });
    const res = await app.request("/api/sessions", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("route is reachable with correct credentials", async () => {
    const app = makeApp({ auth: { username: "u", password: "secret" } });
    const auth = `Basic ${Buffer.from("u:secret").toString("base64")}`;
    const res = await app.request("/api/sessions", {
      method: "POST",
      headers: { Authorization: auth, "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(201);
  });

  test("no auth block when auth is omitted", async () => {
    const app = makeApp({});
    const res = await app.request("/api/sessions", { method: "POST" });
    expect(res.status).toBe(201);
  });
});

describe("cors wiring", () => {
  test("no CORS headers when corsOrigins is omitted", async () => {
    const app = makeApp({});
    const res = await app.request("/api/sessions", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("allowed origin gets reflected", async () => {
    const app = makeApp({ corsOrigins: ["http://localhost:3000"] });
    const res = await app.request("/api/sessions", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    );
  });

  test("disallowed origin is not reflected", async () => {
    const app = makeApp({ corsOrigins: ["http://localhost:3000"] });
    const res = await app.request("/api/sessions", {
      method: "OPTIONS",
      headers: {
        Origin: "http://evil.example",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
