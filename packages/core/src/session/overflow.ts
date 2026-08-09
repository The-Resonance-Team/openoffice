// Ported from opencode's session/overflow.ts. Decides when a session's token
// usage crosses the model's usable context window.

import { maxOutputTokens, type Model } from '../llm/model-limits';

import type { TokenUsage } from './parts';

const COMPACTION_BUFFER = 20_000;

export interface OverflowConfig {
  auto?: boolean;
  reservedTokens?: number;
}

export function usable(
  cfg: OverflowConfig | undefined,
  model: Model,
  outputTokenMax?: number,
): number {
  const context = model.limit.context;
  if (context === 0) return 0;

  const reserved =
    cfg?.reservedTokens ?? Math.min(COMPACTION_BUFFER, maxOutputTokens(model, outputTokenMax));
  return model.limit.input
    ? Math.max(0, model.limit.input - reserved)
    : Math.max(0, context - maxOutputTokens(model, outputTokenMax));
}

export function isOverflow(
  cfg: OverflowConfig | undefined,
  tokens: TokenUsage,
  model: Model,
  outputTokenMax?: number,
): boolean {
  if (cfg?.auto === false) return false;
  if (model.limit.context === 0) return false;

  const count = tokens.input + tokens.output;
  return count >= usable(cfg, model, outputTokenMax);
}
