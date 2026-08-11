import {
  createOpencodeClient,
  type OpencodeClient,
  type Session,
  type SessionPromptResponse,
} from '@opencode-ai/sdk';
import { spawnBaseServer, type SpawnBaseServerOptions } from './spawn';

export type StartBaseOptions = {
  command: string[];
  hostname?: string;
  port?: number;
  password: string;
  config?: Record<string, unknown>;
  timeout?: number;
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
  prompt(id: string, text: string): Promise<SessionPromptResponse>;
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

  const client: BaseClient = {
    createSession: async (directory, title = '') =>
      raw.session.create({ query: { directory }, body: { title } }) as unknown as Session,
    getSession: async (id) => raw.session.get({ path: { id } }) as unknown as Session,
    listSessions: async () => raw.session.list() as unknown as Session[],
    updateSession: async (id, title) =>
      raw.session.update({ path: { id }, body: { title } }) as unknown as Session,
    deleteSession: async (id) => raw.session.delete({ path: { id } }) as unknown as boolean,
    abortSession: async (id) => raw.session.abort({ path: { id } }) as unknown as boolean,
    prompt: async (id, text) =>
      raw.session.prompt({
        path: { id },
        body: { parts: [{ type: 'text', text }] },
      }) as unknown as SessionPromptResponse,
    subscribeEvents: async () => {
      const events = await raw.event.subscribe();
      return events.stream as unknown as AsyncIterable<{
        type: string;
        properties: Record<string, unknown>;
      }>;
    },
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
