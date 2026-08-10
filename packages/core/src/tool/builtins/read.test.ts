import { describe, test, expect } from 'bun:test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReadTool } from './read';

function tempDir(): string {
  const dir = join(tmpdir(), `read-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('createReadTool — PDF routing', () => {
  test('routes .pdf to readPdf when provided', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.pdf');
    writeFileSync(file, '%PDF-1.4');

    let calledWith = '';
    const tool = createReadTool({
      readDocument: async () => 'anydoc result',
      readPdf: async (f: string) => {
        calledWith = f;
        return 'pdf-inspector result';
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
    if (result.success) expect(result.output).toBe('pdf-inspector result');
  });

  test('falls back to readDocument when readPdf not provided', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.pdf');
    writeFileSync(file, '%PDF-1.4');

    let calledWith = '';
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return 'anydoc result';
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test('returns PDF_NO_TEXT_LAYER for scanned PDF error', async () => {
    const dir = tempDir();
    const file = join(dir, 'scanned.pdf');
    writeFileSync(file, '%PDF-1.4');

    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readPdf: async () => {
        const err = new Error('Scanned PDF') as any;
        err.code = 'PDF_NO_TEXT_LAYER';
        throw err;
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('PDF_NO_TEXT_LAYER');
  });

  test('routes non-PDF documents to readDocument', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.docx');
    writeFileSync(file, 'binary');

    let calledWith = '';
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return 'docx content';
      },
      readPdf: async () => 'should not be called',
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });
});

describe('createReadTool — OCR auto-fallback', () => {
  test('auto-falls back to OCR when readPdf throws PDF_NO_TEXT_LAYER', async () => {
    const dir = tempDir();
    const file = join(dir, 'scanned.pdf');
    writeFileSync(file, '%PDF-1.4');

    let ocrCalledWith = '';
    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readPdf: async () => {
        const err = new Error('Scanned PDF') as any;
        err.code = 'PDF_NO_TEXT_LAYER';
        throw err;
      },
      readOcr: async (f: string) => {
        ocrCalledWith = f;
        return 'OCR text content';
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(true);
    expect(ocrCalledWith).toBe(file);
    if (result.success) {
      expect(result.output).toBe('OCR text content');
      expect(result.data).toEqual({ source: 'ocr' });
    }
  });

  test('returns PDF_NO_TEXT_LAYER when readOcr not provided', async () => {
    const dir = tempDir();
    const file = join(dir, 'scanned.pdf');
    writeFileSync(file, '%PDF-1.4');

    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readPdf: async () => {
        const err = new Error('Scanned PDF') as any;
        err.code = 'PDF_NO_TEXT_LAYER';
        throw err;
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('PDF_NO_TEXT_LAYER');
  });

  test('returns OCR_FAILED when OCR fails', async () => {
    const dir = tempDir();
    const file = join(dir, 'scanned.pdf');
    writeFileSync(file, '%PDF-1.4');

    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readPdf: async () => {
        const err = new Error('Scanned PDF') as any;
        err.code = 'PDF_NO_TEXT_LAYER';
        throw err;
      },
      readOcr: async () => {
        throw new Error('Vision model unavailable');
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('OCR_FAILED');
      expect(result.error).toContain('Vision model unavailable');
    }
  });
});

describe('createReadTool — image OCR routing', () => {
  test('routes .png to readOcr when provided', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.png');
    writeFileSync(file, 'binary png data');

    let ocrCalledWith = '';
    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readOcr: async (f: string) => {
        ocrCalledWith = f;
        return 'OCR from image';
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(true);
    expect(ocrCalledWith).toBe(file);
    if (result.success) {
      expect(result.output).toBe('OCR from image');
      expect(result.data).toEqual({ source: 'ocr' });
    }
  });

  test('routes .jpg to readOcr', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.jpg');
    writeFileSync(file, 'binary jpg data');

    let ocrCalledWith = '';
    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readOcr: async (f: string) => {
        ocrCalledWith = f;
        return 'OCR from jpg';
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(true);
    expect(ocrCalledWith).toBe(file);
  });

  test('routes .tiff to readOcr', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.tiff');
    writeFileSync(file, 'binary tiff data');

    let ocrCalledWith = '';
    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readOcr: async (f: string) => {
        ocrCalledWith = f;
        return 'OCR from tiff';
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(true);
    expect(ocrCalledWith).toBe(file);
  });

  test('returns OCR_NOT_AVAILABLE when readOcr not provided', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.png');
    writeFileSync(file, 'binary png data');

    const tool = createReadTool({
      readDocument: async () => 'anydoc',
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('OCR_NOT_AVAILABLE');
      expect(result.error).toContain('OCR not available');
    }
  });

  test('returns OCR_FAILED when image OCR fails', async () => {
    const dir = tempDir();
    const file = join(dir, 'test.png');
    writeFileSync(file, 'binary png data');

    const tool = createReadTool({
      readDocument: async () => 'anydoc',
      readOcr: async () => {
        throw new Error('OCR backend unavailable');
      },
    });
    const result = await tool.execute({ file }, { sessionID: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('OCR_FAILED');
      expect(result.error).toContain('OCR backend unavailable');
    }
  });
});
