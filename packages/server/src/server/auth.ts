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
  return basicAuth({ username: config.username, password: config.password! });
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
