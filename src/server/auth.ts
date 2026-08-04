import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Context, Next } from "hono";

export function generateDaemonToken(): string {
  return randomBytes(32).toString("hex");
}

function tokenPath(dataDir: string): string {
  return join(dataDir, "daemon.token");
}

export function writeDaemonToken(dataDir: string, token: string): void {
  writeFileSync(tokenPath(dataDir), token, { mode: 0o600 });
}

export function readDaemonToken(dataDir: string): string | null {
  const path = tokenPath(dataDir);
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, "utf-8").trim();
    if (!content || content.length < 8) return null;
    return content;
  } catch {
    return null;
  }
}

export function createAuthMiddleware(validToken: string) {
  return async (c: Context, next: Next) => {
    const auth = c.req.header("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const token = auth.slice("Bearer ".length);
    if (token !== validToken) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
