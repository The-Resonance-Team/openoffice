import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../tool";

const MUTATING = new Set(["set", "add", "remove", "replace", "batch"]);

export function isMutating(command: string): boolean {
  return MUTATING.has(command);
}

export function parseError(output: string): {
  error: string;
  code?: string;
  suggestion?: string;
} {
  if (!output) return { error: "Unknown error" };
  try {
    const parsed = JSON.parse(output);
    if (parsed.error?.error) {
      return {
        error: parsed.error.error,
        code: parsed.error.code,
        suggestion: parsed.error.suggestion,
      };
    }
  } catch {
    // not JSON
  }
  return { error: output };
}

export interface OfficeCliDeps {
  checkInstalled: () => Promise<boolean>;
  execCli: (args: string[], opts?: { timeout?: number }) => Promise<string>;
}

export function createOfficeCliTool(deps: OfficeCliDeps): ToolDefinition {
  return {
    name: "officecli",
    description:
      "Create, read, and edit Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) documents. Use --json for structured output. Run 'officecli help' when unsure about commands or properties.",
    parameters: z.object({
      command: z.enum([
        "get",
        "set",
        "add",
        "remove",
        "replace",
        "batch",
        "list",
        "search",
        "screenshot",
        "view",
        "close",
        "create",
        "info",
      ]),
      file: z.string().describe("Path to the document"),
      path: z
        .string()
        .optional()
        .describe("DOM path (e.g., /body/p[@paraId=00100000])"),
      props: z
        .record(z.string(), z.any())
        .optional()
        .describe("Properties to set"),
      operations: z.array(z.any()).optional().describe("Batch operations"),
      output: z.string().optional().describe("Output path for screenshots"),
      format: z.string().optional().describe("Output format (png, html)"),
      type: z.string().optional().describe("Element type for add commands"),
      query: z.string().optional().describe("Search query"),
      content: z.string().optional().describe("Content for replace commands"),
    }),
    execute: async (params): Promise<ToolResult> => {
      if (!(await deps.checkInstalled())) {
        return {
          success: false,
          error:
            "officecli is not installed. Install: npm install -g officecli",
          code: "NOT_INSTALLED",
        };
      }

      const args: string[] = [params.command, params.file, "--json"];
      if (params.path) args.push(params.path);
      if (params.type) args.push("--type", params.type);
      if (params.query) args.push("--query", params.query);
      if (params.content) args.push("--content", params.content);
      if (params.output) args.push("--output", params.output);
      if (params.format) args.push("--format", params.format);
      if (params.props) args.push("--props", JSON.stringify(params.props));
      if (params.operations)
        args.push("--commands", JSON.stringify(params.operations));

      const timeout = params.command === "batch" ? 60000 : 30000;

      try {
        const output = await deps.execCli(args, { timeout });
        const parsed = JSON.parse(output);
        return { success: true, output, data: parsed };
      } catch (e: any) {
        if (e.code === "ENOENT") {
          return {
            success: false,
            error:
              "officecli is not installed. Install: npm install -g officecli",
            code: "NOT_INSTALLED",
          };
        }

        const stdout = e.stdout ?? "";
        const parsed = parseError(stdout);
        return {
          success: false,
          error: parsed.error,
          code: parsed.code,
        };
      }
    },
  };
}
