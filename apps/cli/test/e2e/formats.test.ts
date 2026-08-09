import { describe, expect, test, beforeAll } from 'bun:test';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DraftManager, HistoryStore, createDefaultOfficeCliTool } from '@openoffice/core';

import { tempDir, officecliAvailable, runOfficecli } from './helpers';

const skip = !officecliAvailable();

const dataDir = tempDir('ooo-formats-data-');
const projectDir = tempDir('ooo-formats-project-');
let draftManager: DraftManager;
let tool: ReturnType<typeof createDefaultOfficeCliTool>;

const SESSION = 'formats-session';

beforeAll(async () => {
  const history = new HistoryStore(dataDir);
  draftManager = new DraftManager({
    dataDir,
    history,
    execOfficeCli: async (args) => {
      try {
        const stdout = execFileSync('officecli', args, {
          encoding: 'utf-8',
          timeout: 30000,
        });
        return { stdout, exitCode: 0 };
      } catch (e: any) {
        return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
      }
    },
  });
  tool = createDefaultOfficeCliTool({ draftManager });
});

async function edit(command: string, file: string, extra: Record<string, unknown> = {}) {
  const res = await tool.execute(
    { command, file, ...extra } as any,
    {
      sessionID: SESSION,
    } as any,
  );
  expect(res.success).toBe(true);
}

function textOf(file: string, path: string): string {
  const res = runOfficecli(['get', file, path]);
  return res?.data?.results?.[0]?.text ?? '';
}

describe('officecli integration on all three formats', () => {
  test.skipIf(skip)('docx: create → add paragraph → accept → read back', async () => {
    const file = join(projectDir, 'doc.docx');
    await edit('create', file);
    await edit('add', file, {
      parent: '/body',
      type: 'paragraph',
      props: { text: 'Alpha' },
    });
    await draftManager.accept(SESSION, file);
    expect(textOf(file, '/body/p[@paraId=00100000]')).toBe('Alpha');
  });

  test.skipIf(skip)('xlsx: create → set cell → accept → read back', async () => {
    const file = join(projectDir, 'sheet.xlsx');
    await edit('create', file);
    await edit('set', file, { path: '/Sheet1/A1', props: { value: 42 } });
    await draftManager.accept(SESSION, file);
    expect(textOf(file, '/Sheet1/A1')).toBe('42');
  });

  test.skipIf(skip)('pptx: create → add slide + shape → accept → read back', async () => {
    const file = join(projectDir, 'deck.pptx');
    await edit('create', file);
    await edit('add', file, { parent: '/', type: 'slide', index: '1' });
    await edit('add', file, {
      parent: '/slide[1]',
      type: 'shape',
      props: { text: 'Gamma' },
    });
    await draftManager.accept(SESSION, file);
    expect(JSON.stringify(runOfficecli(['get', file, '/slide[1]']))).toContain('Gamma');
  });
});
