import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname, basename, extname } from "node:path";
import { resolveConfig } from "./config";
import { SessionStore } from "./session/store";
import { runTurn } from "./session/loop";
import { buildSystemPrompt } from "./session/system";
import type { Session } from "./session/types";
import { ToolRegistry } from "./tool/registry";
import { AgentRegistry } from "./agent";
import { createDefaultOfficeCliTool } from "./office";
import { createReadTool } from "./tool/builtins/read";
import { createWriteTool } from "./tool/builtins/write";
import { createGlobTool } from "./tool/builtins/glob";
import { createGrepTool } from "./tool/builtins/grep";
import { createQuestionTool } from "./tool/builtins/question";
import { createConvertTool } from "./tool/builtins/convert";
import { createSkillTool } from "./skills";
import { McpManager } from "./mcp";
import { createSdkMcpClient, planMcpConnections } from "./mcp/sdk-client";
import type { ToolDefinition } from "./tool";
import { on, emit } from "./events";
import { execFileSync } from "node:child_process";

const MODEL = "anthropic/claude-sonnet-4-20250514";

function getDbPath(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg ?? join(homedir(), ".local", "share");
  return join(base, "openoffice", "openoffice.db");
}

function getSkillsDir(): string {
  return join(process.cwd(), "skills");
}

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

function createSession(model: string, agentName: string): Session {
  const now = Date.now();
  return {
    id: randomUUID(),
    agent: agentName,
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
  const agentRegistry = new AgentRegistry();
  const agent = agentRegistry.getDefault();
  const skillsDir = getSkillsDir();

  // Build tool registry
  const tools = new ToolRegistry();
  tools.register(createDefaultOfficeCliTool());
  tools.register(
    createReadTool({
      readOffice: async (file: string) => {
        const output = execFileSync("officecli", ["get", file, "--json"], {
          encoding: "utf-8",
          timeout: 30000,
        });
        return output;
      },
      readPdf: async (file: string) => {
        return execFileSync("pdftotext", ["-layout", file, "-"], {
          encoding: "utf-8",
          timeout: 30000,
        });
      },
    })
  );
  tools.register(createWriteTool());
  tools.register(createGlobTool());
  tools.register(createGrepTool());
  tools.register(
    createQuestionTool({
      askUser,
    })
  );
  tools.register(
    createConvertTool({
      askUser,
      convertFile: async (file: string, format: string) => {
        const dir = dirname(file);
        execFileSync(
          "soffice",
          ["--headless", "--convert-to", format, "--outdir", dir, file],
          {
            encoding: "utf-8",
            timeout: 60000,
          }
        );
        const base = basename(file, extname(file));
        return join(dir, `${base}.${format}`);
      },
    })
  );
  tools.register(createSkillTool(skillsDir));

  // Connect MCP servers from config; skip any whose name collides with a
  // native tool — the native integration is strictly better (dogfooding).
  const mcp = new McpManager({ connect: createSdkMcpClient });
  const { toConnect, skipped } = planMcpConnections(
    config.mcp,
    tools.list().map((t) => t.name)
  );
  for (const name of skipped) {
    console.warn(
      `MCP server "${name}" skipped: provided natively, use the built-in tool`
    );
  }
  for (const [name, mcpConfig] of toConnect) {
    try {
      await mcp.connect(name, mcpConfig);
    } catch (e) {
      console.warn(
        `MCP server "${name}" failed to connect: ${e instanceof Error ? e.message : e}`
      );
    }
  }
  for (const tool of await mcp.listAllTools()) {
    tools.register({
      name: mcp.toolName(tool.clientName, tool.name),
      description: tool.description,
      // ponytail: MCP inputSchema is JSON Schema; AI SDK tool() accepts it directly
      parameters: tool.inputSchema as unknown as ToolDefinition["parameters"],
      execute: (args) => mcp.callTool(tool.clientName, tool.name, args),
    });
  }

  // Build system prompt
  const system = buildSystemPrompt({
    agent,
    skillsDir,
    mcp,
    cwd: process.cwd(),
  });

  // Filter tools by agent permission
  const allTools = tools.list();
  const filteredTools = agentRegistry.filterTools(allTools, agent.permission);
  const filteredRegistry = new ToolRegistry();
  for (const tool of filteredTools) {
    filteredRegistry.register(tool);
  }

  const session = createSession(model, agent.name);
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

  console.log(`openoffice v0.1.0 (model: ${model}, agent: ${agent.name})`);
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
        tools: filteredRegistry,
        system,
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
