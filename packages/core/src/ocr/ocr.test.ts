import { describe, test, expect, beforeEach } from 'bun:test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readOcr, OcrError, type OcrDeps } from './ocr';
import { resetCache } from './install';

function tempDir(): string {
  const dir = join(tmpdir(), `ocr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function mockDeps(overrides: Partial<OcrDeps> = {}): OcrDeps & { calls: { dataUrl: string }[] } {
  const calls: { dataUrl: string }[] = [];
  return {
    model: 'test/vision-model',
    complete: async (options) => {
      const image = (options.messages[0].content as Array<{ type: string; image?: string }>).find(
        (c) => c.type === 'image',
      );
      calls.push({ dataUrl: image?.image ?? '' });
      return 'Extracted OCR text';
    },
    ...overrides,
    calls,
  } as OcrDeps & { calls: { dataUrl: string }[] };
}

beforeEach(() => {
  resetCache();
});

describe('OcrError', () => {
  test('has correct name and properties', () => {
    const err = new OcrError('PDFTOPPM_NOT_INSTALLED', 'test message');
    expect(err.name).toBe('OcrError');
    expect(err.code).toBe('PDFTOPPM_NOT_INSTALLED');
    expect(err.message).toBe('test message');
  });

  test('is instanceof Error', () => {
    const err = new OcrError('OCR_FAILED', 'msg');
    expect(err).toBeInstanceOf(Error);
  });

  test('preserves all error codes', () => {
    const codes = ['PDFTOPPM_NOT_INSTALLED', 'OCR_FAILED'] as const;
    for (const code of codes) {
      const err = new OcrError(code, `${code} msg`);
      expect(err.code).toBe(code);
    }
  });
});

describe('readOcr — unsupported file types', () => {
  test('throws on unsupported file extension', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.xyz');
    writeFileSync(file, 'content');

    await expect(readOcr(file, mockDeps())).rejects.toThrow(OcrError);
  });
});

describe('readOcr — direct image reading via vision model', () => {
  test('passes the image as a base64 data URL to the vision model', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.png');
    writeFileSync(file, 'fake png bytes');

    const deps = mockDeps();
    const result = await readOcr(file, deps);

    expect(result.startsWith('[OCR:')).toBe(true);
    expect(result).toContain('Extracted OCR text');
    expect(deps.calls.length).toBe(1);
    expect(deps.calls[0].dataUrl).toStartWith('data:image/png;base64,');
  });

  test('uses the configured OCR model', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.jpg');
    writeFileSync(file, 'fake jpg bytes');

    let usedModel = '';
    const deps = mockDeps({
      model: 'ollama/qwen2.5-vl',
      complete: async (options) => {
        usedModel = options.model;
        return 'text';
      },
    });
    await readOcr(file, deps);

    expect(usedModel).toBe('ollama/qwen2.5-vl');
  });

  test('wraps vision model failures in OcrError(OCR_FAILED)', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.png');
    writeFileSync(file, 'fake png bytes');

    const deps = mockDeps({
      complete: async () => {
        throw new Error('model exploded');
      },
    });

    try {
      await readOcr(file, deps);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(OcrError);
      if (e instanceof OcrError) {
        expect(e.code).toBe('OCR_FAILED');
        expect(e.message).toContain('model exploded');
      }
    }
  });
});

describe('readOcr — PDF rasterize-then-read', () => {
  test('throws PDFTOPPM_NOT_INSTALLED when pdftoppm missing', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.pdf');
    writeFileSync(file, '%PDF-1.4');

    try {
      await readOcr(file, mockDeps());
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(OcrError);
      if (e instanceof OcrError) {
        expect(e.code).toBe('PDFTOPPM_NOT_INSTALLED');
      }
    }
  });
});
