import { streamText, isStepCount, type ModelMessage } from 'ai';
import { resolveModel } from './providers';
import { streamWithRetry } from './retry';
import type { Config } from '../config';

export interface CompleteOptions {
  model: string;
  messages: ModelMessage[];
  config: Config;
  prompt: string;
}

// One plain completion (no tools) with a system prompt.
export async function complete({
  model,
  messages,
  config,
  prompt,
}: CompleteOptions): Promise<string> {
  const stream = streamWithRetry(
    () =>
      streamText({
        model: resolveModel(model, config),
        messages: [{ role: 'system', content: prompt }, ...messages],
        stopWhen: isStepCount(1),
      }),
    { maxAttempts: config.llm?.retry?.max },
  );
  let text = '';
  for await (const chunk of stream.textStream) text += chunk;
  return text;
}
