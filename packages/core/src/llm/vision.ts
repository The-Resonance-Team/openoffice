import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import type { CompleteOptions } from './complete';

const PAGE_LIMIT = 50;
const DPI = 150;
const OCR_PREFIX =
  '[OCR: Extracted from scanned document via vision model. May contain recognition errors.]';
const EXTRACT_PROMPT =
  'Extract all text from the image verbatim, preserving the reading order. Output only the extracted text.';
const PDFTOPPM_HINT =
  'pdftoppm not found. Install poppler-utils: brew install poppler (macOS) / apt install poppler-utils (Linux)';

// Vision APIs accept png/jpeg only; keep in sync with IMAGE_EXTENSIONS in
// tool/builtins/read.ts, which owns the routing.
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export type VisionErrorCode = 'PDFTOPPM_NOT_INSTALLED' | 'OCR_FAILED';

export interface VisionDeps {
  /** Nested model call: the daemon's `complete`, with `config` already bound. */
  complete: (options: Omit<CompleteOptions, 'config'>) => Promise<string>;
  /** The session model that reads the rasterized pages. */
  model: string;
  /** Rasterizer probe — overridable for tests. Defaults to checkPdftoppm. */
  checkPdftoppm?: () => Promise<boolean>;
}

function visionError(code: VisionErrorCode, message: string): Error {
  const err = new Error(message);
  (err as Error & { code: string }).code = code;
  return err;
}

let pdftoppmCache: boolean | null = null;

async function checkPdftoppm(): Promise<boolean> {
  if (pdftoppmCache !== null) return pdftoppmCache;
  try {
    execFileSync('pdftoppm', ['-v'], { timeout: 5000, stdio: 'pipe' });
    pdftoppmCache = true;
  } catch {
    pdftoppmCache = false;
  }
  return pdftoppmCache;
}

export function resetProbeCache(): void {
  pdftoppmCache = null;
}

function dataUrl(file: string): string {
  const ext = extname(file).toLowerCase();
  return `data:${MIME_BY_EXT[ext]};base64,${readFileSync(file).toString('base64')}`;
}

async function extractImageText(file: string, deps: VisionDeps): Promise<string> {
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
    throw visionError(
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
      [
        '-png',
        '-r',
        String(DPI),
        '-f',
        '1',
        '-l',
        String(pageLimit),
        pdfPath,
        join(outDir, 'page'),
      ],
      {
        timeout: 60000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      throw visionError('PDFTOPPM_NOT_INSTALLED', PDFTOPPM_HINT);
    }
    throw visionError('OCR_FAILED', `pdftoppm failed: ${msg}`);
  }

  const files = readdirSync(outDir)
    .filter((f) => f.startsWith('page') && f.endsWith('.png'))
    .sort();

  return { files, totalRasterized: files.length };
}

// Reads a scanned PDF or standalone image with the session model: pages are
// rasterized (pdftoppm), sent as base64 image parts to a single-turn complete()
// call, and the extracted text is concatenated with an OCR flag prefix.
export async function readViaVision(file: string, deps: VisionDeps): Promise<string> {
  const ext = extname(file).toLowerCase();

  if (MIME_BY_EXT[ext]) {
    return `${OCR_PREFIX}\n\n${await extractImageText(file, deps)}`;
  }

  if (ext === '.pdf') {
    const pdftoppmOk = await (deps.checkPdftoppm ?? checkPdftoppm)();
    if (!pdftoppmOk) {
      throw visionError('PDFTOPPM_NOT_INSTALLED', PDFTOPPM_HINT);
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'openoffice-vision-'));
    try {
      const { files, totalRasterized } = rasterizePdf(file, tmpDir, PAGE_LIMIT);
      const texts: string[] = [];

      for (const page of files) {
        texts.push(await extractImageText(join(tmpDir, page), deps));
      }

      const combined = texts.join('\n\n');
      const warning =
        totalRasterized >= PAGE_LIMIT
          ? `[Warning: PDF has ${totalRasterized}+ pages. Reading limited to first ${PAGE_LIMIT} pages.]\n\n`
          : '';

      return `${OCR_PREFIX}\n\n${warning}${combined}`;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  throw visionError('OCR_FAILED', `Unsupported file type: ${ext}`);
}
