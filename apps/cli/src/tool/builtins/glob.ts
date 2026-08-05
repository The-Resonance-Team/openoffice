import { Glob } from "bun";
import { z } from "zod";
import type { ToolDefinition } from "../types";

export function createGlobTool(): ToolDefinition {
  return {
    name: "glob",
    description:
      "Find files by glob pattern. Returns matching file paths. Use ** for recursive matching.",
    parameters: z.object({
      pattern: z
        .string()
        .describe("Glob pattern (e.g., **/*.ts, src/**/*.test.ts)"),
      path: z
        .string()
        .optional()
        .describe("Directory to search in (defaults to cwd)"),
    }),
    execute: async (params, ctx) => {
      try {
        const glob = new Glob(params.pattern);
        const matches: string[] = [];
        for await (const match of glob.scan({
          cwd: params.path ?? ctx.cwd ?? process.cwd(),
        })) {
          matches.push(match);
        }
        return {
          success: true,
          output: matches.length > 0 ? matches.join("\n") : "No files found",
          data: matches,
        };
      } catch (e: any) {
        return {
          success: false,
          error: e.message ?? "Failed to search files",
          code: "GLOB_ERROR",
        };
      }
    },
  };
}
