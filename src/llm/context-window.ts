import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "../data-dir";
import type { Config } from "../config";
import snapshot from "./data/models.json";

export interface ModelLimits {
  context: number;
  output: number;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface LimitsCatalog {
  [provider: string]: { models: Record<string, { limit: ModelLimits }> };
}

// Vendored fallback: limits-only snapshot of every OpenAI/Anthropic/Google-compatible
// provider on models.dev. Regenerate with:
//   curl -s https://models.dev/api.json | bun -e '...trim to npm in [@ai-sdk/openai, @ai-sdk/openai-compatible, @ai-sdk/anthropic, @ai-sdk/google], keep {models:{id:{limit}}}...' > src/llm/data/models.json
const SNAPSHOT = snapshot as unknown as LimitsCatalog;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

const cachePath = () => join(getDataDir(), "models.json");

let cachedCatalog: LimitsCatalog | null = null;
let cachedAt = 0;

export function splitModel(model: string): [string, string] {
  const slash = model.indexOf("/");
  if (slash === -1) return [model, model];
  return [model.slice(0, slash), model.slice(slash + 1)];
}

export function lookupLimits(
  catalog: LimitsCatalog,
  model: string
): ModelLimits | undefined {
  const [provider, modelId] = splitModel(model);
  const exact = catalog[provider]?.models?.[modelId]?.limit;
  if (exact) return exact;
  // Custom baseURL endpoints use an arbitrary provider name; the model id is
  // still a real one on models.dev — find its limit anywhere.
  for (const entry of Object.values(catalog)) {
    const found = entry.models?.[modelId]?.limit;
    if (found) return found;
  }
  return undefined;
}

export function usableTokens(limits: ModelLimits, config?: Config): number {
  if (limits.context <= 0) return 0;
  const reserved =
    config?.compaction?.reservedTokens ?? Math.min(20_000, limits.output);
  return Math.max(0, limits.context - reserved);
}

async function loadCatalog(fetchFn: FetchLike): Promise<LimitsCatalog> {
  let cacheText: string | null = null;
  let fresh = false;
  try {
    const path = cachePath();
    const fileStat = await stat(path);
    cacheText = await readFile(path, "utf8");
    fresh = Date.now() - fileStat.mtimeMs < CACHE_TTL_MS;
  } catch {
    cacheText = null;
  }

  if (!fresh) {
    try {
      const response = await fetchFn("https://models.dev/api.json", {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.ok) {
        const text = await response.text();
        const parsed = JSON.parse(text) as LimitsCatalog;
        try {
          const path = cachePath();
          const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
          await writeFile(tmp, text, "utf8");
          await rename(tmp, path);
        } catch {
          // ponytail: cache write failure is not worth failing the lookup over
        }
        return parsed;
      }
    } catch {
      // offline: fall through to stale cache or snapshot
    }
  }

  if (cacheText !== null) {
    try {
      return JSON.parse(cacheText) as LimitsCatalog;
    } catch {
      // corrupt cache: fall through to snapshot
    }
  }
  return SNAPSHOT;
}

export async function getModelLimits(
  model: string,
  config?: Config,
  fetchFn: FetchLike = fetch
): Promise<ModelLimits | undefined> {
  // Per-model config override wins over the catalog.
  const override = config?.compaction?.windows?.[model];
  if (override) return override;

  if (cachedCatalog && Date.now() - cachedAt < CACHE_TTL_MS) {
    return lookupLimits(cachedCatalog, model);
  }
  const catalog = await loadCatalog(fetchFn);
  cachedCatalog = catalog;
  cachedAt = Date.now();
  return lookupLimits(catalog, model);
}
