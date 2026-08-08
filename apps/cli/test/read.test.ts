import { describe, expect, test } from "bun:test";
import { createReadTool, type ToolResult } from "@openoffice/core";

const ctx = { sessionID: "test-session" };

function fakeMcp(
  handler: (clientName: string, uri: string) => Promise<ToolResult>
) {
  return { readResource: handler };
}

describe("read tool: mcp:// dispatch", () => {
  test("resolves an mcp:// reference via the named server's readResource", async () => {
    let called: [string, string] | undefined;
    const tool = createReadTool({
      readDocument: async () => "unused",
      mcp: fakeMcp(async (clientName, uri) => {
        called = [clientName, uri];
        return { success: true, output: "hello from resource" };
      }),
    });

    const ref = `mcp://files/${encodeURIComponent("mem://notes/hello")}`;
    const result = await tool.execute({ file: ref }, ctx);

    expect(result).toEqual({ success: true, output: "hello from resource" });
    expect(called).toEqual(["files", "mem://notes/hello"]);
  });

  test("passes through the server's failure result", async () => {
    const tool = createReadTool({
      readDocument: async () => "unused",
      mcp: fakeMcp(async () => ({
        success: false,
        error: `MCP server "files" not connected`,
        code: "MCP_NOT_CONNECTED",
      })),
    });

    const result = await tool.execute(
      { file: `mcp://files/${encodeURIComponent("mem://x")}` },
      ctx
    );
    expect(result).toEqual({
      success: false,
      error: `MCP server "files" not connected`,
      code: "MCP_NOT_CONNECTED",
    });
  });

  test("fails cleanly when no MCP support is wired in", async () => {
    const tool = createReadTool({ readDocument: async () => "unused" });
    const result = await tool.execute(
      { file: `mcp://files/${encodeURIComponent("mem://x")}` },
      ctx
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("MCP_RESOURCE_ERROR");
  });

  test("preserves server-name case (no URL-class lowercasing)", async () => {
    let called: [string, string] | undefined;
    const tool = createReadTool({
      readDocument: async () => "unused",
      mcp: fakeMcp(async (clientName, uri) => {
        called = [clientName, uri];
        return { success: true, output: "ok" };
      }),
    });

    const ref = `mcp://MyServer/${encodeURIComponent("mem://notes/hello")}`;
    const result = await tool.execute({ file: ref }, ctx);
    expect(result.success).toBe(true);
    expect(called).toEqual(["MyServer", "mem://notes/hello"]);
  });

  test("rejects a malformed mcp:// reference", async () => {
    const tool = createReadTool({
      readDocument: async () => "unused",
      mcp: fakeMcp(async () => ({ success: true, output: "never" })),
    });
    for (const bad of ["mcp://", "mcp:///nohost", "mcp://files/%zz"]) {
      const result = await tool.execute({ file: bad }, ctx);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MCP_RESOURCE_ERROR");
    }
  });

  test("leaves regular file paths alone", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "openoffice-read-"));
    const file = join(dir, "hello.txt");
    writeFileSync(file, "plain text");
    const tool = createReadTool({
      readDocument: async () => "document text",
    });
    const result = await tool.execute({ file }, ctx);
    expect(result).toEqual({ success: true, output: "plain text" });
  });
});
