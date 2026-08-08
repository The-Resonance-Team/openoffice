import { describe, test, expect, beforeEach, mock } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readOcr, OcrError } from "./ocr";
import { resetCache } from "./install";

function tempDir(): string {
  const dir = join(
    tmpdir(),
    `ocr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  resetCache();
});

describe("OcrError", () => {
  test("has correct name and properties", () => {
    const err = new OcrError("TESSERACT_NOT_INSTALLED", "test message");
    expect(err.name).toBe("OcrError");
    expect(err.code).toBe("TESSERACT_NOT_INSTALLED");
    expect(err.message).toBe("test message");
  });

  test("is instanceof Error", () => {
    const err = new OcrError("OCR_FAILED", "msg");
    expect(err).toBeInstanceOf(Error);
  });

  test("preserves all error codes", () => {
    const codes = [
      "TESSERACT_NOT_INSTALLED",
      "PDFTOPPM_NOT_INSTALLED",
      "OCR_FAILED",
    ] as const;
    for (const code of codes) {
      const err = new OcrError(code, `${code} msg`);
      expect(err.code).toBe(code);
    }
  });
});

describe("readOcr — unsupported file types", () => {
  test("throws on unsupported file extension", async () => {
    const dir = tempDir();
    const file = join(dir, "test.xyz");
    writeFileSync(file, "content");

    await expect(readOcr(file)).rejects.toThrow(OcrError);
  });
});

describe("readOcr — direct image OCR", () => {
  test("throws TESSERACT_NOT_INSTALLED when tesseract missing", async () => {
    const dir = tempDir();
    const file = join(dir, "test.png");
    writeFileSync(file, "binary png data");

    try {
      await readOcr(file);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(OcrError);
      if (e instanceof OcrError) {
        expect(e.code).toBe("TESSERACT_NOT_INSTALLED");
        expect(e.message).toContain("Tesseract not found");
      }
    }
  });
});

describe("readOcr — PDF rasterize-then-OCR", () => {
  test("throws TESSERACT_NOT_INSTALLED for PDF when tesseract missing", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4");

    try {
      await readOcr(file);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(OcrError);
      if (e instanceof OcrError) {
        expect(e.code).toBe("TESSERACT_NOT_INSTALLED");
      }
    }
  });
});
