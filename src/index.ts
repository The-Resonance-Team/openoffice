import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "./config";
import { SessionStore } from "./session/store";
import { runTurn } from "./session/loop";
import type { Session } from "./session/types";
import { ToolRegistry } from "./tool/registry";
import { on, emit } from "./events";

const MODEL = "anthropic/claude-sonnet-4-20250514";

function getDbPath(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg ?? join(homedir(), ".local", "share");
  return join(base, "openoffice", "openoffice.db");
}

function createSession(model: string): Session {
  const now = Date.now();
  return {
    id: randomUUID(),
    agent: "build",
    model,
    title: "",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const config = resolveConfig();
  const model = config.model ?? MODEL;
  const store = new SessionStore(getDbPath());
  const tools = new ToolRegistry();
  const session = createSession(model);

  store.save(session);
  emit("session:create", { sessionID: session.id });

  // Wire events to stdout
  on("llm:token", (data) => {
    process.stdout.write(data.token);
  });

  on("llm:done", () => {
    process.stdout.write("\n");
  });

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  let busy = false;

  console.log(`openoffice v0.1.0 (model: ${model})`);
  console.log("Type your message. Ctrl+C to exit.\n");
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
      await runTurn({
        session,
        userMessage: input,
        store,
        tools,
        config,
      });
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
    } finally {
      busy = false;
    }

    rl.prompt();
  });

  rl.on("close", () => {
    emit("session:end", { sessionID: session.id });
    process.exit(0);
  });
}

main();
