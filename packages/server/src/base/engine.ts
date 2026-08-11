import { createOpencodeClient, type OpencodeClient, type Session } from '@opencode-ai/sdk';
import { spawnBaseServer, type SpawnBaseServerOptions } from './spawn';

export type StartBaseOptions = {
  command: string[];
  hostname?: string;
  port?: number;
  password: string;
  config?: Record<string, unknown>;
  timeout?: number;
  /** Extra env for the spawned base process (tool-file config dir, data dir). */
  env?: Record<string, string>;
};

// The daemon's typed surface over the base server. The SDK's generated d.ts
// hardcodes the fields response style while the runtime honors
// `responseStyle: 'data'`; this seam declares what the daemon actually uses so
// call sites are typed against the real payloads (Session, parts, events).
export interface BaseClient {
  createSession(directory: string, title?: string): Promise<Session>;
  getSession(id: string): Promise<Session>;
  listSessions(): Promise<Session[]>;
  updateSession(id: string, title: string): Promise<Session>;
  deleteSession(id: string): Promise<boolean>;
  abortSession(id: string): Promise<boolean>;
  /** Fire the prompt; the turn's completion arrives as an llm:done event. */
  prompt(id: string, text: string): Promise<void>;
  /** The base's instance directory (from createSession); events are per-instance. */
  directory(): string;
  subscribeEvents(): Promise<AsyncIterable<{ type: string; properties: Record<string, unknown> }>>;
  replyPermission(
    sessionID: string,
    permissionID: string,
    reply: 'once' | 'always' | 'reject',
  ): Promise<boolean>;
  mcpStatus(): Promise<Record<string, { status: string; error?: string }>>;
  mcpConnect(name: string): Promise<boolean>;
  mcpDisconnect(name: string): Promise<boolean>;
}

export type BaseEngine = {
  url: string;
  client: BaseClient;
  close: () => Promise<void>;
};

export async function startBase(options: StartBaseOptions): Promise<BaseEngine> {
  const spawnOptions: SpawnBaseServerOptions = {
    command: options.command,
    hostname: options.hostname,
    port: options.port,
    password: options.password,
    config: options.config,
    timeout: options.timeout,
    env: options.env,
  };
  const { url, close } = await spawnBaseServer(spawnOptions);
  const raw: OpencodeClient = createOpencodeClient({
    baseUrl: url,
    responseStyle: 'data',
    throwOnError: true,
    headers: {
      authorization: 'Basic ' + Buffer.from(`opencode:${options.password}`).toString('base64'),
    },
  });

  let currentDirectory = '/';
  const client: BaseClient = {
    createSession: async (directory, title = '') => {
      currentDirectory = directory;
      return raw.session.create({ query: { directory }, body: { title } }) as unknown as Session;
    },
    getSession: async (id) => raw.session.get({ path: { id } }) as unknown as Session,
    listSessions: async () => raw.session.list() as unknown as Session[],
    updateSession: async (id, title) =>
      raw.session.update({ path: { id }, body: { title } }) as unknown as Session,
    deleteSession: async (id) => raw.session.delete({ path: { id } }) as unknown as boolean,
    abortSession: async (id) => raw.session.abort({ path: { id } }) as unknown as boolean,
    prompt: async (id, text) => {
      await raw.session.promptAsync({
        path: { id },
        body: { parts: [{ type: 'text', text }] },
      });
    },
    subscribeEvents: async () => {
      const events = await raw.event.subscribe({
        query: { directory: currentDirectory },
      });
      return events.stream as unknown as AsyncIterable<{
        type: string;
        properties: Record<string, unknown>;
      }>;
    },
    directory: () => currentDirectory,
    replyPermission: async (sessionID, permissionID, reply) =>
      raw.postSessionIdPermissionsPermissionId({
        path: { id: sessionID, permissionID },
        body: { response: reply },
      }) as unknown as boolean,
    mcpStatus: async () =>
      raw.mcp.status() as unknown as Record<string, { status: string; error?: string }>,
    mcpConnect: async (name) => raw.mcp.connect({ path: { name } }) as unknown as boolean,
    mcpDisconnect: async (name) => raw.mcp.disconnect({ path: { name } }) as unknown as boolean,
  };

  return { url, client, close };
}
