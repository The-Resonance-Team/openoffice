import { describe, test, expect, beforeEach } from 'bun:test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readViaVision, resetProbeCache, type VisionDeps } from '../vision';

function tempDir(): string {
  const dir = join(tmpdir(), `vision-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function mockDeps(
  overrides: Partial<VisionDeps> = {},
): VisionDeps & { calls: { dataUrl: string }[] } {
  const calls: { dataUrl: string }[] = [];
  return {
    model: 'test/vision-model',
    complete: async (options) => {
      const image = (options.messages[0].content as Array<{ type: string; image?: string }>).find(
        (c) => c.type === 'image',
      );
      calls.push({ dataUrl: image?.image ?? '' });
      return 'Extracted text';
    },
    ...overrides,
    calls,
  } as VisionDeps & { calls: { dataUrl: string }[] };
}

beforeEach(() => {
  resetProbeCache();
});

describe('readViaVision — direct image reading', () => {
  test('passes the image as a base64 data URL to the session model', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.png');
    writeFileSync(file, 'fake png bytes');

    const deps = mockDeps();
    const result = await readViaVision(file, deps);

    expect(result.startsWith('[OCR:')).toBe(true);
    expect(result).toContain('Extracted text');
    expect(deps.calls.length).toBe(1);
    expect(deps.calls[0].dataUrl).toStartWith('data:image/png;base64,');
  });

  test('passes the session model to the vision call', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.jpg');
    writeFileSync(file, 'fake jpg bytes');

    let usedModel = '';
    const deps = mockDeps({
      model: 'anthropic/claude-sonnet-4',
      complete: async (options) => {
        usedModel = options.model;
        return 'text';
      },
    });
    await readViaVision(file, deps);

    expect(usedModel).toBe('anthropic/claude-sonnet-4');
  });

  test('wraps vision model failures in an OCR_FAILED error', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.png');
    writeFileSync(file, 'fake png bytes');

    const deps = mockDeps({
      complete: async () => {
        throw new Error('model exploded');
      },
    });

    try {
      await readViaVision(file, deps);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error & { code?: string }).code).toBe('OCR_FAILED');
      expect((e as Error).message).toContain('model exploded');
    }
  });
});

describe('readViaVision — PDF rasterize-then-read', () => {
  test('throws PDFTOPPM_NOT_INSTALLED when pdftoppm missing', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.pdf');
    writeFileSync(file, '%PDF-1.4');

    // Probe stubbed: CI runners have pdftoppm installed, so the real probe
    // would rasterize (and fail on the fake PDF) instead of reporting the
    // missing binary.
    const deps = mockDeps({ checkPdftoppm: async () => false });

    try {
      await readViaVision(file, deps);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect((e as Error & { code?: string }).code).toBe('PDFTOPPM_NOT_INSTALLED');
    }
  });
});

describe('readViaVision — unsupported file types', () => {
  test('throws on unsupported file extension', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.xyz');
    writeFileSync(file, 'content');

    await expect(readViaVision(file, mockDeps())).rejects.toThrow(Error);
  });
});
