// Probes common local model servers and reports what's actually running.
// Deliberately informational: model strings from llama.cpp/vLLM include
// `provider/model-id` refs (e.g. "meta-llama/Llama-3.1-8B"), so a discovered
// model is not automatically a usable `model:` value — a custom endpoint
// provider must be configured for those. ollama names are usable directly
// as `ollama/<name>`.

export interface DiscoveredModel {
  server: string;
  models: string[];
}

const ENDPOINTS = [
  { server: 'ollama', url: 'http://localhost:11434/api/tags' },
  { server: 'llama.cpp', url: 'http://localhost:8080/v1/models' },
  { server: 'vLLM', url: 'http://localhost:8000/v1/models' },
] as const;

async function probe(
  server: string,
  url: string,
  timeoutMs: number,
): Promise<DiscoveredModel | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as
      { models?: { name?: string }[] } | { data?: { id?: string }[] };
    const data = 'data' in body ? (body.data ?? []) : [];
    const named = 'models' in body ? (body.models ?? []) : [];
    const models = data
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id))
      .concat(named.map((m) => m.name).filter((name): name is string => Boolean(name)));
    return models.length > 0 ? { server, models } : null;
  } catch {
    return null;
  }
}

export async function discoverLocalModels(timeoutMs = 1000): Promise<DiscoveredModel[]> {
  const results = await Promise.all(
    ENDPOINTS.map((endpoint) => probe(endpoint.server, endpoint.url, timeoutMs)),
  );
  return results.filter((result): result is DiscoveredModel => result !== null);
}
