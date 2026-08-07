import { execFile } from "node:child_process";
import { extname } from "node:path";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "../types";
import { DOCUMENT_EXTENSIONS } from "./read";

export interface GrepSearchData {
  metadata?: Record<string, unknown>;
  structured?: string;
  notes?: string[];
}

export interface GrepDeps {
  readDocument: (file: string, ctx: ToolContext) => Promise<string>;
  readMetadata?: (
    file: string,
    ctx: ToolContext
  ) => Promise<Record<string, unknown>>;
  readSearchExtras?: (file: string, ctx: ToolContext) => Promise<string>;
  readSearchData?: (file: string, ctx: ToolContext) => Promise<GrepSearchData>;
  officeExtractLimit?: number;
  listFiles?: (path: string, include?: string) => Promise<string[]>;
  resolveDocument?: (file: string, ctx: ToolContext) => Promise<string>;
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

async function matchRg(
  content: string,
  query: string,
  format: (line: string) => string
): Promise<string[]> {
  try {
    const output = await runRg(
      ["--no-heading", "--line-number", query],
      content
    );
    return output.trim().split(/\r?\n/).filter(Boolean).map(format);
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
  return matchRg(content, query, (line) => `${file}:${line}`);
}

async function matchMetadata(
  file: string,
  metadata: Record<string, unknown>,
  query: string
): Promise<string[]> {
  const ignoredKeys = new Set([
    "FileName",
    "Directory",
    "FileSize",
    "FileModifyDate",
    "FileAccessDate",
    "FileInodeChangeDate",
    "FilePermissions",
    "SourceFile",
  ]);
  const content = Object.entries(metadata)
    .filter(([key]) => !ignoredKeys.has(key))
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`
    )
    .join("\n");
  if (!content) return [];

  return matchRg(
    content,
    query,
    (line) => `Metadata match: ${file}:${line.replace(/^\d+:/, "")}`
  );
}

async function matchFilePaths(
  files: string[],
  query: string
): Promise<string[]> {
  if (!files.length) return [];
  return matchRg(
    files.join("\n"),
    query,
    (line) => `Path match: ${line.replace(/^\d+:/, "")}`
  );
}

export function createGrepTool(deps?: GrepDeps): ToolDefinition {
  return {
    name: "grep",
    description:
      "Search plain text, document contents, metadata, PDF annotations/bookmarks, and Excel formulas/comments. Returns matching lines with file paths and line numbers.",
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
        let files: string[] = [];
        let enumerationFailed = false;
        try {
          files = await (deps?.listFiles ?? listFiles)(target, params.include);
        } catch {
          enumerationFailed = true;
        }
        const extractable = files.filter((file) =>
          DOCUMENT_EXTENSIONS.has(extname(file).toLowerCase())
        );
        const plainFiles = files.filter(
          (file) => !DOCUMENT_EXTENSIONS.has(extname(file).toLowerCase())
        );
        const fileMatches = enumerationFailed
          ? []
          : await matchFilePaths(files, params.query);
        let plainMatches: string[] = [];
        if (!deps || enumerationFailed || plainFiles.length) {
          const args: string[] = [
            "--no-heading",
            "--line-number",
            params.query,
          ];
          if (!deps || enumerationFailed) {
            args.push(target);
            if (enumerationFailed) {
              for (const ext of DOCUMENT_EXTENSIONS) {
                args.push("--glob", `!*${ext}`);
              }
            }
          } else {
            args.push(...plainFiles);
          }
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
        const metadataMatches: string[] = [];
        const structuredMatches: string[] = [];
        let extractionFailed = 0;
        let metadataFailed = 0;
        let structuredFailed = 0;
        let searchDataFailed = 0;
        const searchDataNotes: string[] = [];

        for (const [index, file] of extractable.entries()) {
          const shouldExtract = index < filesToExtract.length;
          if (
            !shouldExtract &&
            !deps?.readMetadata &&
            !deps?.readSearchExtras &&
            !deps?.readSearchData
          )
            continue;

          let resolvedFile = file;
          try {
            const resolveDocument = deps!.resolveDocument;
            resolvedFile = resolveDocument
              ? await resolveDocument(file, ctx)
              : file;
          } catch {
            if (shouldExtract) extractionFailed++;
            if (deps?.readMetadata) metadataFailed++;
            if (deps?.readSearchExtras) structuredFailed++;
            if (deps?.readSearchData) searchDataFailed++;
            continue;
          }
          if (shouldExtract) {
            try {
              const content = await deps!.readDocument(resolvedFile, ctx);
              extractedMatches.push(
                ...(await matchExtractedText(file, content, params.query))
              );
            } catch {
              extractionFailed++;
            }
          }
          if (deps?.readSearchData) {
            try {
              const searchData = await deps.readSearchData(resolvedFile, ctx);
              if (searchData.metadata) {
                metadataMatches.push(
                  ...(await matchMetadata(
                    file,
                    searchData.metadata,
                    params.query
                  ))
                );
              }
              if (searchData.structured) {
                structuredMatches.push(
                  ...(await matchExtractedText(
                    file,
                    searchData.structured,
                    params.query
                  ))
                );
              }
              searchDataNotes.push(...(searchData.notes ?? []));
            } catch {
              searchDataFailed++;
            }
          } else {
            if (deps?.readMetadata) {
              try {
                metadataMatches.push(
                  ...(await matchMetadata(
                    file,
                    await deps.readMetadata(resolvedFile, ctx),
                    params.query
                  ))
                );
              } catch {
                metadataFailed++;
              }
            }
            if (deps?.readSearchExtras) {
              try {
                structuredMatches.push(
                  ...(await matchExtractedText(
                    file,
                    await deps.readSearchExtras(resolvedFile, ctx),
                    params.query
                  ))
                );
              } catch {
                structuredFailed++;
              }
            }
          }
        }

        const notes: string[] = [];
        if (enumerationFailed) {
          notes.push(
            "filename search and document extraction skipped because file enumeration failed"
          );
        }
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
        if (metadataFailed) {
          notes.push(`${metadataFailed} document metadata reads failed`);
        }
        if (structuredFailed) {
          notes.push(`${structuredFailed} document structure reads failed`);
        }
        if (searchDataFailed) {
          notes.push(
            `${searchDataFailed} document metadata and structure reads failed`
          );
        }
        notes.push(...searchDataNotes);

        const matches = [
          ...fileMatches,
          ...plainMatches,
          ...extractedMatches,
          ...metadataMatches,
          ...structuredMatches,
        ];
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
