import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveConfig, shareMode } from "../config";
import {
  SessionStore,
  runTurn,
  buildSystemPrompt,
  type Session,
} from "../session";
import { HistoryStore } from "../history";
import { DraftManager } from "../draft";
import { ShareStore } from "../share";
import { AskChannel, createApp, type SessionRuntime } from "./index";
import {
  ToolRegistry,
  createConvertTool,
  createGlobTool,
  createGrepTool,
  createQuestionTool,
  createReadTool,
  createWriteTool,
  type ToolDefinition,
} from "../tool";
import { AgentRegistry } from "../agent";
import { createDefaultOfficeCliTool } from "../office";
import { createSkillTool } from "../skills";
import { McpManager } from "../mcp";
import { createSdkMcpClient, planMcpConnections } from "../mcp/sdk-client";
import { checkForUpdate } from "../update";
import { VERSION } from "../version";
import { randomUUID } from "node:crypto";
import { loadAuthConfig, createAuthMiddleware } from "./auth";
import { setSensitiveValues } from "../events";
import { collectEnvValues } from "../config";
import {
  applyEnvOverrides,
  findProjectConfig,
  loadConfigFiles,
  mergeLayers,
} from "../config/loader";

import { getDataDir } from "../data-dir";
export { getDataDir } from "../data-dir";

interface DaemonInfo {
  pid: number;
  port: number;
}

function daemonInfoPath(dataDir: string): string {
  return join(dataDir, "daemon.json");
}

export function readDaemonInfo(dataDir: string): DaemonInfo | null {
  const path = daemonInfoPath(dataDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as DaemonInfo;
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
  spawn(process.execPath, [entry, "serve"], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  }).unref();

  for (let i = 0; i < 100; i++) {
    await Bun.sleep(50);
    const info = readDaemonInfo(dataDir);
    if (info && isAlive(info.pid)) return info;
  }
  throw new Error("daemon did not start");
}

export interface DaemonHandle {
  port: number;
  stop: () => Promise<void>;
}

