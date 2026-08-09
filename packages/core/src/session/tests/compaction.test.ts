import { describe, expect, test } from 'bun:test';
import { prune, applyPrune, select } from '../compaction';
import type { WithParts, ToolPart } from '../parts';
import type { Config } from '../../config';

const makeToolPart = (tool: string, output: string, compacted?: number): ToolPart => ({
  type: 'tool',
  tool,
  callID: `call-${Math.random()}`,
  state: {
    status: 'completed',
    input: '',
    output,
    time: compacted ? { compacted } : undefined,
  },
});

const makeMsg = (
  role: 'user' | 'assistant',
  parts: any[] = [],
  tokens?: { input: number; output: number },
): WithParts => ({
  info: {
    id: `msg-${Math.random()}`,
    role,
    time: { created: Date.now() },
    tokens,
  },
  parts,
});

describe('prune()', () => {
  test('returns empty when prune is disabled', () => {
    const config: Config = { compaction: { prune: false } };
    const msgs = [makeMsg('assistant', [makeToolPart('bash', 'x'.repeat(5000))])];
    expect(prune(msgs, config)).toEqual([]);
  });

  test('returns empty when under minimum threshold', () => {
    const config: Config = {
      compaction: { prune: true, pruneMinimumTokens: 20_000 },
    };
    const msgs = [makeMsg('user'), makeMsg('assistant', [makeToolPart('bash', 'x'.repeat(1000))])];
    expect(prune(msgs, config)).toEqual([]);
  });

  test('prunes tool outputs beyond protect threshold', () => {
    const config: Config = {
      compaction: {
        prune: true,
        pruneProtectTokens: 1000,
        pruneMinimumTokens: 100,
      },
    };
    const msgs = [
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'x'.repeat(5000))]),
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'y'.repeat(5000))]),
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'z'.repeat(5000))]),
    ];
    const pruned = prune(msgs, config);
    expect(pruned.length).toBeGreaterThan(0);
  });

  test('skips protected tools', () => {
    const config: Config = {
      compaction: {
        prune: true,
        pruneProtectTokens: 100,
        pruneMinimumTokens: 10,
      },
    };
    const msgs = [
      makeMsg('user'),
      makeMsg('assistant', [
        makeToolPart('skill', 'x'.repeat(5000)),
        makeToolPart('bash', 'a'.repeat(5000)),
      ]),
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'y'.repeat(5000))]),
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'z'.repeat(5000))]),
    ];
    const pruned = prune(msgs, config);
    expect(pruned.length).toBeGreaterThan(0);
    expect(pruned.every((p) => p.tool !== 'skill')).toBe(true);
  });

  test('stops at already-compacted parts', () => {
    const config: Config = {
      compaction: {
        prune: true,
        pruneProtectTokens: 100,
        pruneMinimumTokens: 10,
      },
    };
    const msgs = [
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'x'.repeat(5000), Date.now())]),
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'y'.repeat(5000))]),
      makeMsg('user'),
      makeMsg('assistant', [makeToolPart('bash', 'z'.repeat(5000))]),
    ];
    const pruned = prune(msgs, config);
    expect(pruned).toEqual([]);
  });
});

describe('select()', () => {
  test('returns all messages when tailTurns is 0', async () => {
    const config: Config = { compaction: { tailTurns: 0 } };
    const msgs = [makeMsg('user'), makeMsg('assistant')];
    const result = await select({
      messages: msgs,
      cfg: config,
      model: {
        id: 'test',
        providerID: 'test',
        modelID: 'test',
        limit: { context: 100000 },
      },
    });
    expect(result.head).toEqual(msgs);
    expect(result.tail_start_id).toBeUndefined();
  });

  test('keeps last N turns within budget', async () => {
    const config: Config = {
      compaction: { tailTurns: 2, preserveRecentTokens: 10000 },
    };
    const msgs = [
      makeMsg('user'),
      makeMsg('assistant'),
      makeMsg('user'),
      makeMsg('assistant'),
      makeMsg('user'),
      makeMsg('assistant'),
    ];
    const result = await select({
      messages: msgs,
      cfg: config,
      model: {
        id: 'test',
        providerID: 'test',
        modelID: 'test',
        limit: { context: 100000 },
      },
    });
    expect(result.head.length).toBeLessThan(msgs.length);
    expect(result.tail_start_id).toBeDefined();
  });
});
