import { createInterface } from "node:readline";
import { basename } from "node:path";
import {
  connectClient,
  startDaemon,
  cleanupPendingUpdate,
  performUpdate,
  VERSION,
} from "@openoffice/server";
import {
  CredentialStore,
  login,
  resolveConfig,
  BUILTIN_PROVIDERS,
} from "@openoffice/core";

const HELP = `openoffice ${VERSION} — an LLM agent CLI for office document work.

Usage:
  openoffice                Interactive chat (auto-spawns the daemon)
  openoffice serve          Run the daemon in the foreground (auto-spawned on demand)
  openoffice update         Check GitHub Releases and update the installed binary
  openoffice auth login <provider>    Store an API key for a provider
  openoffice auth logout <provider>   Remove a stored credential
  openoffice auth list                Show providers with stored credentials
  openoffice --version      Print the version
  openoffice --help         Show this help

Configuration lives in openoffice.json (project) or the global config — see
https://github.com/The-Resonance-Team/openoffice (docs/config.md).
`;

function askUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question}\n> `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function mainClient() {
  const client = await connectClient();
  const session = await client.createSession(process.cwd());

  console.log(`openoffice ${VERSION} (session: ${session.id})`);
  const upd = await client.updateStatus().catch(() => null);
  if (upd && upd.check !== false && upd.available) {
    console.log(
      `Update available: v${upd.version} — run \`openoffice update\``
    );
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  let busy = false;

  client.stream(session.id, {
    token: (token) => process.stdout.write(token),
    done: () => process.stdout.write("\n"),
    ask: async (promptID, question) => {
      const answer = await askUser(question);
      await client.askAnswer(session.id, promptID, answer);
    },
  });

  rl.prompt();

  rl.on("line", async (line) => {
    if (busy) return;

    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    busy = true;
    try {
      await client.turn(session.id, input);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
    } finally {
      busy = false;
    }
    rl.prompt();
  });

  rl.on("close", async () => {
    await client.endSession(session.id);
    process.exit(0);
  });
}

function isInstalledBinary(execPath: string): boolean {
  const name = basename(execPath);
  return /^openoffice(\.exe)?$/.test(name);
}

async function runUpdate() {
  cleanupPendingUpdate();
  if (!isInstalledBinary(process.execPath)) {
    console.error(
      "openoffice update replaces the installed binary — run it from the installed CLI (npm -g or dist/openoffice), not the dev runner."
    );
    process.exit(1);
  }
  try {
    const result = await performUpdate(VERSION, process.execPath);
    if (result.status === "up-to-date") {
      console.log(`openoffice ${VERSION} is up to date.`);
    } else if (result.status === "updated") {
      console.log(
        `Updated to ${result.version}. Restart to use the new binary.`
      );
    } else {
      console.error(`Update failed: ${result.error}`);
      process.exit(1);
    }
  } catch (e) {
    console.error("Update failed:", e instanceof Error ? e.message : e);
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
  const usage =
    "Usage: openoffice auth login <provider> | logout <provider> | list";

  if (sub === "list") {
    const names = store.list();
    if (names.length === 0) console.log("No stored credentials.");
    else console.log(names.join("\n"));
    return;
  }
  if (!provider) {
    console.error(usage);
    process.exit(1);
  }
  if (sub === "login") {
    const valid = knownProviderNames();
    if (!valid.has(provider)) {
      console.error(
        `Unknown provider "${provider}". Known providers: ${[...valid].join(", ")}.`
      );
      process.exit(1);
    }
    const credential = await login(store, provider);
    console.log(`Stored ${credential.type} credential for ${provider}.`);
    return;
  }
  if (sub === "logout") {
    if (store.remove(provider))
      console.log(`Removed credential for ${provider}.`);
    else console.log(`No stored credential for ${provider}.`);
    return;
  }
  console.error(`Unknown auth command "${sub}". ${usage}`);
  process.exit(1);
}

async function main() {
  cleanupPendingUpdate();

  const args = process.argv.slice(2);
  switch (args[0]) {
    case "--version":
    case "-v":
      console.log(VERSION);
      return;
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    case undefined:
      await mainClient();
      return;
    case "serve": {
      const daemon = await startDaemon();
      console.log(`openoffice daemon listening on port ${daemon.port}`);
      return;
    }
    case "update":
      await runUpdate();
      return;
    case "auth":
      await runAuth(args[1], args[2]);
      return;
    default:
      console.error(
        `Unknown command "${args[0]}". Run \`openoffice --help\` for usage.`
      );
      process.exit(1);
  }
}

main();
