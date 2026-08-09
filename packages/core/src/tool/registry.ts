import { tool } from "ai";
import type { ToolDefinition } from "./types";
import { emit } from "../events";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    this.tools.set(def.name, def);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  // ponytail: return type is `any` — AI SDK v7's Tool type is deeply generic and
  // not worth fighting. The runtime shape is correct; consumers pass this straight
  // to streamText() which validates it.
  // oxlint-disable-next-line typescript/no-explicit-any
  toAITools(): Record<string, any> {
    // oxlint-disable-next-line typescript/no-explicit-any
    const out: Record<string, any> = {};
    for (const [name, def] of this.tools) {
      out[name] = tool({
        description: def.description,
        inputSchema: def.parameters,
        // oxlint-disable-next-line typescript/no-explicit-any
        execute: (params: any) => def.execute(params, { sessionID: "" }),
      });
    }
    return out;
  }

  // oxlint-disable-next-line typescript/no-explicit-any
  toAIToolsWithEvents(sessionID: string, cwd?: string): Record<string, any> {
    // oxlint-disable-next-line typescript/no-explicit-any
    const out: Record<string, any> = {};
    for (const [name, def] of this.tools) {
      out[name] = tool({
        description: def.description,
        inputSchema: def.parameters,
        // oxlint-disable-next-line typescript/no-explicit-any
        execute: async (params: any) => {
          emit("tool:start", { sessionID, tool: name, params });
          const result = await def.execute(params, { sessionID, cwd });
          emit("tool:done", { sessionID, tool: name, result });
          return result;
        },
      });
    }
    return out;
  }
}
