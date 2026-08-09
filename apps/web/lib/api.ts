import { setTransport, loadAuth } from "@openoffice/ui";

function apiBase(): string {
  const port = process.env.NEXT_PUBLIC_OPENOFFICE_SERVER_PORT;
  if (!port) {
    throw new Error(
      "NEXT_PUBLIC_OPENOFFICE_SERVER_PORT is not set — the web client needs the daemon's port"
    );
  }
  return `http://127.0.0.1:${port}`;
}

function authHeaders(): HeadersInit {
  const auth = loadAuth();
  if (!auth) return {};
  const token = btoa(`${auth.username}:${auth.password}`);
  return { Authorization: `Basic ${token}` };
}

setTransport({ base: apiBase, authHeaders });

export * from "@openoffice/ui";
