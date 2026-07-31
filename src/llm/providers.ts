import type { Config } from "../config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogle } from "@ai-sdk/google";

type ProviderFactory = (apiKey?: string) => any;

const providers: Record<string, ProviderFactory> = {
  anthropic: (key) => createAnthropic({ apiKey: key }),
  openai: (key) => createOpenAI({ apiKey: key }),
  google: (key) => createGoogle({ apiKey: key }),
};

export function resolveModel(modelString: string, config: Config): any {
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

  const apiKey = config.provider?.[providerName]?.apiKey;
  return factory(apiKey)(modelId);
}
