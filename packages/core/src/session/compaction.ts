// Ported from opencode's session/compaction.ts (packages/opencode), flattened
// onto openoffice's plain async style — the opencode module is an Effect
// service with 8 DI deps (plugins, processor, event bridge, runtime flags);
// openoffice has none of those, so deps are passed explicitly and the plugin
// hooks / replay / auto-continue machinery is dropped (see ADR 0023).

import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import type { Config } from "../config";
import type { AgentRegistry } from "../agent/registry";
import { getModel, type Model } from "../llm/model-limits";

import type { SessionStore } from "./store";
import {
  completedCompactions,
  estimateTokens,
  type CompactionPart,
  type MessageInfo,
  type ModelRef,
  type ToolPart,
  type WithParts,
} from "./parts";
import { toModelMessages } from "./ai-messages";
import { usable } from "./overflow";

export const PRUNE_MINIMUM = 20_000;
export const PRUNE_PROTECT = 40_000;
const TOOL_OUTPUT_MAX_CHARS = 2_000;
const PRUNE_PROTECTED_TOOLS = ["skill"];
const DEFAULT_TAIL_TURNS = 2;
const MIN_PRESERVE_RECENT_TOKENS = 2_000;
const MAX_PRESERVE_RECENT_TOKENS = 8_000;

export interface Turn {
  start: number;
  end: number;
  id: string;
}

export interface Tail {
  start: number;
  id: string;
}

// ~4 chars per token, cheap, no tokenizer (opencode's Token.estimate).
function estimate(messages: WithParts[]): number {
  return estimateTokens(JSON.stringify(toModelMessages(messages)));
}

function preserveRecentBudget(cfg: Config, model: Model): number {
  return (
    cfg.compaction?.preserveRecentTokens ??
    Math.min(
      MAX_PRESERVE_RECENT_TOKENS,
      Math.max(
        MIN_PRESERVE_RECENT_TOKENS,
        Math.floor(usable(cfg.compaction, model) * 0.25)
      )
    )
  );
}

async function splitTurn(input: {
  messages: WithParts[];
  turn: Turn;
  budget: number;
}): Promise<Tail | undefined> {
  if (input.budget <= 0) return undefined;
  if (input.turn.end - input.turn.start <= 1) return undefined;
  for (let start = input.turn.start + 1; start < input.turn.end; start++) {
    const size = estimate(input.messages.slice(start, input.turn.end));
    if (size > input.budget) continue;
    return { start, id: input.messages[start].info.id };
  }
  return undefined;
}

export interface SelectResult {
  head: WithParts[];
  tail_start_id: string | undefined;
}

// Which older turns to send to the summarizer: everything except the most
// recent turns, bounded by the preserve-recent budget. The tail (the turns
// that still fit) is retained verbatim for the request side.
export async function select(input: {
  messages: WithParts[];
  cfg: Config;
  model: Model;
}): Promise<SelectResult> {
  const limit = input.cfg.compaction?.tailTurns ?? DEFAULT_TAIL_TURNS;
  if (limit <= 0) return { head: input.messages, tail_start_id: undefined };
  const budget = preserveRecentBudget(input.cfg, input.model);

  const all: Turn[] = [];
  for (let i = 0; i < input.messages.length; i++) {
    const msg = input.messages[i];
    if (msg.info.role !== "user") continue;
    if (msg.parts.some((part) => part.type === "compaction")) continue;
    all.push({ start: i, end: input.messages.length, id: msg.info.id });
  }
  for (let i = 0; i < all.length - 1; i++) {
    all[i].end = all[i + 1].start;
  }
  if (!all.length) return { head: input.messages, tail_start_id: undefined };

  const recent = all.slice(-limit);
  const sizes = await Promise.all(
    recent.map((turn) => estimate(input.messages.slice(turn.start, turn.end)))
  );

  let total = 0;
  let keep: Tail | undefined;
  for (let i = recent.length - 1; i >= 0; i--) {
    const turn = recent[i];
    const size = sizes[i];
    if (total + size <= budget) {
      total += size;
      keep = { start: turn.start, id: turn.id };
      continue;
    }
    const remaining = budget - total;
    const split = await splitTurn({
      messages: input.messages,
      turn,
      budget: remaining,
    });
    if (split) keep = split;
    else if (!keep)
      console.warn("[compaction] tail fallback", { budget, size, total });
    break;
  }

  if (!keep || keep.start === 0)
    return { head: input.messages, tail_start_id: undefined };
  return {
    head: input.messages.slice(0, keep.start),
    tail_start_id: keep.id,
  };
}

