// Own DTOs against the daemon's HTTP surface — no shared types package with
// apps/cli (see docs/adr/0024-turborepo-monorepo-for-cli-plus-web.md). Drift
// between these shapes and the daemon's is an accepted cost of that split.

export interface SessionDto {
  id: string;
  agent: string;
  model: string;
  title: string;
  cwd: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
}

export interface TurnResponse {
  text: string;
}

export interface UpdateStatus {
  check: boolean;
  available: boolean;
  version?: string;
  error?: string;
}

export type StreamEvent =
  | { type: "token"; token: string }
  | { type: "done"; response: unknown }
  | { type: "toolStart"; tool: string; params: unknown }
  | { type: "toolDone"; tool: string; result: unknown }
  | { type: "message"; role: string; content: unknown }
  | { type: "ask"; promptID: string; question: string };

const AUTH_KEY = "oo-auth";

export interface StoredAuth {
  username: string;
  password: string;
}

export function loadAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth | null) {
  if (typeof window === "undefined") return;
  if (!auth) {
    window.sessionStorage.removeItem(AUTH_KEY);
    return;
  }
  // Never localStorage: a Basic-auth password must not outlive the tab.
  window.sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createSession(cwd?: string): Promise<SessionDto> {
  return request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ cwd }),
  });
}

export function getSession(id: string): Promise<SessionDto> {
  return request(`/api/sessions/${id}`);
}

export function listSessions(): Promise<SessionDto[]> {
  return request("/api/sessions");
}

export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return request(`/api/sessions/${id}`, { method: "DELETE" });
}

export function renameSession(id: string, title: string): Promise<SessionDto> {
  return request(`/api/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function postTurn(id: string, message: string): Promise<TurnResponse> {
  return request(`/api/sessions/${id}/turn`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function acceptFile(
  id: string,
  filePath: string
): Promise<{ ok: boolean }> {
  return request(`/api/sessions/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({ filePath }),
  });
}

export function undoFile(
  id: string,
  filePath: string
): Promise<{ ok: boolean }> {
  return request(`/api/sessions/${id}/undo`, {
    method: "POST",
    body: JSON.stringify({ filePath }),
  });
}

export function getUpdateStatus(): Promise<UpdateStatus> {
  return request("/api/update");
}

/**
 * EventSource has no way to set an Authorization header, and the daemon may
 * require Basic auth, so the SSE stream is read by hand over fetch instead.
 */
export async function streamSession(
  id: string,
  onEvent: (ev: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/sessions/${id}/stream`, {
    headers: { ...authHeaders() },
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`GET /api/sessions/${id}/stream → ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const chunk of lines) {
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice(5).trim()) as StreamEvent);
      } catch {
        // malformed frame, skip
      }
    }
  }
}
