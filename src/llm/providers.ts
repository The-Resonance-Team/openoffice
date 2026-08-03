import type { Config } from "../config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogle } from "@ai-sdk/google";
import { CredentialStore } from "../auth/store";
import type { ProviderConfigSchema } from "../config/schema";

type ProviderConfig = { apiKey?: string; authToken?: string };
type ProviderFactory = (config: ProviderConfig) => any;
type ParsedProviderConfig = ReturnType<typeof ProviderConfigSchema.parse>;

export const BUILTIN_PROVIDERS = ["anthropic", "openai", "google"] as const;

const providers: Record<string, ProviderFactory> = {
  anthropic: (c) =>
    createAnthropic({ apiKey: c.apiKey, authToken: c.authToken }),
  openai: (c) => createOpenAI({ apiKey: c.apiKey }),
  google: (c) => createGoogle({ apiKey: c.apiKey }),
};

// Resolution order: an explicit config apiKey (env:-resolved at load) always
// wins; then a stored Credential from `openoffice auth login`; with neither,
// a declared provider entry errors clearly, while an undeclared provider falls
// back to the SDK's own env reading (e.g. ANTHROPIC_API_KEY), unchanged.
export function resolveCredential(
  providerConfig: ParsedProviderConfig | undefined,
  providerName: string,
  store: CredentialStore
): { apiKey?: string; authToken?: string } {
  if (providerConfig?.apiKey !== undefined) {
    return { apiKey: providerConfig.apiKey };
  }
  const credential = store.get(providerName);
  if (credential === undefined) {
    if (providerConfig !== undefined) {
      throw new Error(
        `Provider "${providerName}": no credential. Set \`provider.${providerName}.apiKey\` in config (or export the env: variable it references), or run \`openoffice auth login ${providerName}\`.`
      );
    }
    return {};
  }
  if (credential.type === "api") return { apiKey: credential.key };
  if (credential.expires !== undefined && credential.expires <= Date.now()) {
    throw new Error(
      `Stored credential for ${providerName} is expired — run \`openoffice auth login ${providerName}\` to re-authenticate.`
    );
  }
  // ponytail: OAuth credentials cannot be created yet (no SDK OAuth flow);
  // access tokens are handed to the SDK as `authToken` (Authorization: Bearer).
  return { authToken: credential.access };
}

export function resolveModel(
  modelString: string,
  config: Config,
  store: CredentialStore = new CredentialStore()
): any {
  const slash = modelString.indexOf("/");
  if (slash === -1) {
    throw new Error(
      `Invalid model string "${modelString}" — expected format "provider/model-id"`
    );
  }
  const providerName = modelString.slice(0, slash);
  const modelId = modelString.slice(slash + 1);

  const factory = providers[providerName];
  if (!factory) {
    throw new Error(
      `Unknown provider "${providerName}" — supported: ${Object.keys(providers).join(", ")}`
    );
  }

  const providerConfig = config.provider?.[providerName];
  const { apiKey, authToken } = resolveCredential(
    providerConfig,
    providerName,
    store
  );
  return factory({ apiKey, authToken })(modelId);
}
