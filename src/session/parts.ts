// Ported from opencode's SessionV1 part model (`@opencode-ai/core/v1/session`,
// reduced to the parts the compaction service touches) and `util/token`.
// Sessions persist as WithParts rows; the AI SDK boundary conversion lives in
// ./ai-messages (ADR 0023).

export type Role = "user" | "assistant" | "tool" | "system";

export interface ModelRef {
  providerID: string;
  modelID: string;
  variant?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface MessageInfo {
  id: string;
  role: Role;
  parentID?: string;
  agent?: string;
  model?: ModelRef;
  summary?: boolean;
  finish?: "done" | "error";
  error?: { message: string };
  time: { created: number };
  tokens?: TokenUsage;
}

export interface PartBase {
  id?: string;
  type: string;
  messageID?: string;
  time?: { start?: number; end?: number };
}

export interface TextPart extends PartBase {
  type: "text";
  text: string;
  synthetic?: boolean;
  metadata?: Record<string, unknown>;
}

export type ToolState =
  | {
      status: "pending";
      input: string | Record<string, unknown>;
      time?: { compacted?: number };
    }
  | {
      status: "completed";
      input: string | Record<string, unknown>;
      output: string;
      time?: { compacted?: number };
    }
  | {
      status: "error";
      input: string | Record<string, unknown>;
      error: { message: string };
      time?: { compacted?: number };
    };

export interface ToolPart extends PartBase {
  type: "tool";
  tool: string;
  callID?: string;
  state: ToolState;
}

export interface CompactionPart extends PartBase {
  type: "compaction";
  auto: boolean;
  overflow?: boolean;
  tail_start_id?: string;
}

export type Part = TextPart | ToolPart | CompactionPart;

export interface WithParts {
  info: MessageInfo;
  parts: Part[];
}

// opencode's Token.estimate: ~4 chars per token, cheap, no tokenizer.
export function estimateTokens(value: unknown): number {
  return Math.max(0, Math.round(JSON.stringify(value).length / 4));
}

export function partText(part: ToolPart): string {
  if (part.state.status === "completed") return part.state.output;
  if (part.state.status === "error") return part.state.error.message;
  return "";
}

// A message that carries a summary (the compaction assistant message).
export function isSummaryMessage(message: WithParts): boolean {
  return (
    Boolean(message.info.summary) &&
    Boolean(message.info.finish) &&
    !message.info.error
  );
}

export function summaryText(message: WithParts): string | undefined {
  const text = message.parts
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n")
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
export function completedCompactions(
  messages: WithParts[]
): CompletedCompaction[] {
  const users = new Map<string, number>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.info.role !== "user") continue;
    if (!msg.parts.some((part) => part.type === "compaction")) continue;
    users.set(msg.info.id, i);
  }

  return messages.flatMap((msg, assistantIndex): CompletedCompaction[] => {
    if (msg.info.role !== "assistant") return [];
    if (!isSummaryMessage(msg)) return [];
    const userIndex = users.get(msg.info.parentID ?? "");
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
    if (msg.info.role !== "user") continue;
    if (msg.parts.some((part) => part.type === "compaction")) continue;
    result.push({ start: i, end: messages.length, id: msg.info.id });
  }
  for (let i = 0; i < result.length - 1; i++) {
    result[i].end = result[i + 1].start;
  }
  return result;
}
