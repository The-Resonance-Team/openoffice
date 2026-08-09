import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import { z } from "zod";
import type { ToolContext, ToolDefinition, ToolResult } from "../types";
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
export const DOCUMENT_EXTENSIONS = new Set([
  ...OFFICE_EXTENSIONS,
  ...LEGACY_OFFICE_EXTENSIONS,
  ".xlsb",
  ".pps",
  ".ppsx",
  ".ppsm",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".epub",
  ".pdf",
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
  readDocument: (file: string, ctx: ToolContext) => Promise<string>;
  readPdf?: (file: string) => Promise<string>;
  draftManager?: DraftManager;
  /** MCP resource reader (the daemon's McpManager); absent when unsupported. */
  mcp?: {
    readResource: (clientName: string, uri: string) => Promise<ToolResult>;
  };
}

// ADR 0030: mcp://{serverName}/{encodeURIComponent(resourceUri)} — host is the
// configured server name, path is the resource's own URI, percent-encoded.
// Split on the first "/" of the raw string rather than the URL class: URL
// lowercases and decodes the host, but server names are case-sensitive.
export function readMcpReference(
  ref: string,
  mcp: ReadDeps["mcp"]
): Promise<ToolResult> {
  const fail = (error: string): ToolResult => ({
    success: false,
    error,
    code: "MCP_RESOURCE_ERROR",
  });
  if (!mcp) {
    return Promise.resolve(
      fail(`Cannot resolve ${ref}: MCP resources are not available`)
    );
  }
  const rest = ref.slice("mcp://".length);
  const slash = rest.indexOf("/");
  const clientName = slash === -1 ? rest : rest.slice(0, slash);
  const encoded = slash === -1 ? "" : rest.slice(slash + 1);
  let resourceUri: string;
  try {
    resourceUri = decodeURIComponent(encoded);
  } catch {
    return Promise.resolve(fail(`Malformed mcp:// reference: ${ref}`));
  }
  if (!clientName || !resourceUri) {
    return Promise.resolve(fail(`Malformed mcp:// reference: ${ref}`));
  }
  return mcp.readResource(clientName, resourceUri);
}

export function createReadTool(deps: ReadDeps): ToolDefinition {
  return {
    name: "read",
    description:
      "Read file contents. Auto-detects Office, OpenDocument, RTF, EPUB, and PDF files via AnyDoc, plain text for everything else. Always use this to read any file.",
    parameters: z.object({
      file: z.string().describe("Path to the file to read"),
    }),
    execute: async (params, ctx) => {
      // MCP resource reference (ADR 0030) — never a filesystem path.
      if (params.file.startsWith("mcp://")) {
        return readMcpReference(params.file, deps.mcp);
      }
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

      if (ext === ".pdf" && deps.readPdf) {
        try {
          const content = await deps.readPdf(file);
          return { success: true, output: content };
        } catch (e: unknown) {
          const err = e as { code?: string; message?: string };
          return {
            success: false,
            error: err.message ?? "Failed to read PDF",
            // ponytail: preserve known error codes — PDF_UNSUPPORTED_PLATFORM tells the agent what to install
            code:
              err.code === "PDF_NO_TEXT_LAYER" ||
              err.code === "PDF_UNSUPPORTED_PLATFORM"
                ? err.code
                : "PDF_READ_ERROR",
          };
        }
      }

      if (DOCUMENT_EXTENSIONS.has(ext)) {
        try {
          const content = await deps.readDocument(file, ctx);
          return { success: true, output: content };
        } catch (e: unknown) {
          return {
            success: false,
            error: (e as Error).message ?? "Failed to read office document",
            code: ext === ".pdf" ? "PDF_READ_ERROR" : "DOCUMENT_READ_ERROR",
          };
        }
      }

      if (TEXT_EXTENSIONS.has(ext) || !ext) {
        try {
          const content = readFileSync(params.file, "utf-8");
          return { success: true, output: content };
        } catch (e: unknown) {
          return {
            success: false,
            error: (e as Error).message ?? "Failed to read file",
            code: "READ_ERROR",
          };
        }
      }

      // Unknown extension — try text, might be binary
      try {
        const content = readFileSync(params.file, "utf-8");
        return { success: true, output: content };
      } catch (e: unknown) {
        return {
          success: false,
          error: `Cannot read ${ext} files: ${(e as Error).message}`,
          code: "UNSUPPORTED_FORMAT",
        };
      }
    },
  };
}
