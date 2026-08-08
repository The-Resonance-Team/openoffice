import { describe, test, expect } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createReadTool } from "./read";

function tempDir(): string {
  const dir = join(
    tmpdir(),
    `read-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("createReadTool — PDF routing", () => {
  test("routes .pdf to readPdf when provided", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async () => "anydoc result",
      readPdf: async (f: string) => {
        calledWith = f;
        return "pdf-inspector result";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
    if (result.success) expect(result.output).toBe("pdf-inspector result");
  });

  test("falls back to readDocument when readPdf not provided", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "anydoc result";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("returns PDF_NO_TEXT_LAYER for scanned PDF error", async () => {
    const dir = tempDir();
    const file = join(dir, "scanned.pdf");
    writeFileSync(file, "%PDF-1.4");

    const tool = createReadTool({
      readDocument: async () => "anydoc",
      readPdf: async () => {
        const err = new Error("Scanned PDF") as any;
        err.code = "PDF_NO_TEXT_LAYER";
        throw err;
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("PDF_NO_TEXT_LAYER");
  });

  test("routes non-PDF documents to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "test.docx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "docx content";
      },
      readPdf: async () => "should not be called",
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });
});
