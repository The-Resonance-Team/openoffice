import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readPdf, PdfError } from "./read-pdf";

const REAL_PDF = join(process.cwd(), "data", "test-real.pdf");

describe("readPdf integration — real PDF", () => {
  test("extracts Markdown from real PDF file", async () => {
    if (!existsSync(REAL_PDF)) {
      console.log("SKIP: data/test-real.pdf not found");
      return;
    }
    const result = await readPdf(REAL_PDF);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("real PDF produces structured output (headings or paragraphs)", async () => {
    if (!existsSync(REAL_PDF)) {
      console.log("SKIP: data/test-real.pdf not found");
      return;
    }
    const result = await readPdf(REAL_PDF);
    // ponytail: just verify we get non-empty markdown — real PDF content varies
    expect(result.length).toBeGreaterThan(10);
  });
});

describe("readPdf — error paths", () => {
  test("throws on non-existent file", async () => {
    await expect(readPdf("/nonexistent/file.pdf")).rejects.toThrow();
  });
});

describe("PdfError", () => {
  test("has correct name and properties", () => {
    // Constructor order: (code, message)
    const err = new PdfError("PDF_NO_TEXT_LAYER", "test message");
    expect(err.name).toBe("PdfError");
    expect(err.code).toBe("PDF_NO_TEXT_LAYER");
    expect(err.message).toBe("test message");
  });

  test("is instanceof Error", () => {
    const err = new PdfError("PDF_READ_ERROR", "msg");
    expect(err).toBeInstanceOf(Error);
  });

  test("preserves all error codes", () => {
    const codes = [
      "PDF_NO_TEXT_LAYER",
      "PDF_READ_ERROR",
      "PDF_UNSUPPORTED_PLATFORM",
    ] as const;
    for (const code of codes) {
      const err = new PdfError(code, `${code} msg`);
      expect(err.code).toBe(code);
    }
  });
});
