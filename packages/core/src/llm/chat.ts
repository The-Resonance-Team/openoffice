import { streamText, isStepCount, type ModelMessage, type StepResult, type ToolSet } from 'ai';
import { resolveModel } from './providers';
import { streamWithRetry, type RetryInfo } from './retry';
import type { Config } from '../config';

export interface ChatOptions {
  model: string;
  messages: ModelMessage[];
  tools?: ToolSet;
  system?: string;
  maxSteps?: number;
  onRetry?: (info: RetryInfo) => void;
}

export function chat(options: ChatOptions, config: Config) {
  const { model, messages, tools, system, maxSteps = 50, onRetry } = options;

  let hitStepCap = false;
  const capped = isStepCount(maxSteps);
  // ponytail: generic callback — StopCondition's own generics (ToolSet, Context)
  // are too deep to pin; a generic function infers at the streamText call site.
  const stopWhen = <S extends ToolSet, C extends Record<string, unknown>>(result: {
    steps: StepResult<S, C>[];
  }) => {
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
