// The daemon event bus contract — event names and payloads streamed over SSE
// to clients. The bus implementation (with redaction) lives in core; clients
// compile against this surface.

export type EventMap = {
  "llm:token": { sessionID: string; token: string };
  "llm:done": { sessionID: string; response: string };
  "llm:retry": {
    sessionID: string;
    attempt: number;
    message: string;
    next: number;
  };
  "tool:start": { sessionID: string; tool: string; params: unknown };
  "tool:done": { sessionID: string; tool: string; result: unknown };
  "session:create": { sessionID: string };
  "session:message": { sessionID: string; role: string; content: string };
  "session:compacted": { sessionID: string };
  "session:ask": { sessionID: string; promptID: string; question: string };
  "session:end": { sessionID: string };
};
