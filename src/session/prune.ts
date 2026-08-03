import type { ModelMessage, ToolResultPart } from "ai";
import type { SessionStore } from "./store";
import type { Session } from "./types";
import type { Config } from "../config";

export const DEFAULT_PRUNE_PROTECT = 40_000;
export const DEFAULT_PRUNE_MINIMUM = 20_000;
export const PRUNE_PLACEHOLDER = "[pruned — see history]";

// opencode's Token.estimate: ~4 chars per token, cheap, no tokenizer.
export function estimateTokens(text: string): number {
  return Math.max(0, Math.round(text.length / 4));
}

export interface PruneTarget {
  msgIndex: number;
  partIndex: number;
  freed: number;
}

export interface PruneSelection {
  targets: PruneTarget[];
  pruned: number;
}

function partText(part: ToolResultPart): string {
  const output = part.output as { type?: string; value?: unknown } | undefined;
  if (!output) return "";
  if (output.type === "text") return String(output.value ?? "");
  return JSON.stringify(output.value ?? output);
}

// Walks backwards from the most recent message. The last `protect` tokens worth
// of tool output are kept; older tool results are selected for pruning. The
// last `protectTurns` turns are never touched (the live working set — the same
// tail compact preserves), and the walk stops at the compaction summary message.
export function selectPruneTargets(
  messages: ModelMessage[],
  protect: number,
  protectTurns = 2
): PruneSelection {
  const targets: PruneTarget[] = [];
  let total = 0;
  let turns = 0;

  for (let msgIndex = messages.length - 1; msgIndex >= 0; msgIndex--) {
    const msg = messages[msgIndex];
    if (msg.role === "user") turns++;
    if (turns < protectTurns) continue;
    if (msg.role === "system") break;
    if (msg.role !== "tool" || !Array.isArray(msg.content)) continue;

    for (let partIndex = msg.content.length - 1; partIndex >= 0; partIndex--) {
      const part = msg.content[partIndex] as Partial<ToolResultPart>;
      if (part.type !== "tool-result") continue;
      const text = partText(part as ToolResultPart);
      if (text === PRUNE_PLACEHOLDER) continue;
      const estimate = estimateTokens(text);
      total += estimate;
      if (total <= protect) continue;
      targets.push({ msgIndex, partIndex, freed: estimate });
    }
  }

  return { targets, pruned: targets.reduce((sum, t) => sum + t.freed, 0) };
}

// Applies a selection in place, replacing outputs with the placeholder.
export function applyPrune(
  messages: ModelMessage[],
  selection: PruneSelection
): number {
  for (const target of selection.targets) {
    const msg = messages[target.msgIndex];
    if (!Array.isArray(msg.content)) continue;
    const part = msg.content[target.partIndex] as Partial<ToolResultPart>;
    part.output = { type: "text", value: PRUNE_PLACEHOLDER } as any;
  }
  return selection.pruned;
}

export interface PruneOptions {
  session: Session;
  store: SessionStore;
  config: Config;
}

// Prunes old tool outputs in memory and persists via the store. Returns true
// when anything was pruned. Commits only when freed tokens exceed the minimum
// (opencode's PRUNE_MINIMUM guard against churn).
export async function pruneSession({
  session,
  store,
  config,
}: PruneOptions): Promise<boolean> {
  if (config.compaction?.prune === false) return false;
  const protect =
    config.compaction?.pruneProtectTokens ?? DEFAULT_PRUNE_PROTECT;
  const minimum =
    config.compaction?.pruneMinimumTokens ?? DEFAULT_PRUNE_MINIMUM;
  const protectTurns = config.compaction?.tailTurns ?? 2;

  const selection = selectPruneTargets(session.messages, protect, protectTurns);
  if (selection.pruned <= minimum || selection.targets.length === 0)
    return false;

  applyPrune(session.messages, selection);
  store.replaceMessages(session.id, session.messages);
  return true;
}
