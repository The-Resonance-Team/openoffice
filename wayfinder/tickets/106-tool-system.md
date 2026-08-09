# Tool System

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [officecli Tool](108-officecli-tool.md), [Read-Only Tools](109-read-only-tools.md)
**Blocked by**: [LLM Provider Abstraction](105-llm-providers.md)
**Assignee**: _(unclaimed)_

## Question

Implement the tool system — how tools are defined, registered, and executed by the LLM.

### Tool definition

```ts
import { z } from 'zod/v4';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (params: any) => Promise<ToolResult>;
}

type ToolResult =
  { success: true; output: string; data?: any } | { success: false; error: string; code?: string };
```

### Tool registry

```ts
class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // Filter tools by agent permissions
  filter(allowedTools: string[]): ToolDefinition[] {
    return this.list().filter((t) => allowedTools.includes(t.name));
  }
}

export const registry = new ToolRegistry();
```

### LLM integration

Convert tool definitions to Vercel AI SDK format:

```ts
import { tool } from 'ai';

function toAITool(def: ToolDefinition) {
  return tool({
    description: def.description,
    parameters: def.parameters,
    execute: async (params) => {
      const result = await def.execute(params);
      if (!result.success) throw new Error(result.error);
      return result.output;
    },
  });
}
```

### Tool execution flow

1. LLM requests tool call
2. Registry looks up tool by name
3. Parameters validated against schema
4. Tool executes
5. Result returned to LLM
6. Event emitted (tool:start, tool:done)

### What NOT to build

- No permission system (v1: all tools available to all agents)
- No tool output streaming (return complete results)
- No MCP tools yet (add in ticket 110)
- No tool timeout (add later if needed)

### Reference

- opencode tools: `packages/opencode/src/tool/` (41 files — way too complex for v1)
- opencode core tools: `packages/core/src/tool/` (20 files)
- Vercel AI SDK tools: `tool()` function from `ai` package
