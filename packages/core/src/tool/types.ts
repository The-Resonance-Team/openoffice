import type { z } from 'zod';

export interface ToolContext {
  sessionID: string;
  cwd?: string;
}

export interface ToolDefinition<P extends z.ZodType = z.ZodType<unknown>> {
  name: string;
  description: string;
  parameters: P;
  // method syntax: params check bivariantly (TS 6 kept method bivariance), so
  // implementers may destructure the inferred schema type against the default
  execute(params: z.infer<P>, ctx: ToolContext): Promise<ToolResult>;
}

export type ToolResult =
  | { success: true; output: string; data?: unknown }
  | { success: false; error: string; code?: string };
