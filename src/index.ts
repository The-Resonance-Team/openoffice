import { createInterface } from "node:readline";
import { connectClient } from "./server/client";
import { startDaemon } from "./server/daemon";

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

async function main() {
  if (process.argv[2] === "serve") {
    const daemon = await startDaemon();
    console.log(`openoffice daemon listening on port ${daemon.port}`);
    return;
  }
  await mainClient();
}

main();
