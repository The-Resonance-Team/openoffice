import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createReadTool,
  createWriteTool,
  createGlobTool,
  createGrepTool,
  createQuestionTool,
} from "@openoffice/core";

function hasRg(): boolean {
  try {
    execFileSync("rg", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "openoffice-test-"));
}

const noopDeps = {
  readDocument: async () => "office content",
};

describe("read tool", () => {
  test("reads plain text file", async () => {
    const dir = tempDir();
    const file = join(dir, "test.txt");
    writeFileSync(file, "hello world");

    const tool = createReadTool(noopDeps);
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("hello world");
  });

  test("reads markdown file", async () => {
    const dir = tempDir();
    const file = join(dir, "readme.md");
    writeFileSync(file, "# Title");

    const tool = createReadTool(noopDeps);
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("# Title");
  });

  test("returns error for missing file", async () => {
    const tool = createReadTool(noopDeps);
    const result = await tool.execute(
      { file: "/nonexistent/file.txt" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("FILE_NOT_FOUND");
  });

  test("delegates .docx to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "test.docx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "document content";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
    if (result.success) expect(result.output).toBe("document content");
  });

  test("delegates .xlsx to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "test.xlsx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "spreadsheet content";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("delegates .pptx to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pptx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "presentation content";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("delegates .pdf to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4 binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "extracted pdf text";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
    if (result.success) expect(result.output).toBe("extracted pdf text");
  });

  test("returns a PDF error when document conversion fails", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4 binary");

    const tool = createReadTool({
      readDocument: async () => {
        throw new Error("unsupported PDF");
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("PDF_READ_ERROR");
  });

  test("reads legacy .doc through AnyDoc", async () => {
    const dir = tempDir();
    const file = join(dir, "test.doc");
    writeFileSync(file, "legacy binary");

    const tool = createReadTool({ readDocument: async () => "legacy content" });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("legacy content");
  });

  test("delegates .dotx template to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "template.dotx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "template content";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("delegates .docm macro-enabled to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "macro.docm");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "macro content";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });
});

describe("write tool", () => {
  test("writes text files", async () => {
    const dir = tempDir();
    const file = join(dir, "note.txt");
    const tool = createWriteTool();
    const result = await tool.execute(
      { file, content: "hello" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(true);
    expect(readFileSync(file, "utf-8")).toBe("hello");
  });

  test("rejects office extensions", async () => {
    const dir = tempDir();
    const tool = createWriteTool();
    for (const ext of [".docx", ".xlsx", ".pptx", ".doc", ".xls"]) {
      const result = await tool.execute(
        { file: join(dir, `file${ext}`), content: "garbage" },
        { sessionID: "test" }
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("officecli");
      }
    }
  });
});

describe("glob tool", () => {
  test("finds files by pattern", async () => {
    const dir = tempDir();
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "a.ts"), "x");
    writeFileSync(join(dir, "sub", "b.ts"), "y");
    writeFileSync(join(dir, "c.txt"), "z");

    const tool = createGlobTool();
    const result = await tool.execute(
      { pattern: "**/*.ts", path: dir },
      { sessionID: "test" }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("a.ts");
      expect(result.output).toContain("b.ts");
      expect(result.output).not.toContain("c.txt");
    }
  });

  test("returns no files found when nothing matches", async () => {
    const dir = tempDir();
    const tool = createGlobTool();
    const result = await tool.execute(
      { pattern: "*.nonexistent", path: dir },
      { sessionID: "test" }
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("No files found");
  });
});

describe("grep tool", () => {
  test("returns matching lines", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    const file = join(dir, "search.txt");
    writeFileSync(file, "alpha\nbeta\nalpha gamma\n");

    const tool = createGrepTool();
    const result = await tool.execute(
      { query: "alpha", path: file },
      { sessionID: "test" }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("alpha");
      expect(result.output).not.toContain("beta");
    }
  });

  test("reports no matches without failing", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    const file = join(dir, "search.txt");
    writeFileSync(file, "alpha");

    const tool = createGrepTool();
    const result = await tool.execute(
      { query: "zzz", path: file },
      { sessionID: "test" }
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("No matches found");
  });

  test("searches extracted office and PDF text alongside plain text", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "notes.txt"), "plain target\n");
    writeFileSync(join(dir, "report.docx"), "placeholder");
    writeFileSync(join(dir, "slides.pptx"), "placeholder");
    writeFileSync(join(dir, "manual.pdf"), "placeholder");
    writeFileSync(join(dir, "old.doc"), "placeholder");

    const tool = createGrepTool({
      readDocument: async (file) =>
        file.endsWith("report.docx") || file.endsWith("manual.pdf")
          ? "document target\n"
          : "no match\n",
    });
    const result = await tool.execute(
      { query: "target", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("plain target");
      expect(result.output).toContain("report.docx");
      expect(result.output).toContain("manual.pdf");
      expect(result.output).not.toContain("slides.pptx");
    }
  });

  test("does not search raw document bytes with rg", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "report.docx"), "raw target\n");

    const tool = createGrepTool({
      readDocument: async () => "document target\n",
    });
    const result = await tool.execute(
      { query: "target", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("document target");
      expect(result.output).not.toContain("raw target");
    }
  });

  test("keeps plain-text matches when document enumeration fails", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "notes.txt"), "plain target\n");
    writeFileSync(join(dir, "report.docx"), "raw target\n");

    const tool = createGrepTool({
      readDocument: async () => "document target\n",
      listFiles: async () => {
        throw new Error("maxBuffer exceeded");
      },
    });
    const result = await tool.execute(
      { query: "target", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("plain target");
      expect(result.output).not.toContain("raw target");
      expect(result.output).not.toContain("document target");
      expect(result.output).toContain("document extraction skipped");
    }
  });

  test("searches extracted spreadsheet text", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "report.xlsx"), "placeholder");

    const tool = createGrepTool({
      readDocument: async () => "spreadsheet target\n",
    });
    const result = await tool.execute(
      { query: "target", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("report.xlsx");
      expect(result.output).toContain("spreadsheet target");
    }
  });

  test("searches filenames and paths", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "report.docx"), "placeholder");

    const tool = createGrepTool({
      readDocument: async () => "no content match\n",
    });
    const result = await tool.execute(
      { query: "report", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("Path match:");
      expect(result.output).toContain("report.docx");
    }
  });

  test("searches document metadata", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "report.docx"), "placeholder");

    const tool = createGrepTool({
      readDocument: async () => "no content match\n",
      readMetadata: async () => ({
        Title: "quarterly report",
        Author: "Alice",
      }),
    });
    const result = await tool.execute(
      { query: "quarterly", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("Metadata match:");
      expect(result.output).toContain("report.docx");
      expect(result.output).toContain("Title: quarterly report");
    }
  });

  test("resolves document drafts before extraction", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    const realPath = join(dir, "report.docx");
    const draftPath = join(dir, "report-draft.docx");
    writeFileSync(realPath, "real");
    writeFileSync(draftPath, "draft");

    let readPath = "";
    const tool = createGrepTool({
      readDocument: async (file) => {
        readPath = file;
        return "draft target\n";
      },
      resolveDocument: async () => draftPath,
    });
    const result = await tool.execute(
      { query: "target", path: realPath },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    expect(readPath).toBe(draftPath);
    if (result.success) expect(result.output).toContain("draft target");
  });

  test("reports office extraction files skipped past the limit", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "one.docx"), "placeholder");
    writeFileSync(join(dir, "two.docx"), "placeholder");
    const extracted: string[] = [];
    const readDocument = async (file: string) => {
      extracted.push(file);
      return "target\n";
    };

    const tool = createGrepTool({ readDocument, officeExtractLimit: 1 });
    const result = await tool.execute(
      { query: "target", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    expect(extracted).toHaveLength(1);
    if (result.success) {
      expect(result.output).toContain(".docx");
      expect(result.output).toContain("1 document files skipped");
    }
  });

  test("applies include glob when selecting extracted files", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "report.docx"), "placeholder");
    writeFileSync(join(dir, "manual.pdf"), "placeholder");

    const extracted: string[] = [];
    const tool = createGrepTool({
      readDocument: async (file) => {
        extracted.push(file);
        return "target\n";
      },
    });
    const result = await tool.execute(
      { query: "target", path: dir, include: "*.docx" },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    expect(extracted).toHaveLength(1);
    if (result.success) {
      expect(result.output).toContain("report.docx");
      expect(result.output).not.toContain("manual.pdf");
    }
  });

  test("returns no matches cleanly for extracted documents", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "report.docx"), "placeholder");
    writeFileSync(join(dir, "manual.pdf"), "placeholder");
    writeFileSync(join(dir, "old.doc"), "placeholder");

    const tool = createGrepTool({
      readDocument: async () => "document text\n",
    });
    const result = await tool.execute(
      { query: "missing", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("No matches found");
    }
  });

  test("handles complex regex safely for extracted documents", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "report.docx"), "placeholder");

    const tool = createGrepTool({
      readDocument: async () => `${"a".repeat(5000)}!`,
    });
    const result = await tool.execute(
      { query: "(a+)+$", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("No matches found");
  });

  test("uses the document reader for legacy Office files", async () => {
    if (!hasRg()) return;
    const dir = tempDir();
    writeFileSync(join(dir, "legacy.doc"), "placeholder");

    const tool = createGrepTool({
      readDocument: async () => "legacy target\n",
    });
    const result = await tool.execute(
      { query: "target", path: dir },
      { sessionID: "test" }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("legacy.doc");
      expect(result.output).not.toContain("legacy files skipped");
    }
  });
});

describe("question tool", () => {
  test("returns user answer", async () => {
    const tool = createQuestionTool({ askUser: async () => "the answer" });
    const result = await tool.execute(
      { question: "What is 2+2?" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("the answer");
  });

  test("returns error when ask fails", async () => {
    const tool = createQuestionTool({
      askUser: async () => {
        throw new Error("user closed the prompt");
      },
    });
    const result = await tool.execute(
      { question: "Still there?" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("QUESTION_ERROR");
      expect(result.error).toContain("user closed the prompt");
    }
  });
});
