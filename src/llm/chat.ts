import { streamText, isStepCount, type ModelMessage } from "ai";
import { resolveModel } from "./providers";
import type { Config } from "../config";

export interface ChatOptions {
  model: string;
  messages: ModelMessage[];
  tools?: Record<string, any>;
  system?: string;
  maxSteps?: number;
}

export function chat(options: ChatOptions, config: Config) {
  const { model, messages, tools, system, maxSteps = 50 } = options;

  return streamText({
    model: resolveModel(model, config),
    messages,
    tools,
    instructions: system,
    stopWhen: isStepCount(maxSteps),
  });
}
