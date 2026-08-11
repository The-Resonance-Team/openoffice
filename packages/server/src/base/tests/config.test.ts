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
  test('locks down generic write/bash/edit and enables officecli tool file', () => {
    const cfg = buildBaseConfig(base);
    expect(cfg.permission).toEqual({
      write: 'deny',
      bash: 'deny',
      edit: 'deny',
    });
  });

  test('share is disabled regardless of openoffice share mode', () => {
    expect(buildBaseConfig(base).share).toBe('disabled');
    expect(buildBaseConfig({ ...base, share: 'disabled' }).share).toBe('disabled');
  });

  test('model passes through', () => {
    expect(buildBaseConfig(base).model).toBe('anthropic/claude-sonnet-4-20250514');
  });

  test('provider apiKey/baseURL map into options', () => {
    const cfg = buildBaseConfig(base);
    expect(cfg.provider).toEqual({
      anthropic: { options: { apiKey: 'env:ANTHROPIC_KEY' } },
      openai: { options: { baseURL: 'http://proxy.local/v1', apiKey: 'sk-test' } },
    });
  });

  test('mcp servers pass through', () => {
    const cfg = buildBaseConfig(base);
    expect(cfg.mcp).toEqual(base.mcp);
  });

  test('empty config still locks down write/bash/edit and disables share', () => {
    const cfg = buildBaseConfig({});
    expect(cfg.permission).toEqual({ write: 'deny', bash: 'deny', edit: 'deny' });
    expect(cfg.share).toBe('disabled');
    expect(cfg.model).toBeUndefined();
  });
});
