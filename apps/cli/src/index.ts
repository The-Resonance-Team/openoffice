import { basename } from 'node:path';
import {
  connectClient,
  startDaemon,
  cleanupPendingUpdate,
  performUpdate,
  VERSION,
} from '@openoffice/server';

const HELP = `openoffice ${VERSION} — an LLM agent CLI for office document work.

Usage:
  openoffice                Show quick start message (web UI guide)
  openoffice serve          Run the daemon in the foreground
  openoffice update         Check GitHub Releases and update the installed binary
  openoffice share <sessionID>        Generate a read-only share URL for a session
  openoffice unshare <sessionID>      Revoke a session's share URL
  openoffice --version      Print the version
  openoffice --help         Show this help

Provider credentials are managed by the base engine: run \`opencode auth login <provider>\`
(ADR 0033). Configuration lives in openoffice.json (project) or the global config — see
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
