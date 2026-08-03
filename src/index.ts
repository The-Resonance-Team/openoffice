import { createInterface } from "node:readline";
import {
  connectClient,
  ApiError,
  type OpenOfficeClient,
} from "./server/client";
import { startDaemon } from "./server/daemon";
import { CredentialStore } from "./auth/store";
import { login } from "./auth/login";
import { resolveConfig } from "./config";
import { BUILTIN_PROVIDERS } from "./llm";

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

  console.log(`openoffice v0.1.0 (session: ${session.id})`);
  console.log("Type your message. Ctrl+C to exit.\n");

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
      await runTurnWithAuth(client, session.id, input);
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

async function runTurnWithAuth(
  client: OpenOfficeClient,
  sessionID: string,
  input: string
) {
  try {
    await client.turn(sessionID, input);
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.data as any)?.error === "auth-required"
    ) {
      const provider = (err.data as any)?.provider as string;
      const answer = await askUser(
        `No credential for ${provider}. Log in now? (y/N)`
      );
      if (answer.trim().toLowerCase() !== "y") {
        console.log(
          `Skipped — run \`openoffice auth login ${provider}\` to store a key.`
        );
        return;
      }
      const credential = await login(new CredentialStore(), provider);
      console.log(
        `Stored ${credential.type} credential for ${provider}. Retrying...`
      );
      await client.turn(sessionID, input);
      return;
    }
    throw err;
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
  const command = process.argv[2];
  if (command === "serve") {
    const daemon = await startDaemon();
    console.log(`openoffice daemon listening on port ${daemon.port}`);
    return;
  }
  if (command === "auth") {
    await runAuth(process.argv[3], process.argv[4]);
    return;
  }
  await mainClient();
}

main();
