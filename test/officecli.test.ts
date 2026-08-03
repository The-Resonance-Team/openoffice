import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createOfficeCliTool, isMutating, parseError } from "../src/office";
import { DraftManager } from "../src/draft";
import { HistoryStore } from "../src/history";

describe("isMutating", () => {
  test("set is mutating", () => expect(isMutating("set")).toBe(true));
  test("add is mutating", () => expect(isMutating("add")).toBe(true));
  test("remove is mutating", () => expect(isMutating("remove")).toBe(true));
  test("move is mutating", () => expect(isMutating("move")).toBe(true));
  test("swap is mutating", () => expect(isMutating("swap")).toBe(true));
  test("batch is mutating", () => expect(isMutating("batch")).toBe(true));
  test("import is mutating", () => expect(isMutating("import")).toBe(true));
  test("merge is mutating", () => expect(isMutating("merge")).toBe(true));
  test("raw-set is mutating", () => expect(isMutating("raw-set")).toBe(true));
  test("refresh is mutating", () => expect(isMutating("refresh")).toBe(true));
  test("save is mutating", () => expect(isMutating("save")).toBe(true));
  test("close is mutating", () => expect(isMutating("close")).toBe(true));
  test("get is not mutating", () => expect(isMutating("get")).toBe(false));
  test("query is not mutating", () => expect(isMutating("query")).toBe(false));
  test("view is not mutating", () => expect(isMutating("view")).toBe(false));
  test("validate is not mutating", () =>
    expect(isMutating("validate")).toBe(false));
  test("create is not mutating", () =>
    expect(isMutating("create")).toBe(false));
  test("open is not mutating", () => expect(isMutating("open")).toBe(false));
  test("help is not mutating", () => expect(isMutating("help")).toBe(false));
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
    const result = await tool.execute(
      { command: "get", file: "test.docx" },
      { sessionID: "test" }
    );
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
    const result = await tool.execute(
      { command: "get", file: "test.docx" },
      { sessionID: "test" }
    );
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
    const result = await tool.execute(
      { command: "get", file: "test.docx" },
      { sessionID: "test" }
    );
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
    const result = await tool.execute(
      { command: "get", file: "test.docx" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not installed");
    }
  });

  test("returns failure when CLI output has success:false (exit 0)", async () => {
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async () =>
        JSON.stringify({
          success: false,
          message: "No properties applied to /body",
          warnings: [{ code: "unsupported_property" }],
        }),
    });
    const result = await tool.execute(
      { command: "set", file: "test.docx" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No properties applied");
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
    await tool.execute(
      { command: "batch", file: "test.xlsx", operations: [] },
      { sessionID: "test" }
    );
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
    await tool.execute(
      { command: "get", file: "test.docx" },
      { sessionID: "test" }
    );
    expect(timeoutUsed).toBe(30000);
  });

  test("serializes props as repeatable --prop key=value", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      {
        command: "set",
        file: "test.docx",
        path: "/body/p[1]",
        props: { text: "Hi", bold: "true" },
      },
      { sessionID: "test" }
    );
    expect(args).toContain("--prop");
    expect(args).toContain("text=Hi");
    expect(args).toContain("bold=true");
    expect(args).not.toContain("--props");
  });

  test("view passes mode positionally", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      { command: "view", file: "test.docx", mode: "outline" },
      { sessionID: "test" }
    );
    expect(args).toContain("view");
    expect(args).toContain("test.docx");
    expect(args).toContain("outline");
  });

  test("query passes selector positionally", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      {
        command: "query",
        file: "test.docx",
        selector: "paragraph[style=Normal]",
      },
      { sessionID: "test" }
    );
    expect(args).toContain("paragraph[style=Normal]");
  });

  test("swap passes both paths", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      {
        command: "swap",
        file: "test.pptx",
        path: "/slide[1]/shape[1]",
        path2: "/slide[1]/shape[2]",
      },
      { sessionID: "test" }
    );
    expect(args).toContain("/slide[1]/shape[1]");
    expect(args).toContain("/slide[1]/shape[2]");
  });

  test("merge passes template, output, and data", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      {
        command: "merge",
        template: "tpl.docx",
        output: "out.docx",
        data: '{"name":"An"}',
      },
      { sessionID: "test" }
    );
    expect(args[0]).toBe("merge");
    expect(args).toContain("tpl.docx");
    expect(args).toContain("out.docx");
    expect(args).toContain("--data");
  });

  test("help does not append --json", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      { command: "help", format: "docx", path: "paragraph" },
      { sessionID: "test" }
    );
    expect(args).not.toContain("--json");
    expect(args).toContain("docx");
    expect(args).toContain("paragraph");
  });

  test("raw-set passes part, xpath, action, xml", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      {
        command: "raw-set",
        file: "test.docx",
        part: "/document",
        xpath: "//w:p",
        action: "replace",
        xml: "<w:p/>",
      },
      { sessionID: "test" }
    );
    expect(args).toContain("/document");
    expect(args).toContain("--xpath");
    expect(args).toContain("//w:p");
    expect(args).toContain("--action");
    expect(args).toContain("replace");
    expect(args).toContain("--xml");
  });

  test("add passes parent positionally and type via --type", async () => {
    let args: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (a: string[]) => {
        args = a;
        return '{"success":true}';
      },
    });
    await tool.execute(
      {
        command: "add",
        file: "test.pptx",
        parent: "/slide[1]",
        type: "shape",
      },
      { sessionID: "test" }
    );
    expect(args).toContain("/slide[1]");
    expect(args).toContain("--type");
    expect(args).toContain("shape");
  });
});

