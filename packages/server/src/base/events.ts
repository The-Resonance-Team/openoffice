import type { EventMap } from '@openoffice/protocol';

export type BaseEvent = {
  type: string;
  properties: Record<string, unknown>;
};

type Mapped = { [K in keyof EventMap]: { type: K } & EventMap[K] }[keyof EventMap];

// Internal control signal (not on the wire EventMap): the base's turn-end
// marker, used by the bridge to emit one llm:done per turn and by the turn
// route to know when a promptAsync has finished.
export type BaseStatusEvent = {
  type: 'session:status';
  sessionID: string;
  status: 'idle' | 'busy' | 'retry';
  attempt?: number;
  message?: string;
  next?: number;
};

// The fork's live event vocabulary (verified against the compiled base):
// `message.part.updated` carries part snapshots (text parts carry their full
// text; tool parts carry their call/result), and `session.status` marks turn
// busy/idle. The `session.next.*` events exist in the schema for replay but
// are not emitted live. Both are mapped so the daemon works against either.
export function mapBaseEvent(event: BaseEvent): Mapped | BaseStatusEvent | null {
  const p = event.properties;
  switch (event.type) {
    case 'session.status': {
      const status = p.status as {
        type: string;
        attempt?: number;
        message?: string;
        next?: number;
      };
      if (status.type === 'idle') {
        return { type: 'session:status', sessionID: p.sessionID as string, status: 'idle' };
      }
      if (status.type === 'retry') {
        return {
          type: 'session:status',
          sessionID: p.sessionID as string,
          status: 'retry',
          attempt: status.attempt,
          message: status.message,
          next: status.next,
        };
      }
      return null;
    }
    case 'message.part.updated': {
      const part = p.part as {
        type?: string;
        text?: string;
        tool?: string;
        name?: string;
        state?: unknown;
        sessionID?: string;
        messageID?: string;
      };
      const sessionID = (p.sessionID as string) ?? (part.sessionID as string) ?? '';
      if (part.type === 'text' && typeof part.text === 'string') {
        // Full text per update (not deltas); the bridge accumulates and
        // emits one llm:done at idle.
        return { type: 'llm:token', sessionID, token: part.text };
      }
      if (part.type === 'tool') {
        const tool = part.tool ?? part.name ?? 'tool';
        const state = part.state as
          | { status: 'pending' | 'running'; input?: Record<string, unknown> }
          | { status: 'completed'; input?: Record<string, unknown>; output?: string }
          | { status: 'error'; input?: Record<string, unknown>; error?: string };
        if (state?.status === 'completed') {
          return {
            type: 'tool:done',
            sessionID,
            tool,
            result: { success: true, output: state.output ?? '' },
          };
        }
        if (state?.status === 'error') {
          return {
            type: 'tool:done',
            sessionID,
            tool,
            result: { success: false, error: state.error ?? 'tool failed' },
          };
        }
        // pending/running → start (one start per tool call; repeats are
        // harmless — clients render the latest params).
        return { type: 'tool:start', sessionID, tool, params: state?.input };
      }
      return null;
    }
    // ---- legacy/replay vocabulary (older forks) ----
    case 'session.next.text.delta':
      return { type: 'llm:token', sessionID: p.sessionID as string, token: p.delta as string };
    case 'session.next.text.ended':
      return { type: 'llm:done', sessionID: p.sessionID as string, response: p.text as string };
    case 'session.next.tool.called':
      return {
        type: 'tool:start',
        sessionID: p.sessionID as string,
        tool: p.tool as string,
        params: p.input,
      };
    case 'session.next.tool.success':
      return {
        type: 'tool:done',
        sessionID: p.sessionID as string,
        tool: p.tool as string,
        result: { success: true, output: text((p.content as unknown[]) ?? []) },
      };
    case 'session.next.tool.failed':
      return {
        type: 'tool:done',
        sessionID: p.sessionID as string,
        tool: p.tool as string,
        result: { success: false, error: (p.error as { message: string }).message },
      };
    case 'session.next.prompt.admitted':
      return {
        type: 'session:message',
        sessionID: p.sessionID as string,
        role: 'user',
        content: (p.prompt as { text: string }).text,
      };
    case 'permission.v2.asked':
      return {
        type: 'session:ask',
        sessionID: p.sessionID as string,
        promptID: p.id as string,
        question: `${p.action as string} ${(p.resources as string[]).join(' ')}`,
      };
    case 'todo.updated':
      return {
        type: 'todo:updated',
        sessionID: p.sessionID as string,
        todos: p.todos as {
          content: string;
          status: string;
          priority: string;
        }[] as EventMap['todo:updated']['todos'],
      };
    case 'session.next.retried':
      return {
        type: 'llm:retry',
        sessionID: p.sessionID as string,
        attempt: p.attempt as number,
        message: (p.error as { message: string }).message,
        // The retry delay is not published on this event; the wire protocol
        // requires the field, so 0 (immediate) — clients reconnect on their
        // own cadence regardless.
        next: 0,
      };
    case 'session.deleted':
      return { type: 'session:end', sessionID: (p.info as { id: string }).id };
    default:
      return null;
  }
}

const text = (parts: unknown[]): string =>
  parts
    .filter(
      (p): p is { type: 'text'; text: string } =>
        typeof p === 'object' &&
        p !== null &&
        (p as { type?: unknown }).type === 'text' &&
        typeof (p as { text?: unknown }).text === 'string',
    )
    .map((p) => p.text)
    .join('');
