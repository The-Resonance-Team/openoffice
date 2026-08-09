import type { ToolResult } from "../tool";
import type {
  McpServerStatus,
  McpServerStatusInfo,
} from "@openoffice/protocol";

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpPromptInfo {
  name: string;
  description?: string;
}

export interface McpResourceInfo {
  uri: string;
  name?: string;
  description?: string;
}

export interface McpClient {
  name: string;
  listTools(): Promise<McpToolInfo[]>;
  listPrompts(): Promise<McpPromptInfo[]>;
  listResources(): Promise<McpResourceInfo[]>;
  /** Resolves a resource URI to text; throws on failure. */
  readResource(uri: string): Promise<string>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface McpConfig {
  type: "local" | "remote";
  command?: string[];
  url?: string;
  environment?: Record<string, string>;
  /** Default true; a false server boots as `disabled`, never connecting. */
  enabled?: boolean;
}

export interface McpManagerDeps {
  connect(config: McpConfig): Promise<McpClient>;
}

export type {
  McpServerStatus,
  McpServerStatusInfo,
} from "@openoffice/protocol";

// Per-server runtime state: `enabled` is the intent (config or a runtime
// toggle), `status` is the live transport state derived from it.
interface McpServerEntry {
  config: McpConfig;
  enabled: boolean;
  status: McpServerStatus;
  error?: string;
  note?: string;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class McpManager {
  private clients = new Map<string, McpClient>();
  private servers = new Map<string, McpServerEntry>();
  private deps: McpManagerDeps;

  constructor(deps: McpManagerDeps) {
    this.deps = deps;
  }

  private markError(entry: McpServerEntry, e: unknown): void {
    entry.status = "error";
    entry.error = messageOf(e);
  }

  /** Record a server's config without connecting (disabled or dogfooded at boot). */
  declare(name: string, config: McpConfig, note?: string): void {
    const existing = this.servers.get(name);
    const enabled = config.enabled !== false;
    this.servers.set(name, {
      config,
      enabled,
      status:
        existing?.status === "connected"
          ? "connected"
          : enabled
            ? "disconnected"
            : "disabled",
      note,
    });
  }

  async connect(name: string, config: McpConfig): Promise<void> {
    this.declare(name, config);
    try {
      const client = await this.deps.connect(config);
      client.name = name;
      this.clients.set(name, client);
      const entry = this.servers.get(name)!;
      entry.status = "connected";
      entry.error = undefined;
    } catch (e) {
      this.markError(this.servers.get(name)!, e);
      throw e;
    }
  }

  /** Flip intent to enabled and connect; the response carries the final status. */
  async enable(name: string): Promise<McpServerStatusInfo> {
    const entry = this.servers.get(name);
    if (!entry) {
      return {
        status: "error",
        error: `MCP server "${name}" is not configured`,
      };
    }
    entry.enabled = true;
    entry.error = undefined;
    if (this.clients.has(name)) {
      entry.status = "connected";
      return this.info(entry);
    }
    try {
      const client = await this.deps.connect(entry.config);
      client.name = name;
      this.clients.set(name, client);
      entry.status = "connected";
    } catch (e) {
      this.markError(entry, e);
    }
    return this.info(entry);
  }

  /** Flip intent to disabled and disconnect. */
  async disable(name: string): Promise<McpServerStatusInfo> {
    const entry = this.servers.get(name);
    if (!entry) {
      return {
        status: "error",
        error: `MCP server "${name}" is not configured`,
      };
    }
    entry.enabled = false;
    entry.error = undefined;
    await this.disconnect(name);
    entry.status = "disabled";
    return this.info(entry);
  }

  /** Drop the transport without touching the enabled intent. */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      // ponytail: close can hang on a wedged transport; the daemon's request
      // timeout is the ceiling — per-close timeouts if it ever bites.
      await client.close();
      this.clients.delete(name);
    }
    const entry = this.servers.get(name);
    if (entry && entry.status !== "disabled") {
      entry.status = "disconnected";
    }
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.close();
    }
    this.clients.clear();
    for (const entry of this.servers.values()) {
      if (entry.status !== "disabled") entry.status = "disconnected";
    }
  }

  private info(entry: McpServerEntry): McpServerStatusInfo {
    return {
      status: entry.status,
      ...(entry.error !== undefined ? { error: entry.error } : {}),
      ...(entry.note !== undefined ? { note: entry.note } : {}),
    };
  }

  /** Status of every declared server: connected / disconnected / disabled / error. */
  status(): Record<string, McpServerStatusInfo> {
    const result: Record<string, McpServerStatusInfo> = {};
    for (const [name, entry] of this.servers) {
      result[name] = this.info(entry);
    }
    return result;
  }

  /**
   * Aggregate over connected clients. A client whose list call fails (dead
   * transport) is dropped with an `error` status — the others are unaffected.
   */
  private async aggregate<T>(
    extract: (client: McpClient) => Promise<T[]>
  ): Promise<Array<T & { clientName: string }>> {
    const all: Array<T & { clientName: string }> = [];
    for (const [clientName, client] of this.clients) {
      try {
        const items = await extract(client);
        for (const item of items) {
          all.push({ ...item, clientName });
        }
      } catch (e) {
        await this.disconnect(clientName);
        const entry = this.servers.get(clientName);
        if (entry) this.markError(entry, e);
      }
    }
    return all;
  }

  async listAllTools(): Promise<Array<McpToolInfo & { clientName: string }>> {
    return this.aggregate((client) => client.listTools());
  }

  async listAllPrompts(): Promise<
    Array<McpPromptInfo & { clientName: string }>
  > {
    return this.aggregate((client) => client.listPrompts());
  }

  async listAllResources(): Promise<
    Array<McpResourceInfo & { clientName: string }>
  > {
    return this.aggregate((client) => client.listResources());
  }

  toolName(clientName: string, toolName: string): string {
    return `${clientName}_${toolName}`;
  }

  async readResource(clientName: string, uri: string): Promise<ToolResult> {
    const client = this.clients.get(clientName);
    if (!client) {
      return {
        success: false,
        error: `MCP server "${clientName}" not connected`,
        code: "MCP_NOT_CONNECTED",
      };
    }
    try {
      const content = await client.readResource(uri);
      return { success: true, output: content };
    } catch (e: unknown) {
      return {
        success: false,
        error: (e as Error).message ?? "MCP resource read failed",
        code: "MCP_RESOURCE_ERROR",
      };
    }
  }

  async callTool(
    clientName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const client = this.clients.get(clientName);
    if (!client) {
      return {
        success: false,
        error: `MCP server "${clientName}" not connected`,
        code: "MCP_NOT_CONNECTED",
      };
    }
    try {
      const result = await client.callTool(toolName, args);
      return {
        success: true,
        output: typeof result === "string" ? result : JSON.stringify(result),
        data: result,
      };
    } catch (e: unknown) {
      return {
        success: false,
        error: (e as Error).message ?? "MCP tool call failed",
        code: "MCP_TOOL_ERROR",
      };
    }
  }
}