// Goes backwards through parts until there are PRUNE_PROTECT tokens worth of
// tool calls, then erases the output of older tool calls to free context
// space. The erase is a marker on the part (`time.compacted`) — the request
// side substitutes a placeholder via ai-messages.
export function prune(messages: WithParts[], cfg: Config): ToolPart[] {
  if (!cfg.compaction?.prune) return [];
  const protect = cfg.compaction.pruneProtectTokens ?? PRUNE_PROTECT;
  const minimum = cfg.compaction.pruneMinimumTokens ?? PRUNE_MINIMUM;

  let total = 0;
  let pruned = 0;
  const toPrune: ToolPart[] = [];
  let turns = 0;

  outer: for (let msgIndex = messages.length - 1; msgIndex >= 0; msgIndex--) {
    const msg = messages[msgIndex];
    if (msg.info.role === "user") turns++;
    if (turns < 2) continue;
    if (msg.info.role === "assistant" && msg.info.summary) break outer;
    for (let partIndex = msg.parts.length - 1; partIndex >= 0; partIndex--) {
      const part = msg.parts[partIndex];
      if (part.type !== "tool") continue;
      if (part.state.status !== "completed") continue;
      if (PRUNE_PROTECTED_TOOLS.includes(part.tool)) continue;
      if (part.state.time?.compacted) break outer;
      const estimate = estimateTokens(part.state.output);
      total += estimate;
      if (total <= protect) continue;
      pruned += estimate;
      toPrune.push(part);
    }
  }

  if (pruned > minimum) return toPrune;
  return [];
}

// Marks the parts returned by `prune` as compacted and persists the marker
// (`state.time.compacted`) that ai-messages substitutes a placeholder for.
export function applyPrune(
  store: SessionStore,
  sessionID: string,
  parts: ToolPart[]
): void {
  for (const part of parts) {
    part.state.time = { compacted: Date.now() };
    store.updatePart(sessionID, part.messageID ?? "", part);
  }
}

export function create(
  input: {
    sessionID: string;
    agent: string;
    model: ModelRef;
    auto: boolean;
    overflow?: boolean;
  },
  store: SessionStore
): string {
  const id = randomUUID();
  store.updateMessage(input.sessionID, {
    id,
    role: "user",
    agent: input.agent,
    model: input.model,
    time: { created: Date.now() },
  });
  store.updatePart(input.sessionID, id, {
    type: "compaction",
    auto: input.auto,
    overflow: input.overflow,
  });
  return id;
}

export interface ProcessInput {
  sessionID: string;
  parentID: string;
  messages: WithParts[];
  model: string;
  auto: boolean;
  overflow?: boolean;
}

export interface ProcessResult {
  result: "continue" | "stop";
  summaryMessageID?: string;
}

export interface CompactionDeps {
  store: SessionStore;
  config: Config;
  agents: AgentRegistry;
  chat: (
    options: {
      model: string;
      messages: ModelMessage[];
      system?: string;
      maxSteps?: number;
    },
    config: Config
  ) => {
    textStream: AsyncIterable<string>;
    usage: PromiseLike<
      { inputTokens?: number; outputTokens?: number } | undefined
    >;
  };
  summarizeFn?: (input: {
    model: string;
    messages: ModelMessage[];
    prompt: string;
    system?: string;
    config: Config;
  }) => Promise<string>;
}

