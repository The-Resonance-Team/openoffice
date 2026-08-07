import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import * as os from "node:os";

export type PdfErrorCode =
  "PDF_NO_TEXT_LAYER" | "PDF_READ_ERROR" | "PDF_UNSUPPORTED_PLATFORM";

export class PdfError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.name = "PdfError";
    this.code = code;
  }
}

function platformArchSuffix(): string {
  const plat = os.platform();
  const arch = os.arch();

  if (plat === "linux") {
    const isMusl = existsSync("/lib/ld-musl-x86_64.so1");
    return `linux-${arch}-${isMusl ? "musl" : "gnu"}`;
  }
  if (plat === "darwin") return `darwin-${arch}`;
  if (plat === "win32") return "win32-x64-msvc";
  return `${plat}-${arch}`;
}

type NapiAvailable = "napi" | "cli" | "none";

const platformFallback: NapiAvailable = (() => {
  try {
    const suffix = platformArchSuffix();
    require.resolve(`@firecrawl/pdf-inspector-${suffix}`);
    return "napi";
  } catch {
    // napi not available for this platform
  }
  try {
    execFileSync("pdf2md", ["--version"], { stdio: "pipe" });
    return "cli";
  } catch {
    // pdf2md CLI not available
  }
  return "none";
})();

function loadInspector() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@firecrawl/pdf-inspector") as {
    classifyPdf: (buf: Buffer) => { pdfType: string; [k: string]: unknown };
    processPdf: (buf: Buffer) => {
      pdfType: string;
      markdown?: string;
      hasEncodingIssues: boolean;
      [k: string]: unknown;
    };
  };
}

export async function readPdf(file: string): Promise<string> {
  if (platformFallback === "none") {
    throw new PdfError(
      "PDF_UNSUPPORTED_PLATFORM",
      `No native binary or CLI found for ${platformArchSuffix()}. Install @firecrawl/pdf-inspector-${platformArchSuffix()} or pdf2md.`
    );
  }

  const buffer = readFileSync(file);

  if (platformFallback === "cli") {
    try {
      return execFileSync("pdf2md", [file], { encoding: "utf-8" });
    } catch (err) {
      throw new PdfError(
        "PDF_READ_ERROR",
        `pdf2md CLI failed: ${(err as Error).message}`
      );
    }
  }

  // napi path
  let inspector;
  try {
    inspector = loadInspector();
  } catch {
    throw new PdfError(
      "PDF_UNSUPPORTED_PLATFORM",
      `Failed to load pdf-inspector native binding for ${platformArchSuffix()}.`
    );
  }

  let classification;
  try {
    classification = inspector.classifyPdf(buffer);
  } catch {
    throw new PdfError("PDF_READ_ERROR", "Failed to classify PDF.");
  }

  const pdfType = classification.pdfType;

  if (pdfType === "Scanned" || pdfType === "ImageBased") {
    throw new PdfError(
      "PDF_NO_TEXT_LAYER",
      "Scanned/image PDF detected. Use OCR (oocr) for text extraction."
    );
  }

  let result;
  try {
    result = inspector.processPdf(buffer);
  } catch {
    throw new PdfError("PDF_READ_ERROR", "Failed to process PDF.");
  }

  const markdown = result.markdown ?? "";

  if (pdfType === "Mixed") {
    return `[Warning: This PDF contains mixed content. Some sections may be incomplete.]\n\n${markdown}`;
  }

  if (result.hasEncodingIssues) {
    return `[Warning: Font encoding issues detected. Extraction may contain errors.]\n\n${markdown}`;
  }

  return markdown;
}
