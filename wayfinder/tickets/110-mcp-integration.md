# MCP Integration

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Agent System](111-agent-system.md)
**Blocked by**: [Tool System](106-tool-system.md), [Config System](103-config-system.md)
**Assignee**: _(unclaimed)_

## Question

Integrate MCP (Model Context Protocol) so openoffice can connect to external tool servers.

### Why MCP

- Standard protocol for AI tool integration
- Connect to Gmail, Google Calendar, Slack, etc.
- Community-built MCP servers for hundreds of services
- Future-proof extensibility

### Implementation

```ts
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

class McpManager {
  private clients = new Map<string, Client>();

  async connect(name: string, config: McpConfig): Promise<void> {
    let transport;
    if (config.type === 'local') {
      transport = new StdioClientTransport({
        command: config.command[0],
        args: config.command.slice(1),
        env: config.environment,
      });
    }

    const client = new Client({ name: 'openoffice', version: '0.1.0' });
    await client.connect(transport);
    this.clients.set(name, client);

    // Register MCP tools in tool registry
    const { tools } = await client.listTools();
    for (const mcpTool of tools) {
      registry.register({
        name: `mcp.${name}.${mcpTool.name}`,
        description: mcpTool.description,
        parameters: mcpTool.inputSchema,
        execute: async (params) => {
          const result = await client.callTool({ name: mcpTool.name, arguments: params });
          return { success: true, output: JSON.stringify(result) };
        },
      });
    }
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.close();
    }
  }
}
```

### Config

From `openoffice.json`:

```json
{
  "mcp": {
    "gmail": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-gmail"]
    }
  }
}
```

### What NOT to build

- No OAuth flow for MCP (add later for remote servers)
- No MCP server catalog (user configures manually)
- No hot-reload of MCP servers

### Reference

- MCP SDK: `@modelcontextprotocol/sdk@1.29.0` (patched in opencode)
- opencode MCP: `packages/opencode/src/mcp/index.ts` (1004 lines — complex)
- MCP servers: `https://github.com/modelcontextprotocol/servers`
