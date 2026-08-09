import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import {
  loadAuthConfig,
  authRequired,
  createAuthMiddleware,
  authHeaders,
} from "./auth";

function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

describe("loadAuthConfig", () => {
  test("returns default username and null password when env not set", () => {
    delete process.env.OPENOFFICE_SERVER_PASSWORD;
    delete process.env.OPENOFFICE_SERVER_USERNAME;
    const config = loadAuthConfig();
    expect(config.username).toBe("openoffice");
    expect(config.password).toBeNull();
  });

  test("reads OPENOFFICE_SERVER_PASSWORD from env", () => {
    process.env.OPENOFFICE_SERVER_PASSWORD = "secret123";
    const config = loadAuthConfig();
    expect(config.password).toBe("secret123");
    delete process.env.OPENOFFICE_SERVER_PASSWORD;
  });

  test("reads OPENOFFICE_SERVER_USERNAME from env", () => {
    process.env.OPENOFFICE_SERVER_USERNAME = "custom";
    process.env.OPENOFFICE_SERVER_PASSWORD = "pass";
    const config = loadAuthConfig();
    expect(config.username).toBe("custom");
    delete process.env.OPENOFFICE_SERVER_USERNAME;
    delete process.env.OPENOFFICE_SERVER_PASSWORD;
  });
});

describe("authRequired", () => {
  test("false when password is null", () => {
    expect(authRequired({ username: "u", password: null })).toBe(false);
  });

  test("false when password is empty", () => {
    expect(authRequired({ username: "u", password: "" })).toBe(false);
  });

  test("true when password is set", () => {
    expect(authRequired({ username: "u", password: "pass" })).toBe(true);
  });
});

describe("createAuthMiddleware", () => {
  test("allows all requests when no password configured", async () => {
    const app = new Hono();
    app.use("*", createAuthMiddleware({ username: "u", password: null }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  test("allows requests with valid credentials", async () => {
    const app = new Hono();
    app.use(
      "*",
      createAuthMiddleware({ username: "admin", password: "secret" })
    );
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: basicAuth("admin", "secret") },
    });
    expect(res.status).toBe(200);
  });

  test("rejects requests without authorization header", async () => {
    const app = new Hono();
    app.use(
      "*",
      createAuthMiddleware({ username: "admin", password: "secret" })
    );
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      'Basic realm="Secure Area"'
    );
  });

  test("rejects requests with wrong password", async () => {
    const app = new Hono();
    app.use(
      "*",
      createAuthMiddleware({ username: "admin", password: "secret" })
    );
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Authorization: basicAuth("admin", "wrong") },
    });
    expect(res.status).toBe(401);
  });

  test("preserves a genuine route 400 under valid auth", async () => {
    const app = new Hono();
    app.use(
      "*",
      createAuthMiddleware({ username: "admin", password: "secret" })
    );
    app.post("/test", (c) => c.json({ error: "bad request" }, 400));

    const res = await app.request("/test", {
      method: "POST",
      headers: { Authorization: basicAuth("admin", "secret") },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad request" });
  });
});

describe("authHeaders", () => {
  test("returns undefined when no password configured", () => {
    expect(authHeaders({ username: "u", password: null })).toBeUndefined();
  });

  test("returns Basic auth header when password configured", () => {
    const headers = authHeaders({ username: "admin", password: "secret" });
    expect(headers).toEqual({ Authorization: basicAuth("admin", "secret") });
  });
});
