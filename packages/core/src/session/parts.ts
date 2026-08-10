// Ported from opencode's SessionV1 part model (`@opencode-ai/core/v1/session`,
// reduced to the parts the compaction service touches) and `util/token`.
// Sessions persist as WithParts rows; the AI SDK boundary conversion lives in
// ./ai-messages (ADR 0023).

// The part data model lives in @openoffice/schema; this module keeps the
// behavior over it (estimates, summaries, turn boundaries).
import type { TextPart, ToolPart, WithParts } from '@openoffice/schema';

export type {
  Role,
  ModelRef,
  TokenUsage,
  MessageInfo,
  PartBase,
  TextPart,
  ToolState,
  ToolPart,
  CompactionPart,
  Part,
  WithParts,
} from '@openoffice/schema';

// opencode's Token.estimate: ~4 chars per token, cheap, no tokenizer.
export function estimateTokens(value: unknown): number {
  return Math.max(0, Math.round(JSON.stringify(value).length / 4));
}

export function partText(part: ToolPart): string {
  if (part.state.status === 'completed') return part.state.output;
  if (part.state.status === 'error') return part.state.error.message;
  return '';
}

// A message that carries a summary (the compaction assistant message).
export function isSummaryMessage(message: WithParts): boolean {
  return Boolean(message.info.summary) && Boolean(message.info.finish) && !message.info.error;
}

export function summaryText(message: WithParts): string | undefined {
  const text = message.parts
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
  return text || undefined;
}

export type CompletedCompaction = {
  userIndex: number;
  assistantIndex: number;
  summary: string | undefined;
};

// Compaction pairs in history: a user message holding a compaction part
// followed by a finished summary assistant message.
export function completedCompactions(messages: WithParts[]): CompletedCompaction[] {
  const users = new Map<string, number>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.info.role !== 'user') continue;
    if (!msg.parts.some((part) => part.type === 'compaction')) continue;
    users.set(msg.info.id, i);
  }

  return messages.flatMap((msg, assistantIndex): CompletedCompaction[] => {
    if (msg.info.role !== 'assistant') return [];
    if (!isSummaryMessage(msg)) return [];
    const userIndex = users.get(msg.info.parentID ?? '');
    if (userIndex === undefined) return [];
    return [{ userIndex, assistantIndex, summary: summaryText(msg) }];
  });
}

export interface Turn {
  start: number;
  end: number;
  id: string;
}

export interface Tail {
  start: number;
  id: string;
}

// Turn boundaries: one per user message, ending where the next begins.
export function turns(messages: WithParts[]): Turn[] {
  const result: Turn[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.info.role !== 'user') continue;
    if (msg.parts.some((part) => part.type === 'compaction')) continue;
    result.push({ start: i, end: messages.length, id: msg.info.id });
  }
  for (let i = 0; i < result.length - 1; i++) {
    result[i].end = result[i + 1].start;
  }
  return result;
}
