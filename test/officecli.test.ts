import { describe, expect, test } from "bun:test";
import {
  createOfficeCliTool,
  isMutating,
  parseError,
} from "../src/office/tool";

describe("isMutating", () => {
  test("set is mutating", () => expect(isMutating("set")).toBe(true));
  test("add is mutating", () => expect(isMutating("add")).toBe(true));
  test("remove is mutating", () => expect(isMutating("remove")).toBe(true));
  test("replace is mutating", () => expect(isMutating("replace")).toBe(true));
  test("batch is mutating", () => expect(isMutating("batch")).toBe(true));
  test("get is not mutating", () => expect(isMutating("get")).toBe(false));
  test("list is not mutating", () => expect(isMutating("list")).toBe(false));
  test("search is not mutating", () =>
    expect(isMutating("search")).toBe(false));
  test("view is not mutating", () => expect(isMutating("view")).toBe(false));
  test("info is not mutating", () => expect(isMutating("info")).toBe(false));
  test("create is not mutating", () =>
    expect(isMutating("create")).toBe(false));
  test("screenshot is not mutating", () =>
    expect(isMutating("screenshot")).toBe(false));
  test("close is not mutating", () => expect(isMutating("close")).toBe(false));
});

describe("parseError", () => {
  test("parses officecli JSON error shape", () => {
    const json = JSON.stringify({
      success: false,
      error: {
        error: "File not found",
        code: "FILE_NOT_FOUND",
        suggestion: "Check path",
      },
    });
    const result = parseError(json);
    expect(result.error).toBe("File not found");
    expect(result.code).toBe("FILE_NOT_FOUND");
  });

  test("handles non-JSON error output", () => {
    const result = parseError("random error text");
    expect(result.error).toBe("random error text");
    expect(result.code).toBeUndefined();
  });

  test("handles empty string", () => {
    const result = parseError("");
    expect(result.error).toBe("Unknown error");
  });
});

describe("officecli tool", () => {
  test("has correct name and description", () => {
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async () => "",
    });
    expect(tool.name).toBe("officecli");
    expect(tool.description).toContain("document");
  });

  test("returns error when not installed", async () => {
    const tool = createOfficeCliTool({
      checkInstalled: async () => false,
      execCli: async () => "",
    });
    const result = await tool.execute({ command: "get", file: "test.docx" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not installed");
      expect(result.code).toBe("NOT_INSTALLED");
    }
  });

  test("returns success with JSON output", async () => {
    const mockOutput = JSON.stringify({
      success: true,
      data: { content: "hello" },
    });
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async () => mockOutput,
    });
    const result = await tool.execute({ command: "get", file: "test.docx" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        success: true,
        data: { content: "hello" },
      });
    }
  });

  test("parses error from officecli JSON output", async () => {
    const errorOutput = JSON.stringify({
      success: false,
      error: { error: "Invalid path", code: "INVALID_PATH" },
    });
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async () => {
        const err = new Error("officecli exited with code 1");
        (err as any).stdout = errorOutput;
        throw err;
      },
    });
    const result = await tool.execute({ command: "get", file: "test.docx" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid path");
      expect(result.code).toBe("INVALID_PATH");
    }
  });

  test("handles ENOENT gracefully", async () => {
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async () => {
        const err: NodeJS.ErrnoException = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      },
    });
    const result = await tool.execute({ command: "get", file: "test.docx" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not installed");
    }
  });

  test("uses 60s timeout for batch commands", async () => {
    let timeoutUsed = 0;
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (_args: string[], opts?: { timeout?: number }) => {
        timeoutUsed = opts?.timeout ?? 0;
        return '{"success":true}';
      },
    });
    await tool.execute({ command: "batch", file: "test.xlsx", operations: [] });
    expect(timeoutUsed).toBe(60000);
  });

  test("uses 30s timeout for non-batch commands", async () => {
    let timeoutUsed = 0;
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (_args: string[], opts?: { timeout?: number }) => {
        timeoutUsed = opts?.timeout ?? 0;
        return '{"success":true}';
      },
    });
    await tool.execute({ command: "get", file: "test.docx" });
    expect(timeoutUsed).toBe(30000);
  });
});
