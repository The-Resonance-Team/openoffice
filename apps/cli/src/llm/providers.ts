import type { Config } from "../config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogle } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createOllama } from "ollama-ai-provider";
import { CredentialStore } from "../auth/store";
import type { ProviderConfigSchema } from "../config/schema";

type ProviderConfig = {
  apiKey?: string;
  authToken?: string;
  baseURL?: string;
  region?: string;
};
type ProviderFactory = (config: ProviderConfig) => any;
type ParsedProviderConfig = ReturnType<typeof ProviderConfigSchema.parse>;

export const BUILTIN_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "ollama",
  "openrouter",
  "azure",
  "bedrock",
] as const;

// Providers that authenticate outside the apiKey/authToken path: ollama runs
// unauthenticated locally, bedrock uses the AWS credential chain.
const NO_CREDENTIAL_PROVIDERS = new Set(["ollama", "bedrock"]);

export class AuthRequiredError extends Error {
  constructor(
    public provider: string,
    message?: string
  ) {
    super(message ?? `Provider "${provider}" requires authentication`);
  }
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const providers: Record<string, ProviderFactory> = {
  anthropic: (c) =>
    createAnthropic({
      apiKey: c.apiKey,
      authToken: c.authToken,
      baseURL: c.baseURL,
    }),
  openai: (c) => {
    const client = createOpenAI({ apiKey: c.apiKey });
    return c.baseURL
      ? (modelId: string) =>
          createOpenAI({ apiKey: c.apiKey, baseURL: c.baseURL }).chat(modelId)
      : (modelId: string) => client(modelId);
  },
  google: (c) => createGoogle({ apiKey: c.apiKey }),
  ollama: (c) =>
    createOllama({ baseURL: c.baseURL ?? "http://localhost:11434" }),
  openrouter: (c) =>
    createOpenAI({
      apiKey: c.apiKey,
      baseURL: c.baseURL ?? OPENROUTER_BASE_URL,
    }),
  azure: (c) => createAzure({ baseURL: c.baseURL, apiKey: c.apiKey }),
  bedrock: (c) => createAmazonBedrock({ region: c.region }),
};

const PROVIDER_ENV_VAR: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

// Custom endpoints: `provider.<name>.baseURL` + `compatibility` turns any
// provider name into an OpenAI- or Anthropic-compatible base URL.
function customFactory(
  providerName: string,
  providerConfig: ParsedProviderConfig
): ProviderFactory {
  const compatibility = providerConfig.compatibility ?? "openai";
  return (c) => {
    if (!c.baseURL) {
      throw new Error(
        `Provider "${providerName}": a custom ${compatibility} provider needs \`provider.${providerName}.baseURL\`.`
      );
    }
    return compatibility === "anthropic"
      ? createAnthropic({
          apiKey: c.apiKey,
          authToken: c.authToken,
          baseURL: c.baseURL,
        })
      : createOpenAI({ apiKey: c.apiKey, baseURL: c.baseURL });
  };
}

// Resolution order: an explicit config apiKey (env:-resolved at load) always
// wins; then a stored Credential from `openoffice auth login`; with neither,
// a declared provider entry errors clearly, and an undeclared provider falls
// back to the SDK's own env var — but that env var's presence is checked
// here too, so a missing key surfaces as a clean 401 instead of the AI SDK's
// own uncaught error deep inside the first streamed request.
export function resolveCredential(
  providerConfig: ParsedProviderConfig | undefined,
  providerName: string,
  store: CredentialStore
): { apiKey?: string; authToken?: string } {
  if (providerConfig?.apiKey !== undefined)
    return { apiKey: providerConfig.apiKey };
  const credential = store.get(providerName);
  if (credential === undefined) {
    const envVar = PROVIDER_ENV_VAR[providerName];
    if (envVar !== undefined && process.env[envVar] !== undefined) {
      return {};
    }
    if (providerConfig !== undefined) {
      throw new AuthRequiredError(
        providerName,
        `Provider "${providerName}": no credential. Set \`provider.${providerName}.apiKey\` in config (or export the env: variable it references), or run \`openoffice auth login ${providerName}\`.`
      );
    }
    throw new AuthRequiredError(
      providerName,
      `Provider "${providerName}": no credential. Export ${envVar ?? "the provider's API key env var"}, or run \`openoffice auth login ${providerName}\`.`
    );
  }
  if (credential.type === "api") return { apiKey: credential.key };
  if (credential.expires !== undefined && credential.expires <= Date.now()) {
    throw new AuthRequiredError(
      providerName,
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

  const providerConfig = config.provider?.[providerName];
  let factory = providers[providerName];
  if (!factory && providerConfig?.compatibility !== undefined) {
    factory = customFactory(providerName, providerConfig);
  }
  if (!factory) {
    throw new Error(
      `Unknown provider "${providerName}" — supported: ${Object.keys(providers).join(", ")}. For a custom endpoint, set \`provider.${providerName}.baseURL\` with \`compatibility: "openai" | "anthropic"\`.`
    );
  }

  const credentials = NO_CREDENTIAL_PROVIDERS.has(providerName)
    ? {}
    : resolveCredential(providerConfig, providerName, store);
  return factory({
    apiKey: credentials.apiKey,
    authToken: credentials.authToken,
    baseURL: providerConfig?.baseURL,
    region: providerConfig?.region,
  })(modelId);
}
