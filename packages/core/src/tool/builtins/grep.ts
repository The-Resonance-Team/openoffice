import { execFileSync } from "node:child_process";
import { extname } from "node:path";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "../types";
import { OFFICE_EXTENSIONS, LEGACY_OFFICE_EXTENSIONS } from "./read";

export interface GrepDeps {
  readOffice: (file: string, ctx: ToolContext) => Promise<string>;
  readPdf?: (file: string, ctx: ToolContext) => Promise<string>;
  officeExtractLimit?: number;
}

const DEFAULT_OFFICE_EXTRACT_LIMIT = 20;

function listFiles(path: string, include?: string): string[] {
  const args = ["--files", path];
  if (include) args.push("--glob", include);

  try {
    const output = execFileSync("rg", args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    return output.trim() ? output.trim().split(/\r?\n/) : [];
  } catch (e: any) {
    if (e.status === 1) return [];
    throw e;
  }
}

function matchExtractedText(file: string, content: string, regex: RegExp) {
  return content
    .split(/\r?\n/)
    .flatMap((line, index) =>
      regex.test(line) ? [`${file}:${index + 1}:${line}`] : []
    );
}

export function createGrepTool(deps?: GrepDeps): ToolDefinition {
  return {
    name: "grep",
    description:
      "Search plain text, Office, and PDF file contents. Returns matching lines with file paths and line numbers.",
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
        const args: string[] = ["--no-heading", "--line-number", params.query];
        if (params.path) args.push(params.path);
        else args.push(ctx.cwd ?? process.cwd());
        if (params.include) args.push("--glob", params.include);

        let plainMatches: string[] = [];
        try {
          const output = execFileSync("rg", args, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 10000,
            maxBuffer: 1024 * 1024,
          });
          plainMatches = output.trim() ? [output.trim()] : [];
        } catch (e: any) {
          if (e.status !== 1) throw e;
        }
        const target = params.path ?? ctx.cwd ?? process.cwd();
        const files = deps ? listFiles(target, params.include) : [];
        const officeFiles = files.filter((file) =>
          OFFICE_EXTENSIONS.has(extname(file).toLowerCase())
        );
        const pdfFiles = files.filter(
          (file) => extname(file).toLowerCase() === ".pdf"
        );
        const legacyCount = files.filter((file) =>
          LEGACY_OFFICE_EXTENSIONS.has(extname(file).toLowerCase())
        ).length;
        const extractable = [...officeFiles, ...pdfFiles];
        const limit = Math.max(
          0,
          deps?.officeExtractLimit ?? DEFAULT_OFFICE_EXTRACT_LIMIT
        );
        const filesToExtract = extractable.slice(0, limit);
        const extractionSkipped = extractable.length - filesToExtract.length;
        const regex = new RegExp(params.query);
        const extractedMatches: string[] = [];
        let extractionFailed = 0;

        for (const file of filesToExtract) {
          try {
            const ext = extname(file).toLowerCase();
            const content =
              ext === ".pdf"
                ? deps?.readPdf
                  ? await deps.readPdf(file, ctx)
                  : null
                : await deps?.readOffice(file, ctx);
            if (content !== null && content !== undefined) {
              extractedMatches.push(
                ...matchExtractedText(file, content, regex)
              );
            } else {
              extractionFailed++;
            }
          } catch {
            extractionFailed++;
          }
        }

        const notes: string[] = [];
        if (legacyCount) {
          notes.push(
            `${legacyCount} legacy files skipped — convert to OpenXML first`
          );
        }
        if (extractionSkipped) {
          notes.push(
            `${extractionSkipped} office/PDF files skipped due to extraction limit`
          );
        }
        if (extractionFailed) {
          notes.push(
            `${extractionFailed} office/PDF files skipped due to extraction failure`
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
