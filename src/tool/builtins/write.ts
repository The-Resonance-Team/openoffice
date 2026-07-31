import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import type { ToolDefinition } from "../types";

export function createWriteTool(): ToolDefinition {
  return {
    name: "write",
    description:
      "Write content to a file. Creates parent directories if needed. For Office documents (.docx/.xlsx/.pptx) use officecli instead.",
    parameters: z.object({
      file: z.string().describe("Path to the file to write"),
      content: z.string().describe("Content to write"),
    }),
    execute: async (params) => {
      try {
        mkdirSync(dirname(params.file), { recursive: true });
        writeFileSync(params.file, params.content, "utf-8");
        return {
          success: true,
          output: `Wrote ${params.content.length} bytes to ${params.file}`,
        };
      } catch (e: any) {
        return {
          success: false,
          error: e.message ?? "Failed to write file",
          code: "WRITE_ERROR",
        };
      }
    },
  };
}
