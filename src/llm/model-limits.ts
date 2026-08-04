// Static model-context catalog. Replaces the models.dev fetch+cache — opencode
// gets limits from its bundled catalog; we hardcode the models this project
// runs, with a conservative fallback for anything unknown.

export interface ModelLimits {
  context: number;
  input?: number;
  output?: number;
}

export interface Model {
  id: string;
  providerID: string;
  modelID: string;
  limit: ModelLimits;
}

export function splitModel(model: string): [string, string] {
  const idx = model.indexOf("/");
  if (idx < 0) return ["", model];
  return [model.slice(0, idx), model.slice(idx + 1)];
}

const DEFAULT_CONTEXT = 128_000;
const DEFAULT_OUTPUT = 8_192;

const CATALOG: [string, number, number?][] = [
  ["anthropic/claude", 200_000, 64_000],
  ["openai/gpt-5", 400_000, 64_000],
  ["openai/o4-mini", 200_000, 64_000],
  ["openai/gpt-4.1", 1_047_576, 32_768],
  ["openai/gpt-4o", 128_000, 16_384],
  ["google/gemini", 1_000_000, 64_000],
  ["openrouter/llama-3.3-70b", 128_000, 8_192],
];

export function getModel(model: string): Model {
  const [providerID, modelID] = splitModel(model);
  const match = CATALOG.find(([prefix]) => model.startsWith(prefix));
  const [context, output] = match
    ? [match[1], match[2]]
    : [DEFAULT_CONTEXT, DEFAULT_OUTPUT];
  return {
    id: model,
    providerID,
    modelID,
    limit: { context, output },
  };
}

// opencode's ProviderTransform.maxOutputTokens equivalent.
export function maxOutputTokens(model: Model, outputTokenMax?: number): number {
  const limit = model.limit.output ?? DEFAULT_OUTPUT;
  return outputTokenMax === undefined ? limit : Math.min(outputTokenMax, limit);
}