// Summarizes the history into a new anchored summary. On failure (provider
// error, empty output) the summary assistant message is marked errored and
// the turn stops — the session keeps its full history untouched.
export async function process(
  input: ProcessInput,
  deps: CompactionDeps
): Promise<ProcessResult> {
  const { store, config, agents, chat } = deps;
  const parent = input.messages.findLast((m) => m.info.id === input.parentID);
  if (!parent || parent.info.role !== "user") {
    throw new Error(
      `Compaction parent must be a user message: ${input.parentID}`
    );
  }
  const compactionPart = parent.parts.find(
    (p): p is CompactionPart => p.type === "compaction"
  );
  const parentModel = parent.info.model;

  const history =
    compactionPart && input.messages.at(-1)?.info.id === input.parentID
      ? input.messages.slice(0, -1)
      : input.messages;
  const prior = completedCompactions(history);
  const hidden = new Set(
    prior.flatMap((item) => [item.userIndex, item.assistantIndex])
  );
  const previousSummary = prior.at(-1)?.summary;
  const selected = await select({
    messages: history.filter((_, index) => !hidden.has(index)),
    cfg: config,
    model: splitModelFor(input.model),
  });

  const agent = agents.get("compaction");
  const nextPrompt = buildPrompt({ previousSummary, context: [] });
  const msgs = structuredClone(selected.head);
  const modelMessages = toModelMessages(msgs, {
    toolOutputMaxChars: TOOL_OUTPUT_MAX_CHARS,
  });

  const summaryID = randomUUID();
  const info: MessageInfo = {
    id: summaryID,
    role: "assistant",
    parentID: input.parentID,
    agent: "compaction",
    model: parentModel,
    summary: true,
    finish: "error",
    time: { created: Date.now() },
  };
  store.updateMessage(input.sessionID, info);

  try {
    let text: string;
    let inputTokens: number;
    let outputTokens: number;

    if (deps.summarizeFn) {
      text = await deps.summarizeFn({
        model: input.model,
        messages: modelMessages,
        prompt: nextPrompt,
        system: agent?.system,
        config,
      });
      inputTokens = 0;
      outputTokens = estimateTokens(text);
    } else {
      const result = await summarize({
        model: input.model,
        messages: modelMessages,
        prompt: nextPrompt,
        system: agent?.system,
        config,
        chat,
      });
      text = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    }

    if (!text.trim()) {
      info.error = { message: "Summary output was empty" };
      store.updateMessage(input.sessionID, info);
      return { result: "stop" };
    }

    store.updateMessage(input.sessionID, {
      ...info,
      finish: "done",
      tokens: { input: inputTokens, output: outputTokens },
    });
    store.updatePart(input.sessionID, summaryID, {
      type: "text",
      text,
      time: { start: Date.now(), end: Date.now() },
    });

    if (
      compactionPart &&
      selected.tail_start_id &&
      compactionPart.tail_start_id !== selected.tail_start_id
    ) {
      store.updatePart(input.sessionID, input.parentID, {
        ...compactionPart,
        tail_start_id: selected.tail_start_id,
      });
    }
    return { result: "continue", summaryMessageID: summaryID };
  } catch (error) {
    info.error = {
      message:
        error instanceof Error &&
        /context|length|too large/i.test(error.message)
          ? "Conversation history too large to compact - exceeds model context limit"
          : error instanceof Error
            ? error.message
            : String(error),
    };
    store.updateMessage(input.sessionID, info);
    return { result: "stop" };
  }
}

async function summarize(args: {
  model: string;
  messages: ModelMessage[];
  prompt: string;
  system?: string;
  config: Config;
  chat: CompactionDeps["chat"];
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const result = args.chat(
    {
      model: args.model,
      messages: [
        ...args.messages,
        { role: "user", content: [{ type: "text", text: args.prompt }] },
      ],
      system: args.system,
      maxSteps: 1,
    },
    args.config
  );
  let text = "";
  for await (const chunk of result.textStream) {
    text += chunk;
  }
  const usage = await result.usage;
  return {
    text,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
  };
}

function splitModelFor(model: string): Model {
  return getModel(model);
}

// Anchored summary template + buildPrompt, ported from opencode's
// packages/core/src/session/compaction.ts.
const SUMMARY_OUTPUT_TOKENS = 4_096;
const SUMMARY_TEMPLATE = `Output exactly the Markdown structure shown inside <template> and keep the section order unchanged. Do not include the <template> tags in your response.
<template>
## Objective
- [one or two brief sentences describing what the user is trying to accomplish]

## Important Details
- [constraints/preferences, decisions and why, important facts/assumptions, exact context needed to continue, or "(none)"]

## Work State
### Completed
- [finished work, verified facts, or changes made; otherwise "(none)"]

### Active
- [current work, partial changes, or investigation state; otherwise "(none)"]

### Blocked
- [blockers, failing commands, or unknowns; otherwise "(none)"]

## Next Move
1. [immediate concrete action, or "(none)"]
2. [next action if known, or "(none)"]

## Relevant Files
- [file or directory path: why it matters, or "(none)"]
</template>

Rules:
- Keep every section, even when empty.
- Use terse bullets, not prose paragraphs.
- Preserve exact file paths, symbols, commands, error strings, URLs, and identifiers when known.
- Do not mention the summary process or that context was compacted.`;

export const buildPrompt = (input: {
  previousSummary?: string;
  context: readonly string[];
}): string =>
  [
    input.previousSummary
      ? `Update the anchored summary below using the conversation history above.\nPreserve still-true details, remove stale details, and merge in the new facts.\n<previous-summary>\n${input.previousSummary}\n</previous-summary>`
      : "Create a new anchored summary from the conversation history.",
    SUMMARY_TEMPLATE,
    ...input.context,
  ].join("\n\n");

export { SUMMARY_OUTPUT_TOKENS };
