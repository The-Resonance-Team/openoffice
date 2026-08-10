import type { StoredAuth, StreamEvent } from './api-types';

const AUTH_KEY = 'oo-auth';

export function loadAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth | null) {
  if (typeof window === 'undefined') return;
  if (!auth) {
    window.sessionStorage.removeItem(AUTH_KEY);
    return;
  }
  window.sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export async function parseSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (ev: StreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
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
