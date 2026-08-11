import type { Config } from '@openoffice/core';

export type BaseConfig = {
  model?: string;
  permission: { write: 'deny'; bash: 'deny'; edit: 'deny' };
  share: 'disabled';
  provider?: Record<string, { options?: { apiKey?: string; baseURL?: string } }>;
  mcp?: Record<string, unknown>;
};

export function buildBaseConfig(config: Config): BaseConfig {
  const provider: BaseConfig['provider'] = {};
  for (const [name, p] of Object.entries(config.provider ?? {})) {
    const options: NonNullable<BaseConfig['provider']>[string]['options'] = {};
    if (p.apiKey) options.apiKey = p.apiKey;
    if (p.baseURL) options.baseURL = p.baseURL;
    provider[name] = { options };
  }
  return {
    model: config.model,
    permission: { write: 'deny', bash: 'deny', edit: 'deny' },
    share: 'disabled',
    provider: Object.keys(provider).length > 0 ? provider : undefined,
    mcp: config.mcp,
  };
}
