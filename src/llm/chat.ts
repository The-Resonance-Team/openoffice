import { streamText, isStepCount, type ModelMessage } from "ai";
import { resolveModel } from "./providers";
import { streamWithRetry, type RetryInfo } from "./retry";
import type { Config } from "../config";

export interface ChatOptions {
  model: string;
  messages: ModelMessage[];
  tools?: Record<string, any>;
  system?: string;
  maxSteps?: number;
  onRetry?: (info: RetryInfo) => void;
}

export function chat(options: ChatOptions, config: Config) {
  const { model, messages, tools, system, maxSteps = 50, onRetry } = options;

  return streamWithRetry(
    () =>
      streamText({
        model: resolveModel(model, config),
        messages,
        tools,
        instructions: system,
        stopWhen: isStepCount(maxSteps),
      }),
    { maxAttempts: config.llm?.retry?.max, onRetry }
  );
}
