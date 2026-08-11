import { describe, expect, test } from 'bun:test';
import { buildBaseConfig } from '../config';
import type { Config } from '@openoffice/core';

const base: Config = {
  model: 'anthropic/claude-sonnet-4-20250514',
  share: 'auto',
  provider: {
    anthropic: { apiKey: 'env:ANTHROPIC_KEY' },
    openai: { baseURL: 'http://proxy.local/v1', apiKey: 'sk-test' },
  },
  mcp: {
    files: { type: 'local', command: ['npx', 'files-mcp'] },
    remote: { type: 'remote', url: 'https://mcp.example.com/sse' },
  },
};

describe('buildBaseConfig', () => {
  test('locks down generic write/bash/edit, allows the officecli tool file', () => {
    const cfg = buildBaseConfig(base);
    expect(cfg.permission).toEqual({
      write: 'deny',
      bash: 'deny',
      edit: 'deny',
      officecli: 'allow',
    });
  });

  test('share is disabled regardless of openoffice share mode', () => {
    expect(buildBaseConfig(base).share).toBe('disabled');
    expect(buildBaseConfig({ ...base, share: 'disabled' }).share).toBe('disabled');
  });

  test('model passes through', () => {
    expect(buildBaseConfig(base).model).toBe('anthropic/claude-sonnet-4-20250514');
  });

  test('provider apiKey/baseURL map into options; custom endpoints are renamed', () => {
    const cfg = buildBaseConfig(base);
    expect(cfg.provider).toEqual({
      anthropic: { options: { apiKey: 'env:ANTHROPIC_KEY' } },
      // Custom baseURL → openai-compatible loader (chat completions), not the
      // bundled openai loader (Responses API).
      'openai-compatible': {
        options: { baseURL: 'http://proxy.local/v1', apiKey: 'sk-test' },
      },
    });
  });

  test('custom-baseURL providers register the model and rewrite the model string', () => {
    const cfg = buildBaseConfig({
      model: 'openai/e2e',
      provider: { openai: { baseURL: 'http://127.0.0.1:9/v1', apiKey: 'k' } },
    });
    expect(cfg.model).toBe('openai-compatible/e2e');
    expect(cfg.provider!['openai-compatible'].models).toEqual({ e2e: {} });
  });

  test('catalog providers without baseURL are unchanged, model untouched', () => {
    const cfg = buildBaseConfig({
      model: 'anthropic/claude-sonnet-4-20250514',
      provider: { anthropic: { apiKey: 'k' } },
    });
    expect(cfg.model).toBe('anthropic/claude-sonnet-4-20250514');
    expect(cfg.provider!.anthropic.models).toBeUndefined();
  });

  test('non-default-model providers with baseURL rewrite only their own model', () => {
    const cfg = buildBaseConfig({
      model: 'openai/gpt-4o',
      provider: { openai: { baseURL: 'http://proxy/v1', apiKey: 'k' } },
    });
    expect(cfg.model).toBe('openai-compatible/gpt-4o');
  });

  test('mcp servers pass through', () => {
    const cfg = buildBaseConfig(base);
    expect(cfg.mcp).toEqual(base.mcp);
  });

  test('empty config still locks down write/bash/edit and disables share', () => {
    const cfg = buildBaseConfig({});
    expect(cfg.permission).toEqual({
      write: 'deny',
      bash: 'deny',
      edit: 'deny',
      officecli: 'allow',
    });
    expect(cfg.share).toBe('disabled');
    expect(cfg.model).toBeUndefined();
  });
});
