import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { checkTesseract, checkPdftoppm } from "./install";

const PAGE_LIMIT = 100;
const LANG = "eng+vie";
const OCR_PREFIX =
  "[OCR: Extracted from scanned document via Tesseract. May contain recognition errors.]";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".tiff", ".bmp"]);

export class OcrError extends Error {
  code: "TESSERACT_NOT_INSTALLED" | "PDFTOPPM_NOT_INSTALLED" | "OCR_FAILED";
  constructor(
    code: "TESSERACT_NOT_INSTALLED" | "PDFTOPPM_NOT_INSTALLED" | "OCR_FAILED",
    message: string
  ) {
    super(message);
    this.name = "OcrError";
    this.code = code;
  }
}

function isImageFile(file: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(file).toLowerCase());
}

function isPdfFile(file: string): boolean {
  return extname(file).toLowerCase() === ".pdf";
}

function rasterizePdf(pdfPath: string, outDir: string): string[] {
  try {
    execFileSync(
      "pdftoppm",
      ["-png", "-r", "300", pdfPath, join(outDir, "page")],
      { timeout: 60000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
  } catch (err: any) {
    if (err.code === "ENOENT") {
      throw new OcrError(
        "PDFTOPPM_NOT_INSTALLED",
        "pdftoppm not found. Install poppler-utils: brew install poppler (macOS) / apt install poppler-utils (Linux)"
      );
    }
    throw new OcrError("OCR_FAILED", `pdftoppm failed: ${err.message}`);
  }

  const files = readdirSync(outDir)
    .filter((f) => f.startsWith("page") && f.endsWith(".png"))
    .sort();

  if (files.length > PAGE_LIMIT) {
    return files.slice(0, PAGE_LIMIT);
  }
  return files;
}

function ocrImage(imagePath: string): string {
  try {
    return execFileSync("tesseract", [imagePath, "stdout", "-l", LANG], {
      timeout: 30000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err: any) {
    if (err.code === "ENOENT") {
      throw new OcrError(
        "TESSERACT_NOT_INSTALLED",
        "Tesseract not found. Install: brew install tesseract (macOS) / apt install tesseract-ocr (Linux)"
      );
    }
    throw new OcrError("OCR_FAILED", `Tesseract failed: ${err.message}`);
  }
}

export async function readOcr(file: string): Promise<string> {
  const tesseractOk = await checkTesseract();
  if (!tesseractOk) {
    throw new OcrError(
      "TESSERACT_NOT_INSTALLED",
      "Tesseract not found. Install: brew install tesseract (macOS) / apt install tesseract-ocr (Linux)"
    );
  }

  if (isImageFile(file)) {
    const text = ocrImage(file);
    return `${OCR_PREFIX}\n\n${text}`;
  }

  if (isPdfFile(file)) {
    const pdftoppmOk = await checkPdftoppm();
    if (!pdftoppmOk) {
      throw new OcrError(
        "PDFTOPPM_NOT_INSTALLED",
        "pdftoppm not found. Install poppler-utils: brew install poppler (macOS) / apt install poppler-utils (Linux)"
      );
    }

    const tmpDir = mkdtempSync(join(tmpdir(), "oocr-"));
    try {
      const pages = rasterizePdf(file, tmpDir);
      const exceeded = pages.length >= PAGE_LIMIT;
      const texts: string[] = [];

      for (const page of pages) {
        texts.push(ocrImage(join(tmpDir, page)));
      }

      const combined = texts.join("\n\n");
      const warning = exceeded
        ? `[Warning: PDF has ${pages.length}+ pages. OCR limited to first ${PAGE_LIMIT} pages.]\n\n`
        : "";

      return `${OCR_PREFIX}\n\n${warning}${combined}`;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  throw new OcrError("OCR_FAILED", `Unsupported file type: ${extname(file)}`);
}
