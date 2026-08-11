import { describe, expect, test } from 'bun:test';
import { mapBaseEvent } from '../events';

describe('mapBaseEvent', () => {
  test('message.part.updated text maps to llm:token (live vocabulary)', () => {
    expect(
      mapBaseEvent({
        type: 'message.part.updated',
        properties: {
          sessionID: 'sess_1',
          part: { type: 'text', text: 'Hello', messageID: 'msg_1', id: 'prt_1' },
        },
      }),
    ).toEqual({ type: 'llm:token', sessionID: 'sess_1', token: 'Hello' });
  });

  test('session.status idle maps to the internal status signal', () => {
    expect(
      mapBaseEvent({
        type: 'session.status',
        properties: { sessionID: 'sess_1', status: { type: 'idle' } },
      }),
    ).toEqual({ type: 'session:status', sessionID: 'sess_1', status: 'idle' });
  });

  test('session.status busy maps to null', () => {
    expect(
      mapBaseEvent({
        type: 'session.status',
        properties: { sessionID: 'sess_1', status: { type: 'busy' } },
      }),
    ).toBeNull();
  });

  test('message.part.updated tool running maps to tool:start', () => {
    expect(
      mapBaseEvent({
        type: 'message.part.updated',
        properties: {
          sessionID: 'sess_1',
          part: {
            type: 'tool',
            tool: 'officecli',
            callID: 'call_1',
            state: { status: 'running', input: { verb: 'set' } },
            messageID: 'msg_1',
          },
        },
      }),
    ).toEqual({
      type: 'tool:start',
      sessionID: 'sess_1',
      tool: 'officecli',
      params: { verb: 'set' },
    });
  });

  test('message.part.updated tool completed maps to tool:done', () => {
    expect(
      mapBaseEvent({
        type: 'message.part.updated',
        properties: {
          sessionID: 'sess_1',
          part: {
            type: 'tool',
            tool: 'officecli',
            callID: 'call_1',
            state: { status: 'completed', output: 'ok', input: {} },
            messageID: 'msg_1',
          },
        },
      }),
    ).toEqual({
      type: 'tool:done',
      sessionID: 'sess_1',
      tool: 'officecli',
      result: { success: true, output: 'ok' },
    });
  });

  test('message.part.updated tool error maps to tool:done error', () => {
    expect(
      mapBaseEvent({
        type: 'message.part.updated',
        properties: {
          sessionID: 'sess_1',
          part: {
            type: 'tool',
            tool: 'officecli',
            callID: 'call_1',
            state: { status: 'error', error: 'boom', input: {} },
            messageID: 'msg_1',
          },
        },
      }),
    ).toEqual({
      type: 'tool:done',
      sessionID: 'sess_1',
      tool: 'officecli',
      result: { success: false, error: 'boom' },
    });
  });

  test('tool called maps to tool:start', () => {
    expect(
      mapBaseEvent({
        type: 'session.next.tool.called',
        properties: { sessionID: 'sess_1', tool: 'officecli', input: { verb: 'set' } },
      }),
    ).toEqual({
      type: 'tool:start',
      sessionID: 'sess_1',
      tool: 'officecli',
      params: { verb: 'set' },
    });
  });

  test('tool success maps to tool:done with success result', () => {
    expect(
      mapBaseEvent({
        type: 'session.next.tool.success',
        properties: {
          sessionID: 'sess_1',
          tool: 'officecli',
          structured: {},
          content: [{ type: 'text', text: 'ok' }],
        },
      }),
    ).toEqual({
      type: 'tool:done',
      sessionID: 'sess_1',
      tool: 'officecli',
      result: { success: true, output: 'ok' },
    });
  });

  test('tool failed maps to tool:done with error result', () => {
    expect(
      mapBaseEvent({
        type: 'session.next.tool.failed',
        properties: { sessionID: 'sess_1', tool: 'officecli', error: { message: 'boom' } },
      }),
    ).toEqual({
      type: 'tool:done',
      sessionID: 'sess_1',
      tool: 'officecli',
      result: { success: false, error: 'boom' },
    });
  });

  test('prompt admitted maps to session:message', () => {
    expect(
      mapBaseEvent({
        type: 'session.next.prompt.admitted',
        properties: { sessionID: 'sess_1', prompt: { text: 'Make a table' } },
      }),
    ).toEqual({
      type: 'session:message',
      sessionID: 'sess_1',
      role: 'user',
      content: 'Make a table',
    });
  });

  test('permission asked maps to session:ask', () => {
    expect(
      mapBaseEvent({
        type: 'permission.v2.asked',
        properties: {
          sessionID: 'sess_1',
          id: 'per_1',
          action: 'write',
          resources: ['/tmp/a.docx'],
        },
      }),
    ).toEqual({
      type: 'session:ask',
      sessionID: 'sess_1',
      promptID: 'per_1',
      question: 'write /tmp/a.docx',
    });
  });

  test('todo updated maps to todo:updated', () => {
    expect(
      mapBaseEvent({
        type: 'todo.updated',
        properties: {
          sessionID: 'sess_1',
          todos: [{ content: 'Fix table', status: 'in_progress', priority: 'high' }],
        },
      }),
    ).toEqual({
      type: 'todo:updated',
      sessionID: 'sess_1',
      todos: [{ content: 'Fix table', status: 'in_progress', priority: 'high' }],
    });
  });

  test('retried maps to llm:retry', () => {
    expect(
      mapBaseEvent({
        type: 'session.next.retried',
        properties: { sessionID: 'sess_1', attempt: 2, error: { message: 'rate limited' } },
      }),
    ).toEqual({
      type: 'llm:retry',
      sessionID: 'sess_1',
      attempt: 2,
      message: 'rate limited',
      next: 0,
    });
  });

  test('session deleted maps to session:end', () => {
    expect(
      mapBaseEvent({
        type: 'session.deleted',
        properties: { info: { id: 'sess_1' } },
      }),
    ).toEqual({ type: 'session:end', sessionID: 'sess_1' });
  });

  test('unknown event returns null', () => {
    expect(mapBaseEvent({ type: 'server.connected', properties: {} })).toBeNull();
  });

  test('session.next.compaction.ended returns null (no compaction signal to clients)', () => {
    expect(
      mapBaseEvent({ type: 'session.next.compaction.ended', properties: { sessionID: 'sess_1' } }),
    ).toBeNull();
  });
});
