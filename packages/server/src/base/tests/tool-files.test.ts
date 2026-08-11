import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeOfficeCliToolFile } from '../tool-files';

describe('writeOfficeCliToolFile', () => {
  test('writes a self-contained tool/officecli.ts with no imports', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oo-toolfile-'));
    const path = writeOfficeCliToolFile(dir);
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('export default {');
    expect(content).toContain('description:');
    expect(content).toContain('args:');
    expect(content).toContain('execute(args, ctx)');
    // Self-contained: no bare imports (the base process has no openoffice
    // packages); node: imports resolve against the base's own runtime.
    expect(content).not.toMatch(/^import /m);
    expect(content).toContain("import('node:fs')");
    expect(content).toContain('x-openoffice-base-token');
    expect(content).toContain('OPENOFFICE_DATA_DIR');
    expect(content).toContain('/internal/officecli');
  });

  test('args schema covers the core officecli verbs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oo-toolfile-'));
    const path = writeOfficeCliToolFile(dir);
    const content = readFileSync(path, 'utf-8');
    for (const field of [
      'command',
      'file',
      'path',
      'parent',
      'props',
      'operations',
      'template',
      'source',
    ]) {
      expect(content).toContain(`"${field}":`);
    }
  });
});
