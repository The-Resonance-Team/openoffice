import type { ToolResult } from "../tool";

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpClient {
  name: string;
  listTools(): Promise<McpToolInfo[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface McpConfig {
  type: "local" | "remote";
  command?: string[];
  url?: string;
  environment?: Record<string, string>;
}

export interface McpManagerDeps {
  connect(config: McpConfig): Promise<McpClient>;
}

export class McpManager {
  private clients = new Map<string, McpClient>();
  private deps: McpManagerDeps;

  constructor(deps: McpManagerDeps) {
    this.deps = deps;
  }

  async connect(name: string, config: McpConfig): Promise<void> {
    const client = await this.deps.connect(config);
    client.name = name;
    this.clients.set(name, client);
  }

  async listAllTools(): Promise<Array<McpToolInfo & { clientName: string }>> {
    const allTools: Array<McpToolInfo & { clientName: string }> = [];
    for (const [clientName, client] of this.clients) {
      const tools = await client.listTools();
      for (const tool of tools) {
        allTools.push({ ...tool, clientName });
      }
    }
    return allTools;
  }

  toolName(clientName: string, toolName: string): string {
    return `${clientName}_${toolName}`;
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
    } catch (e: any) {
      return {
        success: false,
        error: e.message ?? "MCP tool call failed",
        code: "MCP_TOOL_ERROR",
      };
    }
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.close();
    }
    this.clients.clear();
  }

  status(): Record<string, "connected" | "disconnected"> {
    const result: Record<string, "connected" | "disconnected"> = {};
    for (const name of this.clients.keys()) {
      result[name] = "connected";
    }
    return result;
  }
}
