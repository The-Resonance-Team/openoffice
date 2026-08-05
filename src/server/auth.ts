import type { Context, Next } from "hono";
import { basicAuth } from "hono/basic-auth";

export interface ServerAuthConfig {
  username: string;
  password: string | null;
}

export function loadAuthConfig(): ServerAuthConfig {
  const password = process.env.OPENOFFICE_SERVER_PASSWORD ?? null;
  const username = process.env.OPENOFFICE_SERVER_USERNAME ?? "openoffice";
  return { username, password };
}

export function authRequired(config: ServerAuthConfig): boolean {
  return config.password !== null && config.password !== "";
}

export function createAuthMiddleware(config: ServerAuthConfig) {
  if (!authRequired(config)) {
    return async (_c: Context, next: Next) => next();
  }
  const middleware = basicAuth({
    username: config.username,
    password: config.password!,
  });
  // basicAuth answers 400 to a malformed Authorization header (e.g. a Bearer
  // share token guessed against an API route). Normalize to 401 so every
  // invalid credential — absent, wrong, or malformed — reads the same way.
  return async (c: Context, next: Next) => {
    await middleware(c, next);
    if (c.res.status === 400) {
      c.res = new Response("Unauthorized", {
        status: 401,
        headers: c.res.headers,
      });
    }
  };
}

export function authHeaders(
  config: ServerAuthConfig
): Record<string, string> | undefined {
  if (!authRequired(config)) return undefined;
  const encoded = Buffer.from(`${config.username}:${config.password}`).toString(
    "base64"
  );
  return { Authorization: `Basic ${encoded}` };
}
