import { streamText, isStepCount, type ModelMessage } from "ai";
import { resolveModel } from "../llm/providers";
import { getModelLimits, usableTokens } from "../llm/context-window";
import { estimateTokens, pruneSession } from "./prune";
import type { SessionStore } from "./store";
import type { Session } from "./types";
import type { Config } from "../config";
import { emit } from "../events";

export const DEFAULT_TAIL_TURNS = 2;
export const COMPACTION_PROMPT =
  "Summarize this conversation so it can continue. Keep the summary focused on " +
  "what matters for the remaining work: the task, decisions made, and the " +
  "current state of any documents. Do not include tool output details.";

// Summarizes the given history with one plain completion (no tools).
export async function summarize(
  messages: ModelMessage[],
  model: string,
  config: Config
): Promise<string> {
  const result = streamText({
    model: resolveModel(model, config),
    messages: [{ role: "system", content: COMPACTION_PROMPT }, ...messages],
    stopWhen: isStepCount(1),
  });
  return await result.text;
}

// Index of the first message that survives verbatim: everything before it is
// summarized. The last `tailTurns` user turns (and their responses) are kept.
export function tailCutoff(
  messages: ModelMessage[],
  tailTurns: number
): number {
  if (tailTurns <= 0) return 0;
  let turns = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    turns++;
    if (turns >= tailTurns) return i;
  }
  return 0;
}

export interface CompactOptions {
  session: Session;
  store: SessionStore;
  config: Config;
  summarizeFn?: typeof summarize;
}

// Summarizes everything before the tail into one system message. Returns true
// when the history was rewritten.
export async function compactHistory({
  session,
  store,
  config,
  summarizeFn = summarize,
}: CompactOptions): Promise<boolean> {
  const tailTurns = config.compaction?.tailTurns ?? DEFAULT_TAIL_TURNS;
  const cutoff = tailCutoff(session.messages, tailTurns);
  if (cutoff === 0) return false;

  const head = session.messages.slice(0, cutoff);
  const tail = session.messages.slice(cutoff);
  const summary = await summarizeFn(head, session.model, config);

  session.messages = [{ role: "system", content: summary }, ...tail];
  store.replaceMessages(session.id, session.messages);
  emit("session:compacted", { sessionID: session.id });
  return true;
}

export interface MaybeCompactOptions {
  session: Session;
  store: SessionStore;
  config: Config;
  summarizeFn?: typeof summarize;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}

// Trigger point, run at the top of every turn: when the last persisted token
// usage exceeds the model's usable window, prune old tool outputs; if the
// remaining history still exceeds the window, compact it.
export async function maybeCompact({
  session,
  store,
  config,
  summarizeFn,
  fetchFn,
}: MaybeCompactOptions): Promise<void> {
  const usage = store.lastUsage(session.id);
  if (!usage) return;

  const limits = await getModelLimits(session.model, config, fetchFn);
  if (!limits) return; // unknown model: skip, self-heals when the catalog arrives
  const usable = usableTokens(limits, config);
  if (usable <= 0) return;

  const total = usage.inputTokens + usage.outputTokens;
  if (total < usable) return;

  await pruneSession({ session, store, config });

  // Prune is an estimate; re-estimate the surviving history before spending
  // an LLM call on compaction.
  const estimate = estimateTokens(JSON.stringify(session.messages));
  if (estimate < usable) return;

  // ponytail: the summarize call sends the head verbatim, so a history much
  // larger than the context window can still overflow the summary call —
  // opencode solves that with turn-splitting, which ADR 0011 rejects. The
  // failure is swallowed: the turn proceeds un-compacted and retries next turn.
  try {
    await compactHistory({ session, store, config, summarizeFn });
  } catch (error) {
    console.error(`[compaction] summarize failed, skipping: ${error}`);
  }
}
