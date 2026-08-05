import type { Context, Next } from "hono";

export interface ServerAuthConfig {
  username: string;
  password: string | null;
}

export function loadAuthConfig(): ServerAuthConfig {
  const password = process.env.OPENCODE_SERVER_PASSWORD ?? null;
  const username = process.env.OPENCODE_SERVER_USERNAME ?? "openoffice";
  return { username, password };
}

export function authRequired(config: ServerAuthConfig): boolean {
  return config.password !== null && config.password !== "";
}

function decodeBasicAuth(header: string): {
  username: string;
  password: string;
} | null {
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf-8");
  const sep = decoded.indexOf(":");
  if (sep === -1) return null;
  return {
    username: decoded.slice(0, sep),
    password: decoded.slice(sep + 1),
  };
}

export function createAuthMiddleware(config: ServerAuthConfig) {
  if (!authRequired(config)) {
    return async (_c: Context, next: Next) => next();
  }
  return async (c: Context, next: Next) => {
    const auth = c.req.header("authorization");
    const cred = auth ? decodeBasicAuth(auth) : null;
    if (
      !cred ||
      cred.username !== config.username ||
      cred.password !== config.password
    ) {
      c.header("www-authenticate", 'Basic realm="Secure Area"');
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
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
