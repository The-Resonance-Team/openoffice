import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpClient, McpConfig } from "./manager";

const CONNECT_TIMEOUT_MS = 30_000;

// SDK CallToolResult content parts -> plain text; throws on isError.
export function normalizeMcpResult(result: unknown): string {
  const r = result as {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  if (r.isError) {
    throw new Error(
      r.content
        ?.map((c) => c.text)
        .filter(Boolean)
        .join("\n") || "MCP tool returned an error"
    );
  }
  const text = r.content
    ?.map((c) => (c.type === "text" ? c.text : ""))
    .filter(Boolean)
    .join("\n");
  return text || JSON.stringify(result);
}

// Dogfooding rule: a configured server whose name matches a native tool is
// skipped — the native integration (typed verbs, install check, convert
// chaining) is strictly better than the MCP `command` string surface.
export function planMcpConnections(
  configured: Record<string, McpConfig> | undefined,
  nativeToolNames: string[]
): { toConnect: Array<[string, McpConfig]>; skipped: string[] } {
  const native = new Set(nativeToolNames);
  const toConnect: Array<[string, McpConfig]> = [];
  const skipped: string[] = [];
  for (const [name, cfg] of Object.entries(configured ?? {})) {
    if (native.has(name)) {
      skipped.push(name);
    } else {
      toConnect.push([name, cfg]);
    }
  }
  return { toConnect, skipped };
}

// ponytail: connect can hang on a dead server; a hard timeout is the ceiling.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export function createSdkMcpClient(config: McpConfig): Promise<McpClient> {
  const client = new Client({ name: "openoffice", version: "0.1.0" });

  const connect = async (): Promise<McpClient> => {
    if (config.type === "local") {
      const [command, ...args] = config.command ?? [];
      if (!command) throw new Error("local MCP server requires a command");
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries({
        ...process.env,
        ...config.environment,
      })) {
        if (value !== undefined) env[key] = value;
      }
      await client.connect(new StdioClientTransport({ command, args, env }));
    } else {
      if (!config.url) throw new Error("remote MCP server requires a url");
      await client.connect(
        new StreamableHTTPClientTransport(new URL(config.url))
      );
    }
    return {
      name: "",
      async listTools() {
        const { tools } = await client.listTools();
        return tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
          inputSchema: t.inputSchema as unknown as Record<string, unknown>,
        }));
      },
      async callTool(name, args) {
        const result = await client.callTool({ name, arguments: args });
        return normalizeMcpResult(result);
      },
      async close() {
        await client.close();
      },
    };
  };

  return withTimeout(connect(), CONNECT_TIMEOUT_MS);
}
