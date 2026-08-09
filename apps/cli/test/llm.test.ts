import { describe, expect, test } from 'bun:test';
import { resolveModel, chat, type Config } from '@openoffice/core';

const config: Config = {
  provider: {
    anthropic: { apiKey: 'test-key' },
    openai: { apiKey: 'test-key' },
  },
};

describe('resolveModel', () => {
  test('parses anthropic/claude-sonnet-4-20250514', () => {
    const model = resolveModel('anthropic/claude-sonnet-4-20250514', config);
    expect(model).toBeDefined();
  });

  test('parses openai/gpt-4o', () => {
    const model = resolveModel('openai/gpt-4o', config);
    expect(model).toBeDefined();
  });

  test('throws on invalid format (no slash)', () => {
    expect(() => resolveModel('bad', config)).toThrow('expected format');
  });

  test('throws on unknown provider', () => {
    expect(() => resolveModel('nobody/model', config)).toThrow('Unknown provider "nobody"');
  });
});

describe('chat', () => {
  test('returns a streamText result', () => {
    const result = chat(
      {
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'hello' }],
      },
      config,
    );
    // streamText returns an object with textStream (async iterable)
    expect(result).toBeDefined();
    expect(result.textStream).toBeDefined();
  });

  test('throws on invalid model string', () => {
    expect(() =>
      chat(
        {
          model: 'bad-model',
          messages: [{ role: 'user', content: 'hello' }],
        },
        config,
      ),
    ).toThrow('expected format');
  });

  test('accepts tools parameter', () => {
    const result = chat(
      {
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'hello' }],
        tools: { echo: {} as any },
      },
      config,
    );
    expect(result).toBeDefined();
  });
});
