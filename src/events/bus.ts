export type EventMap = {
  "llm:token": { sessionID: string; token: string };
  "llm:done": { sessionID: string; response: string };
  "tool:start": { sessionID: string; tool: string; params: unknown };
  "tool:done": { sessionID: string; tool: string; result: unknown };
  "session:create": { sessionID: string };
  "session:message": { sessionID: string; role: string; content: string };
  "session:end": { sessionID: string };
};

type Listeners = { [K in keyof EventMap]: Set<(data: EventMap[K]) => void> };

const listeners: Listeners = {
  "llm:token": new Set(),
  "llm:done": new Set(),
  "tool:start": new Set(),
  "tool:done": new Set(),
  "session:create": new Set(),
  "session:message": new Set(),
  "session:end": new Set(),
};

export function on<K extends keyof EventMap>(
  event: K,
  handler: (data: EventMap[K]) => void
): () => void {
  listeners[event].add(handler);
  return () => {
    listeners[event].delete(handler);
  };
}

export function emit<K extends keyof EventMap>(
  event: K,
  data: EventMap[K]
): void {
  for (const handler of listeners[event]) handler(data);
}
