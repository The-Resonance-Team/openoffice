import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  resolveConfig,
  SessionStore,
  isStaleSession,
  HistoryStore,
  DraftManager,
  ShareStore,
  setSensitiveValues,
  collectEnvValues,
  shareMode,
  findProjectConfig,
  loadConfigFiles,
  mergeLayers,
  applyEnvOverrides,
} from '@openoffice/core';
import { AskChannel, createApp, endSession, type McpApi } from './index';
import type { McpServerStatusInfo } from '@openoffice/protocol';
import { startBase, buildBaseConfig } from '../base';
import { checkForUpdate } from '../update';
import { VERSION } from '../version';
import { loadAuthConfig, authRequired } from './auth';
import { loadCorsOrigins } from './cors';

import { getDataDir } from '../data-dir';

export { getDataDir } from '../data-dir';

interface DaemonInfo {
  pid: number;
  port: number;
}

function daemonInfoPath(dataDir: string): string {
  return join(dataDir, 'daemon.json');
}

export function readDaemonInfo(dataDir: string): DaemonInfo | null {
  const path = daemonInfoPath(dataDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as DaemonInfo;
  } catch {
    return null;
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Spawn a detached daemon and wait until its port file appears. */
export async function spawnDaemon(dataDir = getDataDir()): Promise<DaemonInfo> {
  const entry = process.argv[1];
  spawn(process.execPath, [entry, 'serve'], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  }).unref();

  for (let i = 0; i < 100; i++) {
    await Bun.sleep(50);
    const info = readDaemonInfo(dataDir);
    if (info && isAlive(info.pid)) return info;
  }
  throw new Error('daemon did not start');
}

export interface DaemonHandle {
  port: number;
  stop: () => Promise<void>;
}

const DEFAULT_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly; the threshold itself is 24h

export async function startDaemon(
  options: {
    sweepIntervalMs?: number;
  } = {},
): Promise<DaemonHandle> {
  const { sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS } = options;
  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });

  const config = resolveConfig();
  const store = new SessionStore(join(dataDir, 'openoffice.db'));
  const history = new HistoryStore(dataDir);
  const askChannel = new AskChannel();
  const shareStore = new ShareStore(store.db);

  const draftManager = new DraftManager({
    dataDir,
    history,
    askUser: (question, sessionID) => askChannel.ask(sessionID, question),
    execOfficeCli: async (args) => {
      try {
        const stdout = execFileSync('officecli', args, {
          encoding: 'utf-8',
          timeout: 30000,
        });
        return { stdout, exitCode: 0 };
      } catch (e: unknown) {
        const stdout = e instanceof Error && 'stdout' in e ? String(e.stdout) : '';
        const exitCode =
          e instanceof Error && 'status' in e && typeof e.status === 'number' ? e.status : 1;
        return { stdout, exitCode };
      }
    },
  });

  // The base platform (ADR 0033): spawn the vendored opencode server and
  // drive it through the SDK. The office-document domain (drafts, accept,
  // history) stays here; the agent loop, tools, and sessions are the base's.
  const base = await startBase({
    command: [process.env.OPENOFFICE_OPENCODE_BIN ?? 'opencode'],
    password: randomUUID(),
    config: buildBaseConfig(config),
  });

  // Runtime MCP control surface, proxied to the base server. opencode's
  // status vocabulary maps onto the wire protocol's McpServerStatusInfo.
  const mcp: McpApi = {
    status: async () => {
      const statuses = await base.client.mcpStatus();
      const out: Record<string, McpServerStatusInfo> = {};
      for (const [name, s] of Object.entries(statuses)) {
        if (s.status === 'connected') out[name] = { status: 'connected' };
        else if (s.status === 'disabled') out[name] = { status: 'disabled' };
        else out[name] = { status: 'error', error: s.error ?? s.status };
      }
      return out;
    },
    enable: async (name) => {
      const ok = await base.client.mcpConnect(name);
      return ok ? { status: 'connected' } : { status: 'error', error: 'connect failed' };
    },
    disable: async (name) => {
      const ok = await base.client.mcpDisconnect(name);
      return ok ? { status: 'disabled' } : { status: 'error', error: 'disconnect failed' };
    },
  };

  const authConfig = loadAuthConfig();
  const corsOrigins = loadCorsOrigins();
  if (corsOrigins.length > 0 && !authRequired(authConfig)) {
    console.warn(
      `warning: CORS is enabled for ${corsOrigins.join(', ')} but no OPENOFFICE_SERVER_PASSWORD is set — those origins can drive this daemon unauthenticated.`,
    );
  }

  const deps = {
    auth: authConfig,
    corsOrigins,
    base,
    sessionDefaults: {
      agent: 'office',
      model: config.model ?? 'anthropic/claude-sonnet-4-20250514',
    },
    store,
    draftManager,
    history,
    askChannel,
    shareStore,
    shareMode: shareMode(config),
    mcp,
    updateStatus: async () => {
      if (config.update?.check === false) {
        return { check: false, available: false };
      }
      return checkForUpdate(VERSION, dataDir);
    },
  };

  const { app, attached } = createApp(deps);

  // Collect sensitive values from env:-resolved config for event redaction.
  const env = process.env;
  const globalPath = join(homedir(), '.config', 'openoffice', 'config.json');
  const projectPath = findProjectConfig(process.cwd());
  const layers = loadConfigFiles(globalPath, projectPath);
  const rawConfig = mergeLayers([{}, ...layers]);
  const sensitiveSet = collectEnvValues(applyEnvOverrides(rawConfig, env), env);
  // Also collect stored credentials from auth.json.
  try {
    const { CredentialStore } = await import('@openoffice/core');
    const store = new CredentialStore();
    for (const provider of store.list()) {
      const cred = store.get(provider);
      if (!cred) continue;
      if (cred.type === 'api' && cred.key.length >= 8) sensitiveSet.add(cred.key);
      if (cred.type === 'oauth') {
        if (cred.access.length >= 8) sensitiveSet.add(cred.access);
        if (cred.refresh && cred.refresh.length >= 8) sensitiveSet.add(cred.refresh);
      }
    }
  } catch {
    // auth.json may not exist yet
  }
  setSensitiveValues(sensitiveSet);

  // 0 lets the OS pick and the port file is the source of truth; a browser
  // client cannot read that file, so it needs a fixed port it can be told.
  const server = Bun.serve({
    hostname: '127.0.0.1',
    fetch: app.fetch,
    port: Number(process.env.OPENOFFICE_SERVER_PORT ?? 0) || 0,
  });

  writeFileSync(daemonInfoPath(dataDir), JSON.stringify({ pid: process.pid, port: server.port! }));

  // Daemon exit: orphan every live session's drafts (they are abandoned by definition).
  const sweep = async () => {
    for (const session of store.list()) {
      await draftManager.orphanAll(session.id);
    }
  };
  process.on('SIGTERM', async () => {
    await sweep();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await sweep();
    process.exit(0);
  });

  // Heartbeat sweep (ADR 0022): a session whose heartbeat went stale — a
  // crash/SIGKILL/lid-close never fires the CLI's /end — gets the same
  // explicit-end treatment. Gated on zero attached clients; endSession is
  // idempotent against the /end route racing us.
  const sweepStale = async () => {
    const now = Date.now();
    for (const session of store.list()) {
      if (session.endedAt) continue;
      if (!isStaleSession(session, now)) continue;
      if (attached.count(session.id) > 0) continue;
      await endSession(deps, session.id);
    }
  };
  void sweepStale();
  const sweepTimer = setInterval(() => void sweepStale(), sweepIntervalMs);

  return {
    port: server.port!,
    stop: () => {
      clearInterval(sweepTimer);
      return server.stop(true);
    },
  };
}
