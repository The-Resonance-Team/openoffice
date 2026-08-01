import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReadTool } from "../src/tool/builtins/read";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "openoffice-test-"));
}

const noopDeps = {
  readOffice: async () => "office content",
};

describe("read tool", () => {
  test("reads plain text file", async () => {
    const dir = tempDir();
    const file = join(dir, "test.txt");
    writeFileSync(file, "hello world");

    const tool = createReadTool(noopDeps);
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("hello world");
  });

  test("reads markdown file", async () => {
    const dir = tempDir();
    const file = join(dir, "readme.md");
    writeFileSync(file, "# Title");

    const tool = createReadTool(noopDeps);
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("# Title");
  });

  test("returns error for missing file", async () => {
    const tool = createReadTool(noopDeps);
    const result = await tool.execute({ file: "/nonexistent/file.txt" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("FILE_NOT_FOUND");
  });

  test("delegates .docx to readOffice", async () => {
    const dir = tempDir();
    const file = join(dir, "test.docx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readOffice: async (f: string) => {
        calledWith = f;
        return "document content";
      },
    });
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
    if (result.success) expect(result.output).toBe("document content");
  });

  test("delegates .xlsx to readOffice", async () => {
    const dir = tempDir();
    const file = join(dir, "test.xlsx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readOffice: async (f: string) => {
        calledWith = f;
        return "spreadsheet content";
      },
    });
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("delegates .pptx to readOffice", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pptx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readOffice: async (f: string) => {
        calledWith = f;
        return "presentation content";
      },
    });
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("delegates .pdf to readPdf when available", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4 binary");

    let calledWith = "";
    const tool = createReadTool({
      readOffice: async () => "",
      readPdf: async (f: string) => {
        calledWith = f;
        return "extracted pdf text";
      },
    });
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
    if (result.success) expect(result.output).toBe("extracted pdf text");
  });

  test("errors on .pdf when readPdf not configured", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4 binary");

    const tool = createReadTool({ readOffice: async () => "" });
    const result = await tool.execute({ file });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("PDF_READ_ERROR");
  });

  test("errors on legacy .doc format with conversion hint", async () => {
    const dir = tempDir();
    const file = join(dir, "test.doc");
    writeFileSync(file, "legacy binary");

    const tool = createReadTool({ readOffice: async () => "" });
    const result = await tool.execute({ file });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("LEGACY_FORMAT");
      expect(result.error).toContain("docx");
    }
  });

  test("delegates .dotx template to readOffice", async () => {
    const dir = tempDir();
    const file = join(dir, "template.dotx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readOffice: async (f: string) => {
        calledWith = f;
        return "template content";
      },
    });
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("delegates .docm macro-enabled to readOffice", async () => {
    const dir = tempDir();
    const file = join(dir, "macro.docm");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readOffice: async (f: string) => {
        calledWith = f;
        return "macro content";
      },
    });
    const result = await tool.execute({ file });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });
});
