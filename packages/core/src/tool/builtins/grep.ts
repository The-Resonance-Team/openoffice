import { execFile } from "node:child_process";
import { extname } from "node:path";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "../types";
import { DOCUMENT_EXTENSIONS } from "./read";

export interface GrepDeps {
  readDocument: (file: string, ctx: ToolContext) => Promise<string>;
  officeExtractLimit?: number;
}

const MAX_OFFICE_EXTRACT_LIMIT = 20;

function isNoMatch(error: any): boolean {
  return error.status === 1 || error.code === 1 || error.code === "1";
}

function runRg(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "rg",
      args,
      {
        encoding: "utf-8",
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      }
    );
    if (input !== undefined) child.stdin?.end(input);
  });
}

async function listFiles(path: string, include?: string): Promise<string[]> {
  const args = ["--files", path];
  if (include) args.push("--glob", include);

  try {
    const output = await runRg(args);
    return output.trim() ? output.trim().split(/\r?\n/) : [];
  } catch (e: any) {
    if (isNoMatch(e)) return [];
    throw e;
  }
}

async function matchExtractedText(
  file: string,
  content: string,
  query: string
) {
  try {
    const output = await runRg(
      ["--no-heading", "--line-number", query],
      content
    );
    return output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `${file}:${line}`);
  } catch (e: any) {
    if (isNoMatch(e)) return [];
    throw e;
  }
}

export function createGrepTool(deps?: GrepDeps): ToolDefinition {
  return {
    name: "grep",
    description:
      "Search plain text and AnyDoc-supported document contents. Returns matching lines with file paths and line numbers.",
    parameters: z.object({
      query: z.string().describe("Search pattern (regex supported)"),
      path: z.string().optional().describe("File or directory to search in"),
      include: z
        .string()
        .optional()
        .describe("File pattern to include (e.g., *.ts)"),
    }),
    execute: async (params, ctx) => {
      try {
        const target = params.path ?? ctx.cwd ?? process.cwd();
        const args: string[] = ["--no-heading", "--line-number", params.query];
        const files = deps ? await listFiles(target, params.include) : [];
        const extractable = files.filter((file) =>
          DOCUMENT_EXTENSIONS.has(extname(file).toLowerCase())
        );
        const plainFiles = files.filter(
          (file) => !DOCUMENT_EXTENSIONS.has(extname(file).toLowerCase())
        );
        let plainMatches: string[] = [];
        if (!deps || plainFiles.length) {
          if (deps) args.push(...plainFiles);
          else args.push(target);
          if (params.include) args.push("--glob", params.include);

          try {
            const output = await runRg(args);
            plainMatches = output.trim() ? [output.trim()] : [];
          } catch (e: any) {
            if (!isNoMatch(e)) throw e;
          }
        }
        const limit = Math.max(
          0,
          Math.min(
            MAX_OFFICE_EXTRACT_LIMIT,
            deps?.officeExtractLimit ?? MAX_OFFICE_EXTRACT_LIMIT
          )
        );
        const filesToExtract = extractable.slice(0, limit);
        const extractionSkipped = extractable.length - filesToExtract.length;
        const extractedMatches: string[] = [];
        let extractionFailed = 0;

        for (const file of filesToExtract) {
          try {
            const content = await deps!.readDocument(file, ctx);
            extractedMatches.push(
              ...(await matchExtractedText(file, content, params.query))
            );
          } catch {
            extractionFailed++;
          }
        }

        const notes: string[] = [];
        if (extractionSkipped) {
          notes.push(
            `${extractionSkipped} document files skipped due to extraction limit`
          );
        }
        if (extractionFailed) {
          notes.push(
            `${extractionFailed} document files skipped due to extraction failure`
          );
        }

        const matches = [...plainMatches, ...extractedMatches];
        return {
          success: true,
          output: [
            ...(matches.length ? matches : ["No matches found"]),
            ...notes,
          ].join("\n"),
        };
      } catch (e: any) {
        if (isNoMatch(e)) {
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
