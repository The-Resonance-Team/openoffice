import type { Config } from '@openoffice/core';

export type BaseConfig = {
  model?: string;
  permission: { write: 'deny'; bash: 'deny'; edit: 'deny'; officecli: 'allow' };
  share: 'disabled';
  provider?: Record<
    string,
    {
      options?: { apiKey?: string; baseURL?: string };
      models?: Record<string, Record<string, never>>;
    }
  >;
  mcp?: Record<string, unknown>;
};

export function buildBaseConfig(config: Config): BaseConfig {
  // Generic write/bash/edit are denied globally, not per document path: the
  // office document tooling IS the officecli tool file (ADR 0033), so there
  // is nothing else that should ever write — a global deny is a superset of
  // path-scoped deny with no way to slip past the officecli → draft → accept
  // pipeline (ADR 0008).
  //
  // A custom baseURL means a non-official endpoint (local fake, proxy, Cred
  // Proxy). opencode hardwires bundled provider ids (e.g. `openai`) to their
  // official SDK — openai's loader calls `sdk.responses`, which a chat-
  // completions endpoint can't serve. So a custom-endpoint provider is
  // registered under `openai-compatible`, which opencode loads with
  // @ai-sdk/openai-compatible (chat completions), and the model string is
  // rewritten to match. This is internal to the base config: the wire model
  // the daemon reports to clients is untouched.
  const provider: BaseConfig['provider'] = {};
  let model = config.model;
  for (const [name, p] of Object.entries(config.provider ?? {})) {
    const options: NonNullable<BaseConfig['provider']>[string]['options'] = {};
    if (p.apiKey) options.apiKey = p.apiKey;
    if (p.baseURL) options.baseURL = p.baseURL;
    const entry: NonNullable<BaseConfig['provider']>[string] = { options };
    if (p.baseURL) {
      const renamed = 'openai-compatible';
      const modelID = config.model?.split('/')[1];
      if (modelID && config.model?.startsWith(`${name}/`)) {
        entry.models = { [modelID]: {} };
        model = `${renamed}/${modelID}`;
      }
      provider[renamed] = entry;
    } else {
      provider[name] = entry;
    }
  }
  return {
    model,
    permission: { write: 'deny', bash: 'deny', edit: 'deny', officecli: 'allow' },
    share: 'disabled',
    provider: Object.keys(provider).length > 0 ? provider : undefined,
    mcp: config.mcp,
  };
}
