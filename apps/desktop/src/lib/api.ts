import { invoke } from '@tauri-apps/api/core';
import { setTransport, loadAuth } from '@openoffice/ui';

interface DaemonConfig {
  port: number;
  username: string;
  password: string | null;
}

interface DaemonConn {
  base: string;
  username: string;
  password: string | null;
}

let daemonConn: Promise<DaemonConn> | null = null;

function connectDaemon(): Promise<DaemonConn> {
  if (!daemonConn) {
    daemonConn = invoke<DaemonConfig>('daemon_start').then((cfg) => ({
      base: `http://127.0.0.1:${cfg.port}`,
      username: cfg.username,
      password: cfg.password,
    }));
  }
  return daemonConn;
}

async function apiBase(): Promise<string> {
  const { base } = await connectDaemon();
  return base;
}

async function authHeaders(): Promise<HeadersInit> {
  const override = loadAuth();
  if (override) {
    return {
      Authorization: `Basic ${btoa(`${override.username}:${override.password}`)}`,
    };
  }
  const { username, password } = await connectDaemon();
  if (!password) return {};
  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
}

setTransport({ base: apiBase, authHeaders });

export * from '@openoffice/ui';
