import { streamText, isStepCount, type ModelMessage } from 'ai';
import { resolveModel } from './providers';
import { streamWithRetry, type RetryInfo } from './retry';
import type { Config } from '../config';

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

  let hitStepCap = false;
  const capped = isStepCount(maxSteps);
  // ponytail: `steps: any[]` — mirrors StopCondition's parameter shape without
  // importing the AI SDK's deeply-generic StepResult type; the runtime check
  // is unchanged from isStepCount's own semantics.
  const stopWhen = (result: { steps: any[] }) => {
    if (capped(result)) {
      hitStepCap = true;
      return true;
    }
    return false;
  };

  const stream = streamWithRetry(
    () => {
      // Each retry attempt starts a fresh stream; the flag reflects the
      // attempt that actually completed.
      hitStepCap = false;
      return streamText({
        model: resolveModel(model, config),
        messages,
        tools,
        instructions: system,
        stopWhen,
      });
    },
    { maxAttempts: config.llm?.retry?.max, onRetry },
  );

  return { ...stream, hitStepCap: () => hitStepCap };
}
