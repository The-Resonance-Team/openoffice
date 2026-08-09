import { getTransport } from "./transport";
import type {
  SessionDto,
  TurnResponse,
  UpdateStatus,
  StreamEvent,
} from "./api-types";
import { parseSseStream } from "./api-helpers";

export type {
  SessionDto,
  TurnResponse,
  UpdateStatus,
  StreamEvent,
} from "./api-types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const t = getTransport();
  const base = await t.base();
  const headers = await t.authHeaders();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
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

export async function streamSession(
  id: string,
  onEvent: (ev: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const t = getTransport();
  const base = await t.base();
  const headers = await t.authHeaders();
  const res = await fetch(`${base}/api/sessions/${id}/stream`, {
    headers,
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`GET /api/sessions/${id}/stream → ${res.status}`);
  }
  await parseSseStream(res.body, onEvent);
}
