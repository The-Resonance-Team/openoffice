import { basename } from 'node:path';
import {
  connectClient,
  startDaemon,
  cleanupPendingUpdate,
  performUpdate,
  VERSION,
} from '@openoffice/server';
import {
  CredentialStore,
  login,
  resolveConfig,
  BUILTIN_PROVIDERS,
  discoverLocalModels,
} from '@openoffice/core';

const HELP = `openoffice ${VERSION} — an LLM agent CLI for office document work.

Usage:
  openoffice                Show quick start message (web UI guide)
  openoffice serve          Run the daemon in the foreground
  openoffice update         Check GitHub Releases and update the installed binary
  openoffice auth login <provider>    Store an API key for a provider
  openoffice auth logout <provider>   Remove a stored credential
  openoffice auth list                Show providers with stored credentials
  openoffice models                   List models from running local servers (Ollama, llama.cpp, vLLM)
  openoffice share <sessionID>        Generate a read-only share URL for a session
  openoffice unshare <sessionID>      Revoke a session's share URL
  openoffice --version      Print the version
  openoffice --help         Show this help

Configuration lives in openoffice.json (project) or the global config — see
https://github.com/The-Resonance-Team/openoffice (docs/config.md).
`;

function isInstalledBinary(execPath: string): boolean {
  const name = basename(execPath);
  return /^openoffice(\.exe)?$/.test(name);
}

async function runUpdate() {
  cleanupPendingUpdate();
  if (!isInstalledBinary(process.execPath)) {
    console.error(
      'openoffice update replaces the installed binary — run it from the installed CLI (npm -g or dist/openoffice), not the dev runner.',
    );
    process.exit(1);
  }
  try {
    const result = await performUpdate(VERSION, process.execPath);
    if (result.status === 'up-to-date') {
    } else if (result.status === 'updated') {
    } else {
      console.error(`Update failed: ${result.error}`);
      process.exit(1);
    }
  } catch (e) {
    console.error('Update failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

function knownProviderNames(): Set<string> {
  const names = new Set<string>(BUILTIN_PROVIDERS);
  try {
    const config = resolveConfig();
    for (const name of Object.keys(config.provider ?? {})) names.add(name);
  } catch {
    // config may reference unset env vars — the built-in set still applies
  }
  return names;
}

async function runAuth(sub?: string, provider?: string) {
  const store = new CredentialStore();
  const usage = 'Usage: openoffice auth login <provider> | logout <provider> | list';

  if (sub === 'list') {
    const names = store.list();
    if (names.length === 0) {
    } else {
    }
    return;
  }
  if (!provider) {
    console.error(usage);
    process.exit(1);
  }
  if (sub === 'login') {
    const valid = knownProviderNames();
    if (!valid.has(provider)) {
      console.error(`Unknown provider "${provider}". Known providers: ${[...valid].join(', ')}.`);
      process.exit(1);
    }
    const _credential = await login(store, provider);

    return;
  }
  if (sub === 'logout') {
    if (store.remove(provider)) {
    } else {
    }
    return;
  }
  console.error(`Unknown auth command "${sub}". ${usage}`);
  process.exit(1);
}

async function runModels() {
  const found = await discoverLocalModels();
  if (found.length === 0) {
    return;
  }
  for (const server of found) {
    for (const model of server.models) {
      console.log(`${server.server}/${model}`);
    }
  }
}

async function runShareCommand(kind: 'share' | 'unshare', sessionID?: string) {
  if (!sessionID) {
    console.error('Usage: openoffice share <sessionID> | unshare <sessionID>');
    process.exit(1);
  }
  const client = await connectClient();
  try {
    if (kind === 'share') {
      const { url } = await client.share(sessionID);
      console.log(url);
    } else {
      await client.unshare(sessionID);
    }
  } catch (e) {
    console.error(
      `${kind === 'share' ? 'Share' : 'Unshare'} failed: ${e instanceof Error ? e.message : e}`,
    );
    process.exit(1);
  }
}

async function main() {
  cleanupPendingUpdate();

  const args = process.argv.slice(2);
  switch (args[0]) {
    case '--version':
    case '-v':
      return;
    case '--help':
    case '-h':
      console.log(HELP);
      return;
    case undefined:
      console.log('Interactive chat moved to web UI.');
      console.log('Run `openoffice serve` then open http://localhost:5201 in your browser.');
      console.log('Or use `openoffice --help` for all commands.');
      return;
    case 'serve': {
      const _daemon = await startDaemon();

      return;
    }
    case 'update':
      await runUpdate();
      return;
    case 'auth':
      await runAuth(args[1], args[2]);
      return;
    case 'models':
      await runModels();
      return;
    case 'share':
      await runShareCommand('share', args[1]);
      return;
    case 'unshare':
      await runShareCommand('unshare', args[1]);
      return;
    default:
      console.error(`Unknown command "${args[0]}". Run \`openoffice --help\` for usage.`);
      process.exit(1);
  }
}

main();
