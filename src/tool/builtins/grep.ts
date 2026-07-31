import { execFileSync } from "node:child_process";
import { z } from "zod";
import type { ToolDefinition } from "../types";

export function createGrepTool(): ToolDefinition {
  return {
    name: "grep",
    description:
      "Search file contents using ripgrep. Returns matching lines with file paths and line numbers.",
    parameters: z.object({
      query: z.string().describe("Search pattern (regex supported)"),
      path: z.string().optional().describe("File or directory to search in"),
      include: z
        .string()
        .optional()
        .describe("File pattern to include (e.g., *.ts)"),
    }),
    execute: async (params) => {
      try {
        const args: string[] = ["--no-heading", "--line-number", params.query];
        if (params.path) args.push(params.path);
        if (params.include) args.push("--glob", params.include);

        const output = execFileSync("rg", args, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 10000,
          maxBuffer: 1024 * 1024,
        });
        return {
          success: true,
          output: output.trim() || "No matches found",
        };
      } catch (e: any) {
        if (e.status === 1) {
          return { success: true, output: "No matches found" };
        }
        return {
          success: false,
          error: e.message ?? "Failed to search",
          code: "GREP_ERROR",
        };
      }
    },
  };
}
