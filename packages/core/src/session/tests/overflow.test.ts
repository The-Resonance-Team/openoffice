import { describe, expect, test } from 'bun:test';
import { isOverflow, usable } from '../overflow';
import type { Model } from '../../llm/model-limits';

const makeModel = (context: number, input?: number): Model => ({
  id: 'test',
  providerID: 'test',
  modelID: 'test',
  limit: { context, input, output: 8192 },
});

describe('usable()', () => {
  test('returns context minus reserved when no input limit', () => {
    const model = makeModel(100_000);
    const result = usable({ reservedTokens: 10_000 }, model);
    expect(result).toBe(100_000 - 8192);
  });

  test('returns input limit minus reserved when set', () => {
    const model = makeModel(100_000, 50_000);
    const result = usable({ reservedTokens: 10_000 }, model);
    expect(result).toBe(50_000 - 10_000);
  });

  test('returns 0 when context is 0', () => {
    const model = makeModel(0);
    expect(usable({}, model)).toBe(0);
  });

  test('uses default reserved when not specified', () => {
    const model = makeModel(100_000);
    const result = usable({}, model);
    expect(result).toBeGreaterThan(0);
  });
});

describe('isOverflow()', () => {
  test('returns false when auto is disabled', () => {
    const model = makeModel(100_000);
    const tokens = { input: 90_000, output: 5_000 };
    expect(isOverflow({ auto: false }, tokens, model)).toBe(false);
  });

  test('returns false when context is 0', () => {
    const model = makeModel(0);
    const tokens = { input: 1000, output: 100 };
    expect(isOverflow({}, tokens, model)).toBe(false);
  });

  test('returns true when tokens exceed usable', () => {
    const model = makeModel(100_000, 50_000);
    const tokens = { input: 45_000, output: 5_000 };
    expect(isOverflow({ reservedTokens: 1000 }, tokens, model)).toBe(true);
  });

  test('returns false when tokens under usable', () => {
    const model = makeModel(100_000, 50_000);
    const tokens = { input: 10_000, output: 1_000 };
    expect(isOverflow({ reservedTokens: 1000 }, tokens, model)).toBe(false);
  });
});
