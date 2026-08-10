import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { IMAGE_EXTENSIONS } from '../tool';
import { checkPdftoppm } from './install';
import type { CompleteOptions } from '../llm';

const PAGE_LIMIT = 50;
const OCR_PREFIX =
  '[OCR: Extracted from scanned document via vision model. May contain recognition errors.]';
const EXTRACT_PROMPT =
  'Extract all text from the image verbatim, preserving the reading order. Output only the extracted text.';
const PDFTOPPM_HINT =
  'pdftoppm not found. Install poppler-utils: brew install poppler (macOS) / apt install poppler-utils (Linux)';

// Vision APIs accept png/jpeg (and gif/webp); tiff/bmp are rasterized first or
// rejected. Kept in sync with IMAGE_EXTENSIONS in tool/builtins/read.ts.
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export type OcrErrorCode = 'PDFTOPPM_NOT_INSTALLED' | 'OCR_FAILED';

export class OcrError extends Error {
  code: OcrErrorCode;
  constructor(code: OcrErrorCode, message: string) {
    super(message);
    this.name = 'OcrError';
    this.code = code;
  }
}

export interface OcrDeps {
  /** Nested model call: the daemon's `complete`, with `config` already bound. */
  complete: (options: Omit<CompleteOptions, 'config'>) => Promise<string>;
  /** The model that reads the rasterized pages. */
  model: string;
}

function dataUrl(file: string): string {
  const ext = extname(file).toLowerCase();
  return `data:${MIME_BY_EXT[ext]};base64,${readFileSync(file).toString('base64')}`;
}

async function visionExtract(file: string, deps: OcrDeps): Promise<string> {
  try {
    return await deps.complete({
      model: deps.model,
      prompt: EXTRACT_PROMPT,
      messages: [
        {
          role: 'user',
          content: [{ type: 'image', image: dataUrl(file) }],
        },
      ],
    });
  } catch (e: unknown) {
    throw new OcrError(
      'OCR_FAILED',
      `Vision model failed to read image: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function rasterizePdf(
  pdfPath: string,
  outDir: string,
  pageLimit: number,
): { files: string[]; totalRasterized: number } {
  try {
    execFileSync(
      'pdftoppm',
      ['-png', '-r', '150', '-f', '1', '-l', String(pageLimit), pdfPath, join(outDir, 'page')],
      { timeout: 60000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      throw new OcrError('PDFTOPPM_NOT_INSTALLED', PDFTOPPM_HINT);
    }
    throw new OcrError('OCR_FAILED', `pdftoppm failed: ${msg}`);
  }

  const files = readdirSync(outDir)
    .filter((f) => f.startsWith('page') && f.endsWith('.png'))
    .sort();

  return { files, totalRasterized: files.length };
}

export async function readOcr(file: string, deps: OcrDeps): Promise<string> {
  const ext = extname(file).toLowerCase();

  if (IMAGE_EXTENSIONS.has(ext)) {
    return `${OCR_PREFIX}\n\n${await visionExtract(file, deps)}`;
  }

  if (ext === '.pdf') {
    const pdftoppmOk = await checkPdftoppm();
    if (!pdftoppmOk) {
      throw new OcrError('PDFTOPPM_NOT_INSTALLED', PDFTOPPM_HINT);
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'oocr-'));
    try {
      const { files, totalRasterized } = rasterizePdf(file, tmpDir, PAGE_LIMIT);
      const texts: string[] = [];

      for (const page of files) {
        texts.push(await visionExtract(join(tmpDir, page), deps));
      }

      const combined = texts.join('\n\n');
      const warning =
        totalRasterized >= PAGE_LIMIT
          ? `[Warning: PDF has ${totalRasterized}+ pages. OCR limited to first ${PAGE_LIMIT} pages.]\n\n`
          : '';

      return `${OCR_PREFIX}\n\n${warning}${combined}`;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  throw new OcrError('OCR_FAILED', `Unsupported file type: ${ext}`);
}
