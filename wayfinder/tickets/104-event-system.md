# Event System

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Session Management](107-session-management.md)
**Blocked by**: [Config System](103-config-system.md)
**Assignee**: _(unclaimed)_

## Question

Implement a simple event bus for decoupled communication between systems.

### Why needed

- LLM streaming events (token-by-token output)
- Tool execution events (start, progress, complete)
- Session events (create, message, end)
- UI updates (refresh on new data)

### Implementation

Simple typed event emitter — no framework needed:

```ts
type Events = {
  'llm:token': { sessionID: string; token: string };
  'llm:done': { sessionID: string; response: Message };
  'tool:start': { sessionID: string; tool: string; params: unknown };
  'tool:done': { sessionID: string; tool: string; result: unknown };
  'session:create': { sessionID: string };
  'session:message': { sessionID: string; message: Message };
  'session:end': { sessionID: string };
};

class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof Events>(event: K, fn: (data: Events[K]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

export const events = new EventBus();
```

### What NOT to build

- No WebSocket server (that's for the desktop app, not core)
- No event persistence (in-memory is fine for v1)
- No pub/sub hierarchy (flat events are simpler)

### Reference

- opencode event system: `packages/core/src/event.ts`, `packages/opencode/src/bus/`
- opencode uses Effect's pub/sub — overkill for v1
