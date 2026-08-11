import type { BaseEngine, BaseClient } from './engine';

export function sdkSession(id: string, directory: string, title = '') {
  return {
    id,
    projectID: 'proj_1',
    directory,
    title,
    version: '1.18.15',
    time: { created: Date.now(), updated: Date.now() },
  };
}

export function fakeBase(): {
  engine: BaseEngine;
  sessions: Map<string, ReturnType<typeof sdkSession>>;
  pushEvent: (e: unknown) => void;
  promptCalls: { id: string; text: string }[];
  permissionReplies: { sessionID: string; permissionID: string; reply: string }[];
  maxConcurrent: number;
} {
  const sessions = new Map<string, ReturnType<typeof sdkSession>>();
  const promptCalls: { id: string; text: string }[] = [];
  const permissionReplies: { sessionID: string; permissionID: string; reply: string }[] = [];
  let eventQueue: unknown[] = [];
  let concurrent = 0;
  let maxConcurrent = 0;
  const pushEvent = (e: unknown) => eventQueue.push(e);

  const notFound = (id: string) =>
    Object.assign(new Error(`Session not found: ${id}`), { status: 404 });

  const client: BaseClient = {
    createSession: async (directory, title = '') => {
      const id = 'sess_' + (sessions.size + 1);
      const s = sdkSession(id, directory, title);
      sessions.set(id, s);
      return s;
    },
    getSession: async (id) => {
      const s = sessions.get(id);
      if (!s) throw notFound(id);
      return s;
    },
    listSessions: async () => [...sessions.values()],
    updateSession: async (id, title) => {
      const s = sessions.get(id);
      if (!s) throw notFound(id);
      s.title = title;
      s.time.updated = Date.now();
      return s;
    },
    deleteSession: async (id) => {
      if (!sessions.delete(id)) throw notFound(id);
      return true;
    },
    abortSession: async () => true,
    prompt: async (id, text) => {
      const s = sessions.get(id);
      if (!s) throw notFound(id);
      promptCalls.push({ id, text });
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      // Fire-and-forget (promptAsync): the turn completes via events the
      // bridge turns into one llm:done (text delta + idle status).
      eventQueue.push({
        type: 'message.part.updated',
        properties: {
          sessionID: id,
          part: { type: 'text', text: `response to ${text}`, messageID: 'msg_1', id: 'prt_1' },
        },
      });
      eventQueue.push({
        type: 'session.status',
        properties: { sessionID: id, status: { type: 'idle' } },
      });
    },
    subscribeEvents: async () => {
      const gen = (async function* () {
        while (true) {
          if (eventQueue.length > 0) yield eventQueue.shift();
          await Bun.sleep(5);
        }
      })();
      return gen as unknown as Awaited<ReturnType<BaseClient['subscribeEvents']>>;
    },
    replyPermission: async (sessionID, permissionID, reply) => {
      permissionReplies.push({ sessionID, permissionID, reply });
      return true;
    },
    directory: () => '/tmp',
    mcpStatus: async () => ({}),
    mcpConnect: async () => true,
    mcpDisconnect: async () => true,
  };

  return {
    engine: { url: 'http://127.0.0.1:1', client, close: async () => {} },
    sessions,
    pushEvent,
    promptCalls,
    permissionReplies,
    get maxConcurrent() {
      return maxConcurrent;
    },
  };
}
