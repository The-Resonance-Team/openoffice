import type { z } from "zod";

export interface ToolContext {
  sessionID: string;
  cwd?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType;
  // oxlint-disable-next-line typescript/no-explicit-any
  execute: (params: any, ctx: ToolContext) => Promise<ToolResult>;
}

export type ToolResult =
  | { success: true; output: string; data?: unknown }
  | { success: false; error: string; code?: string };
