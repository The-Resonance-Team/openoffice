import { cors } from "hono/cors";

/**
 * Browser clients (apps/web) talk to the daemon directly on 127.0.0.1, which
 * makes every request cross-origin. CORS is therefore opt-in and off by
 * default: any page in the user's browser can reach a loopback port, so a
 * permissive default would hand every site a way to drive the daemon.
 */
export function loadCorsOrigins(): string[] {
  const raw = process.env.OPENOFFICE_SERVER_CORS_ORIGIN ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0 && o !== "*");
}

export function createCorsMiddleware(origins: string[]) {
  return cors({
    origin: origins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 600,
  });
}
