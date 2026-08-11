import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import type { EventEmitter } from 'node:events';

export type SpawnBaseServerOptions = {
  command: string[];
  hostname?: string;
  port?: number;
  password: string;
  config?: Record<string, unknown>;
  timeout?: number;
  /** Extra env for the child (e.g. OPENCODE_CONFIG_DIR for tool files). */
  env?: Record<string, string>;
};

export type SpawnedBaseServer = {
  url: string;
  close: () => Promise<void>;
};

// A deliberate, commented fork of the SDK's `createOpencodeServer`
// (packages/sdk/js/src/server.ts): the SDK hardcodes the `opencode` command on
// PATH, sets only OPENCODE_CONFIG_CONTENT, and cannot express the vendored
// binary path, the per-spawn password env, or `--port=0` for ephemeral ports.
// The listening-line contract ("opencode server listening on http://…") and
// the timeout/parse/exit error shapes are copied verbatim so the base's
// readiness protocol stays identical.
function stop(proc: ChildProcess) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  // Windows kill-tree: SIGTERM to a Bun-compiled child may leave its
  // descendants (the base server's own workers) alive. Matches the SDK's
  // stop() (packages/sdk/js/src/process.ts).
  if (process.platform === 'win32' && proc.pid) {
    const out = spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
      windowsHide: true,
    });
    if (!out.error && out.status === 0) return;
  }
  proc.kill();
}

export function spawnBaseServer(options: SpawnBaseServerOptions): Promise<SpawnedBaseServer> {
  const hostname = options.hostname ?? '127.0.0.1';
  const port = options.port ?? 0;
  const timeout = options.timeout ?? 5000;

  // CI's type resolution lacks the emitter methods on ChildProcess; the
  // intersection with EventEmitter keeps on/off/once across node/bun types.
  const proc = spawn(
    options.command[0],
    [...options.command.slice(1), 'serve', `--hostname=${hostname}`, `--port=${port}`],
    {
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: options.password,
        OPENCODE_CONFIG_CONTENT: JSON.stringify(options.config ?? {}),
        ...options.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ) as unknown as ChildProcess & EventEmitter;

  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      clear();
      stop(proc);
      reject(new Error(`Timeout waiting for server to start after ${timeout}ms`));
    }, timeout);

    let output = '';
    let resolved = false;

    const clear = () => {
      clearTimeout(id);
      proc.stdout?.off('data', onStdout);
      proc.stderr?.off('data', onStderr);
      proc.off('exit', onExit);
      proc.off('error', onError);
    };

    const onStdout = (chunk: Buffer) => {
      if (resolved) return;
      output += chunk.toString();
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.startsWith('opencode server listening')) {
          const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
          if (!match) {
            clear();
            stop(proc);
            reject(new Error(`Failed to parse server url from output: ${line}`));
            return;
          }
          clearTimeout(id);
          resolved = true;
          resolve({ url: match[1]!, close: () => stopAndWait(proc) });
          return;
        }
      }
    };

    const onStderr = (chunk: Buffer) => {
      output += chunk.toString();
    };

    const onExit = (code: number | null) => {
      clear();
      let msg = `Server exited with code ${code}`;
      if (output.trim()) msg += `\nServer output: ${output}`;
      reject(new Error(msg));
    };

    const onError = (err: Error) => {
      clear();
      reject(err);
    };

    proc.stdout?.on('data', onStdout);
    proc.stderr?.on('data', onStderr);
    proc.on('exit', onExit);
    proc.on('error', onError);
  });
}

function stopAndWait(proc: ChildProcess & EventEmitter): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) return resolve();
    proc.once('exit', () => resolve());
    stop(proc);
  });
}
