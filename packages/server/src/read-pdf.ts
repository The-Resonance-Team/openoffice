import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export type PdfErrorCode = 'PDF_NO_TEXT_LAYER' | 'PDF_READ_ERROR' | 'PDF_UNSUPPORTED_PLATFORM';

export class PdfError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.name = 'PdfError';
    this.code = code;
  }
}

function platformArchSuffix(): string {
  // ponytail: process.platform/arch over os module import — same thing, zero deps
  const plat = process.platform;
  const arch = process.arch;

  if (plat === 'linux') {
    // ponytail: probe arch-specific musl loader — x86_64-only misses Alpine ARM
    const isMusl = existsSync(`/lib/ld-musl-${arch}.so.1`);
    return `linux-${arch}-${isMusl ? 'musl' : 'gnu'}`;
  }
  if (plat === 'darwin') return `darwin-${arch}`;
  // ponytail: win32 hardcoded to x64-msvc — other arch combos need the binary added upstream
  // ponytail: correct name even when no binary exists — error messages and require.resolve use it
  if (plat === 'win32') return `win32-${arch}-msvc`;
  return `${plat}-${arch}`;
}

type NapiAvailable = 'napi' | 'cli' | 'none';

function resolvePlatformMode(): NapiAvailable {
  const suffix = platformArchSuffix();
  try {
    require.resolve(`@firecrawl/pdf-inspector-${suffix}`);
    return 'napi';
  } catch {
    // napi not available for this platform
  }
  try {
    execFileSync('pdf2md', ['--version'], { stdio: 'pipe' });
    return 'cli';
  } catch {
    // pdf2md CLI not available
  }
  return 'none';
}

const resolvedSuffix = platformArchSuffix();
const platformFallback: NapiAvailable = resolvePlatformMode();

function loadInspector() {
  // ponytail: dynamic require for optional native dep — static import crashes when binary is missing
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@firecrawl/pdf-inspector') as {
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
  if (platformFallback === 'none') {
    throw new PdfError(
      'PDF_UNSUPPORTED_PLATFORM',
      `PDF extraction not supported on this platform (${resolvedSuffix}). Install pdf2md: cargo install pdf-inspector`,
    );
  }

  if (platformFallback === 'cli') {
    try {
      // ponytail: CLI fallback can't classify — output may include scanned content without warning
      return execFileSync('pdf2md', [file], { encoding: 'utf-8' });
    } catch (err) {
      throw new PdfError('PDF_READ_ERROR', `pdf2md CLI failed: ${(err as Error).message}`);
    }
  }

  // napi path
  const buffer = readFileSync(file);
  let inspector;
  try {
    inspector = loadInspector();
  } catch {
    throw new PdfError(
      'PDF_UNSUPPORTED_PLATFORM',
      `Failed to load pdf-inspector native binding for ${resolvedSuffix}.`,
    );
  }

  // ponytail: single try/catch for classify+process — both fail the same way
  let result;
  let pdfType: string;
  try {
    // ponytail: setImmediate to yield event loop — large PDFs shouldn't stall concurrent sessions
    const classification = (await new Promise((resolve) => {
      setImmediate(() => resolve(inspector.classifyPdf(buffer)));
    })) as { pdfType: string };
    pdfType = classification.pdfType;

    if (pdfType === 'Scanned' || pdfType === 'ImageBased') {
      throw new PdfError(
        'PDF_NO_TEXT_LAYER',
        'Scanned/image PDF detected. Use OCR (oocr) for text extraction.',
      );
    }

    result = (await new Promise((resolve) => {
      setImmediate(() => resolve(inspector.processPdf(buffer)));
    })) as { markdown?: string; hasEncodingIssues: boolean };
  } catch (e) {
    if (e instanceof PdfError) throw e;
    throw new PdfError('PDF_READ_ERROR', 'Failed to classify/process PDF.');
  }

  const markdown = result.markdown ?? '';

  if (pdfType === 'Mixed') {
    return `[Warning: This PDF contains mixed content. Some sections may be incomplete.]\n\n${markdown}`;
  }

  if (result.hasEncodingIssues) {
    return `[Warning: Font encoding issues detected. Extraction may contain errors.]\n\n${markdown}`;
  }

  return markdown;
}
