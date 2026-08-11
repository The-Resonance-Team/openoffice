import type { EventMap } from '@openoffice/protocol';

export type BaseEvent = {
  type: string;
  properties: Record<string, unknown>;
};

type Mapped = { [K in keyof EventMap]: { type: K } & EventMap[K] }[keyof EventMap];

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

export function mapBaseEvent(event: BaseEvent): Mapped | null {
  const p = event.properties;
  switch (event.type) {
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
      return { type: 'todo:updated', sessionID: p.sessionID as string, todos: p.todos as never };
    case 'session.next.retried':
      return {
        type: 'llm:retry',
        sessionID: p.sessionID as string,
        attempt: p.attempt as number,
        message: (p.error as { message: string }).message,
        next: 0,
      };
    case 'session.deleted':
      return { type: 'session:end', sessionID: (p.info as { id: string }).id };
    default:
      return null;
  }
}
