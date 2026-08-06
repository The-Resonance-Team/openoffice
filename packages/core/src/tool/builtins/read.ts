import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "../types";
import type { DraftManager } from "../../draft";

export const OFFICE_EXTENSIONS = new Set([
  ".docx",
  ".xlsx",
  ".pptx",
  ".docm",
  ".xlsm",
  ".pptm",
  ".dotx",
  ".xltx",
  ".potx",
]);
export const LEGACY_OFFICE_EXTENSIONS = new Set([
  ".doc",
  ".xls",
  ".ppt",
  ".dot",
  ".xlt",
  ".pot",
]);
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".xml",
  ".html",
  ".css",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".kt",
]);

export interface ReadDeps {
  readOffice: (file: string, ctx: ToolContext) => Promise<string>;
  readPdf?: (file: string, ctx: ToolContext) => Promise<string>;
  draftManager?: DraftManager;
}

export function createReadTool(deps: ReadDeps): ToolDefinition {
  return {
    name: "read",
    description:
      "Read file contents. Auto-detects format: Office documents (.docx/.xlsx/.pptx and OpenXML variants) via officecli, .pdf via pdftotext, plain text for everything else. Always use this to read any file.",
    parameters: z.object({
      file: z.string().describe("Path to the file to read"),
    }),
    execute: async (params, ctx) => {
      const ext = extname(params.file).toLowerCase();

      // Draft-aware read: follows the session's draft once one exists and
      // fires the orphan scan on files with abandoned drafts. Resolved before
      // the existence check so new-file drafts (no real file yet) are readable.
      let file = params.file;
      if (deps.draftManager && OFFICE_EXTENSIONS.has(ext)) {
        const resolved = await deps.draftManager.resolve(
          params.file,
          ctx.sessionID,
          false
        );
        if (resolved.lockError) {
          return {
            success: false,
            error: resolved.lockError,
            code: "LOCKED",
          };
        }
        file = resolved.path!;
      }

      if (!existsSync(file)) {
        return {
          success: false,
          error: `File not found: ${params.file}`,
          code: "FILE_NOT_FOUND",
        };
      }

      if (OFFICE_EXTENSIONS.has(ext)) {
        try {
          const content = await deps.readOffice(file, ctx);
          return { success: true, output: content };
        } catch (e: any) {
          return {
            success: false,
            error: e.message ?? "Failed to read office document",
            code: "OFFICE_READ_ERROR",
          };
        }
      }

      if (ext === ".pdf") {
        if (!deps.readPdf) {
          return {
            success: false,
            error: "PDF reading is not available (pdftotext not configured)",
            code: "PDF_READ_ERROR",
          };
        }
        try {
          const content = await deps.readPdf(params.file, ctx);
          return { success: true, output: content };
        } catch (e: any) {
          return {
            success: false,
            error: e.message ?? "Failed to read PDF",
            code: "PDF_READ_ERROR",
          };
        }
      }

      if (LEGACY_OFFICE_EXTENSIONS.has(ext)) {
        return {
          success: false,
          error: `Legacy binary Office format (.${ext.slice(1)}) is not supported. Use the convert tool to convert it to the OpenXML equivalent (.docx/.xlsx/.pptx) first`,
          code: "LEGACY_FORMAT",
        };
      }

      if (TEXT_EXTENSIONS.has(ext) || !ext) {
        try {
          const content = readFileSync(params.file, "utf-8");
          return { success: true, output: content };
        } catch (e: any) {
          return {
            success: false,
            error: e.message ?? "Failed to read file",
            code: "READ_ERROR",
          };
        }
      }

      // Unknown extension — try text, might be binary
      try {
        const content = readFileSync(params.file, "utf-8");
        return { success: true, output: content };
      } catch (e: any) {
        return {
          success: false,
          error: `Cannot read ${ext} files: ${e.message}`,
          code: "UNSUPPORTED_FORMAT",
        };
      }
    },
  };
}