export async function startDaemon(): Promise<DaemonHandle> {
  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });

  const config = resolveConfig();
  const store = new SessionStore(join(dataDir, "openoffice.db"));
  const history = new HistoryStore(dataDir);
  const askChannel = new AskChannel();
  const shareStore = new ShareStore(store.db);

  const draftManager = new DraftManager({
    dataDir,
    history,
    askUser: (question, sessionID) => askChannel.ask(sessionID, question),
    execOfficeCli: async (args) => {
      try {
        const stdout = execFileSync("officecli", args, {
          encoding: "utf-8",
          timeout: 30000,
        });
        return { stdout, exitCode: 0 };
      } catch (e: any) {
        return { stdout: e.stdout ?? "", exitCode: e.status ?? 1 };
      }
    },
  });

  // Daemon-global runtime pieces: skills dir, agents, MCP connections.
  const agentRegistry = new AgentRegistry();
  const skillsDir = join(process.cwd(), "skills");
  const mcp = new McpManager({ connect: createSdkMcpClient });

  const baseTools: ToolDefinition[] = [
    createDefaultOfficeCliTool({ draftManager }),
    createReadTool({
      draftManager,
      readOffice: async (file) => {
        const output = execFileSync("officecli", ["get", file, "--json"], {
          encoding: "utf-8",
          timeout: 30000,
        });
        return output;
      },
      readPdf: async (file) => {
        return execFileSync("pdftotext", ["-layout", file, "-"], {
          encoding: "utf-8",
          timeout: 30000,
        });
      },
    }),
    createWriteTool(),
    createGlobTool(),
    createGrepTool(),
    createSkillTool(skillsDir),
  ];

  const convertDeps = {
    convertFile: async (file: string, format: string) => {
      const dir = dirname(file);
      execFileSync(
        "soffice",
        ["--headless", "--convert-to", format, "--outdir", dir, file],
        { encoding: "utf-8", timeout: 60000 }
      );
      return join(dir, `${basename(file).replace(/\.[^.]+$/, "")}.${format}`);
    },
  };

  const { toConnect, skipped } = planMcpConnections(
    config.mcp,
    baseTools.map((t) => t.name)
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
    baseTools.push({
      name: mcp.toolName(tool.clientName, tool.name),
      description: tool.description,
      // ponytail: MCP inputSchema is JSON Schema; AI SDK tool() accepts it directly
      parameters: tool.inputSchema as unknown as ToolDefinition["parameters"],
      execute: (args) => mcp.callTool(tool.clientName, tool.name, args),
    });
  }

  const defaultModel = config.model ?? "anthropic/claude-sonnet-4-20250514";
  const defaultAgent = agentRegistry.getDefault();

  const runtimeCache = new Map<string, SessionRuntime>();
  const buildRuntime = (session: Session) => {
    const cached = runtimeCache.get(session.id);
    if (cached) return cached;

    const registry = new ToolRegistry();
    const filtered = agentRegistry.filterTools(
      baseTools,
      defaultAgent.permission
    );
    for (const tool of filtered) registry.register(tool);
    registry.register(
      createQuestionTool({
        askUser: (q) => askChannel.ask(session.id, q),
      })
    );
    registry.register(
      createConvertTool({
        askUser: (q) => askChannel.ask(session.id, q),
        ...convertDeps,
      })
    );

    const runtime: SessionRuntime = {
      tools: registry,
      system: buildSystemPrompt({
        agent: defaultAgent,
        skillsDir,
        mcp,
        cwd: session.cwd,
      }),
    };
    runtimeCache.set(session.id, runtime);
    return runtime;
  };

  const { app } = createApp({
    store,
    draftManager,
    history,
    askChannel,
    shareStore,
    shareMode: shareMode(config),
    createSession: (cwd) => {
      const now = Date.now();
      return {
        id: randomUUID(),
        agent: defaultAgent.name,
        model: defaultModel,
        title: "",
        cwd,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
    },
    buildRuntime,
    runTurn: (session, message, runtime, s) =>
      runTurn({
        session,
        userMessage: message,
        store: s,
        agents: agentRegistry,
        tools: runtime.tools,
        system: runtime.system,
        config,
      }),
    updateStatus: async () => {
      if (config.update?.check === false) {
        return { check: false, available: false };
      }
      return checkForUpdate(VERSION, dataDir);
    },
    // Auth middleware: enforce OPENOFFICE_SERVER_PASSWORD if set. Mounted
    // inside createApp — registering it here after createApp() would be a
    // no-op: Hono only applies middleware registered before its routes.
    authMiddleware: createAuthMiddleware(loadAuthConfig()),
  });

  // Collect sensitive values from env:-resolved config for event redaction.
  const env = process.env;
  const globalPath = join(homedir(), ".config", "openoffice", "config.json");
  const projectPath = findProjectConfig(process.cwd());
  const layers = loadConfigFiles(globalPath, projectPath);
  const rawConfig = mergeLayers([{}, ...layers]);
  const sensitiveSet = collectEnvValues(applyEnvOverrides(rawConfig, env), env);
  // Also collect stored credentials from auth.json.
  try {
    const { CredentialStore } = await import("../auth/store");
    const store = new CredentialStore();
    for (const provider of store.list()) {
      const cred = store.get(provider);
      if (!cred) continue;
      if (cred.type === "api" && cred.key.length >= 8)
        sensitiveSet.add(cred.key);
      if (cred.type === "oauth") {
        if (cred.access.length >= 8) sensitiveSet.add(cred.access);
        if (cred.refresh && cred.refresh.length >= 8)
          sensitiveSet.add(cred.refresh);
      }
    }
  } catch {
    // auth.json may not exist yet
  }
  setSensitiveValues(sensitiveSet);

  const server = Bun.serve({
    hostname: "127.0.0.1",
    fetch: app.fetch,
    port: 0,
  });

  writeFileSync(
    daemonInfoPath(dataDir),
    JSON.stringify({ pid: process.pid, port: server.port! })
  );

  // Daemon exit: orphan every live session's drafts (they are abandoned by definition).
  const sweep = async () => {
    for (const session of store.list()) {
      await draftManager.orphanAll(session.id);
    }
  };
  process.on("SIGTERM", async () => {
    await sweep();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
    await sweep();
    process.exit(0);
  });

  return { port: server.port!, stop: () => server.stop(true) };
}
