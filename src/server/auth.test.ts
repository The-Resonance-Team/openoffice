import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import {
  generateDaemonToken,
  writeDaemonToken,
  readDaemonToken,
  createAuthMiddleware,
} from "./auth";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-auth-"));
});

describe("generateDaemonToken", () => {
  test("returns a hex string of expected length", () => {
    const token = generateDaemonToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generates unique tokens", () => {
    const a = generateDaemonToken();
    const b = generateDaemonToken();
    expect(a).not.toBe(b);
  });
});

describe("writeDaemonToken / readDaemonToken", () => {
  test("writes and reads back the token", () => {
    const token = generateDaemonToken();
    writeDaemonToken(dir, token);
    expect(readDaemonToken(dir)).toBe(token);
  });

  test("returns null when file does not exist", () => {
    expect(readDaemonToken(dir)).toBeNull();
  });

  test("returns null on short/truncated file", () => {
    writeFileSync(join(dir, "daemon.token"), "abc");
    expect(readDaemonToken(dir)).toBeNull();
  });

  test("token file has 0600 permissions", () => {
    const token = generateDaemonToken();
    writeDaemonToken(dir, token);
    const { mode } = require("node:fs").statSync(join(dir, "daemon.token"));
    // 0600 = 0o600 = 384 decimal
    expect(mode & 0o777).toBe(0o600);
  });
});

describe("createAuthMiddleware", () => {
  test("allows requests with valid bearer token", async () => {
    const app = new Hono();
    const token = generateDaemonToken();
    app.use("*", createAuthMiddleware(token));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("rejects requests without authorization header", async () => {
    const app = new Hono();
    const token = generateDaemonToken();
    app.use("*", createAuthMiddleware(token));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  test("rejects requests with wrong token", async () => {
    const app = new Hono();
    const token = generateDaemonToken();
    app.use("*", createAuthMiddleware(token));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: "Bearer wrong-token-here" },
    });
    expect(res.status).toBe(401);
  });

  test("rejects non-bearer authorization schemes", async () => {
    const app = new Hono();
    const token = generateDaemonToken();
    app.use("*", createAuthMiddleware(token));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: `Basic ${token}` },
    });
    expect(res.status).toBe(401);
  });
});
