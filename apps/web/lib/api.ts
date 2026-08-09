// Own DTOs against the daemon's HTTP surface — no shared types package with
// apps/cli (see docs/adr/0024-turborepo-monorepo-for-cli-plus-web.md). Drift
// between these shapes and the daemon's is an accepted cost of that split.

import { api, authHeader } from './client';

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
  | { type: 'token'; token: string }
  | { type: 'done'; response: unknown }
  | { type: 'toolStart'; tool: string; params: unknown }
  | { type: 'toolDone'; tool: string; result: unknown }
  | { type: 'message'; role: string; content: unknown }
  | { type: 'ask'; promptID: string; question: string };

export function createSession(cwd?: string): Promise<SessionDto> {
  return api.post<SessionDto>('/api/sessions', { cwd }).then((r) => r.data);
}

export function getSession(id: string): Promise<SessionDto> {
  return api.get<SessionDto>(`/api/sessions/${id}`).then((r) => r.data);
}

export function listSessions(): Promise<SessionDto[]> {
  return api.get<SessionDto[]>('/api/sessions').then((r) => r.data);
}

export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/api/sessions/${id}`).then((r) => r.data);
}

export function renameSession(id: string, title: string): Promise<SessionDto> {
  return api.patch<SessionDto>(`/api/sessions/${id}`, { title }).then((r) => r.data);
}

export function postTurn(id: string, message: string): Promise<TurnResponse> {
  return api.post<TurnResponse>(`/api/sessions/${id}/turn`, { message }).then((r) => r.data);
}

export function acceptFile(id: string, filePath: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/api/sessions/${id}/accept`, { filePath }).then((r) => r.data);
}

export function undoFile(id: string, filePath: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/api/sessions/${id}/undo`, { filePath }).then((r) => r.data);
}

export function getUpdateStatus(): Promise<UpdateStatus> {
  return api.get<UpdateStatus>('/api/update').then((r) => r.data);
}

/**
 * SSE stream stays on fetch: axios in the browser is XHR-based with no
 * streaming-reader API, EventSource cannot set an Authorization header, and
 * the daemon may require Basic auth — so the stream is read by hand.
 */
export async function streamSession(
  id: string,
  onEvent: (ev: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const auth = authHeader();
  const res = await fetch(`${api.defaults.baseURL}/api/sessions/${id}/stream`, {
    headers: auth ? { Authorization: auth } : {},
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`GET /api/sessions/${id}/stream → ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';
    for (const chunk of lines) {
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice(5).trim()) as StreamEvent);
      } catch {
        // malformed frame, skip
      }
    }
  }
}