describe("draft interception", () => {
  function makeDraftManager(dir: string) {
    return new DraftManager({
      dataDir: dir,
      history: new HistoryStore(dir),
      execOfficeCli: async () => ({ stdout: "", exitCode: 0 }),
    });
  }

  test("mutating commands run against the draft, not the real file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oo-ocli-"));
    const realFile = join(dir, "report.docx");
    mkdirSync(dir, { recursive: true });
    writeFileSync(realFile, "original");

    let lastArgs: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (args) => {
        lastArgs = args;
        return JSON.stringify({ success: true });
      },
      draftManager: makeDraftManager(dir),
    });

    const result = await tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-1" }
    );
    expect(result.success).toBe(true);
    expect(lastArgs[1]).not.toBe(realFile);
    expect(lastArgs[1]).toContain("drafts");
    expect(lastArgs[1]).toContain("sess-1.docx");
    expect(readFileSync(realFile, "utf-8")).toBe("original");
  });

  test("read commands follow the draft once one exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oo-ocli-"));
    const realFile = join(dir, "report.docx");
    mkdirSync(dir, { recursive: true });
    writeFileSync(realFile, "original");

    let lastArgs: string[] = [];
    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async (args) => {
        lastArgs = args;
        return JSON.stringify({ success: true });
      },
      draftManager: makeDraftManager(dir),
    });

    await tool.execute(
      { command: "get", file: realFile },
      { sessionID: "sess-1" }
    );
    expect(lastArgs[1]).toBe(realFile);

    await tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-1" }
    );
    await tool.execute(
      { command: "get", file: realFile },
      { sessionID: "sess-1" }
    );
    expect(lastArgs[1]).toContain("drafts");
  });

  test("a locked file returns the lock error", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oo-ocli-"));
    const realFile = join(dir, "report.docx");
    mkdirSync(dir, { recursive: true });
    writeFileSync(realFile, "original");

    const tool = createOfficeCliTool({
      checkInstalled: async () => true,
      execCli: async () => JSON.stringify({ success: true }),
      draftManager: makeDraftManager(dir),
    });

    await tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-1" }
    );
    const result = await tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-2" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("File is being edited in another session");
      expect(result.code).toBe("LOCKED");
    }
  });
});
