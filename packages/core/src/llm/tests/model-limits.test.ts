import { describe, expect, test } from 'bun:test';
import { splitModel, getModel, maxOutputTokens } from '../model-limits';

describe('splitModel', () => {
  test('splits provider and model id', () => {
    expect(splitModel('anthropic/claude-sonnet-4')).toEqual(['anthropic', 'claude-sonnet-4']);
  });

  test('returns empty provider when no slash', () => {
    expect(splitModel('gpt-4o')).toEqual(['', 'gpt-4o']);
  });
});

describe('getModel', () => {
  test('looks up known catalog entries', () => {
    const model = getModel('anthropic/claude-sonnet-4');
    expect(model.providerID).toBe('anthropic');
    expect(model.limit.context).toBe(200_000);
    expect(model.limit.output).toBe(64_000);
  });

  test('falls back to defaults for unknown models', () => {
    const model = getModel('custom/mystery-model');
    expect(model.limit.context).toBe(128_000);
    expect(model.limit.output).toBe(8_192);
  });
});

describe('maxOutputTokens', () => {
  test('uses model limit when no explicit cap', () => {
    const model = getModel('openai/gpt-5');
    expect(maxOutputTokens(model)).toBe(64_000);
  });

  test('caps to the smaller of explicit and limit', () => {
    const model = getModel('openai/gpt-5');
    expect(maxOutputTokens(model, 10_000)).toBe(10_000);
    expect(maxOutputTokens(model, 100_000)).toBe(64_000);
  });
});
