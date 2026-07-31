import type { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (params: any) => Promise<ToolResult>;
}

export type ToolResult =
  | { success: true; output: string; data?: unknown }
  | { success: false; error: string; code?: string };
