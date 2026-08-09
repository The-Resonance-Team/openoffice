import { tool, type ToolSet } from 'ai';
import type { z } from 'zod';
import type { ToolDefinition } from './types';
import { emit } from '../events';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register<P extends z.ZodType>(def: ToolDefinition<P>): void {
    this.tools.set(def.name, def);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  toAITools(): ToolSet {
    const out: ToolSet = {};
    for (const [name, def] of this.tools) {
      out[name] = tool({
        description: def.description,
        inputSchema: def.parameters,
        execute: (params: unknown) => def.execute(params, { sessionID: '' }),
      });
    }
    return out;
  }

  toAIToolsWithEvents(sessionID: string, cwd?: string): ToolSet {
    const out: ToolSet = {};
    for (const [name, def] of this.tools) {
      out[name] = tool({
        description: def.description,
        inputSchema: def.parameters,
        execute: async (params: unknown) => {
          emit('tool:start', { sessionID, tool: name, params });
          const result = await def.execute(params, { sessionID, cwd });
          emit('tool:done', { sessionID, tool: name, result });
          return result;
        },
      });
    }
    return out;
  }
}
