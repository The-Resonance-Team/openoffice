// Ported from opencode's session/message-v2.ts — the parts ↔ AI SDK ModelMessage
// boundary. opencode emits UIMessages and runs them through
// `convertToModelMessages`; we emit ModelMessage directly (openoffice stores
// parts and hands ModelMessages to the AI SDK).

import type { ModelMessage, TextPart, ToolCallPart, ToolResultPart } from "ai";
import type { CompactionPart, Part, ToolPart, WithParts } from "./parts";

const TOOL_OUTPUT_MAX_CHARS = 2_000;

export function truncateToolOutput(text: string, maxChars?: number): string {
  if (!maxChars || text.length <= maxChars) return text;
  const omitted = text.length - maxChars;
  return `${text.slice(0, maxChars)}\n[Tool output truncated for compaction: omitted ${omitted} chars]`;
}

// ponytail: narrow union matching @ai-sdk/provider-utils' ToolResultOutput,
// limited to the variants the parts model produces; not re-exported by `ai`.
type ToolResultOutput =
  { type: "text"; value: string } | { type: "error-text"; value: string };

function input(value: string | Record<string, unknown>): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toolResultPart(
  part: ToolPart,
  output: ToolResultOutput
): ToolResultPart {
  return {
    type: "tool-result",
    toolCallId: part.callID ?? "",
    toolName: part.tool,
    output,
  };
}

export interface ToModelMessagesOptions {
  toolOutputMaxChars?: number;
}

export function toModelMessages(
  messages: WithParts[],
  options: ToModelMessagesOptions = {}
): ModelMessage[] {
  const maxChars = options.toolOutputMaxChars ?? TOOL_OUTPUT_MAX_CHARS;
  const result: ModelMessage[] = [];

  for (const msg of messages) {
    if (msg.parts.length === 0) continue;

    if (msg.info.role === "user") {
      const content: TextPart[] = [];
      for (const part of msg.parts) {
        if (part.type === "text" && part.text !== "") {
          content.push({ type: "text", text: part.text });
        }
        if (part.type === "compaction") {
          content.push({ type: "text", text: "What did we do so far?" });
        }
      }
      if (content.length > 0) result.push({ role: "user", content });
      continue;
    }

    if (msg.info.role === "assistant") {
      if (msg.info.error) continue;
      const content: Array<TextPart | ToolCallPart> = [];
      const toolResults: ToolResultPart[] = [];
      for (const part of msg.parts) {
        if (part.type === "text") {
          content.push({ type: "text", text: part.text });
        }
        if (part.type === "tool") {
          content.push({
            type: "tool-call",
            toolCallId: part.callID ?? "",
            toolName: part.tool,
            input: input(part.state.input),
          });
          if (part.state.status === "completed") {
            const value = part.state.time?.compacted
              ? "[Old tool result content cleared]"
              : truncateToolOutput(part.state.output, maxChars);
            toolResults.push(toolResultPart(part, { type: "text", value }));
          } else if (part.state.status === "error") {
            toolResults.push(
              toolResultPart(part, {
                type: "error-text",
                value: part.state.error.message,
              })
            );
          }
        }
      }
      if (content.length > 0) {
        result.push({ role: "assistant", content });
        for (const r of toolResults)
          result.push({ role: "tool", content: [r] });
      }
    }
  }

  return result;
}

// Ported from opencode's filterCompacted, adapted to the chronological
// storage order we feed it (opencode feeds newest-first and reverses inside).
// A completed compaction span (`[compaction user, summary assistant]`) is moved
// to the front, followed by the retained tail, then everything newer. Requests
// are allowed to feed the model only what has never been pruned — run off this.
export function filterCompacted(msgs: WithParts[]): WithParts[] {
  const compactionIndex = msgs.findLastIndex(
    (msg) =>
      msg.info.role === "user" &&
      msg.parts.some(
        (part): part is CompactionPart =>
          part.type === "compaction" && part.tail_start_id !== undefined
      )
  );
  if (compactionIndex < 0) return msgs;

  const compaction = msgs[compactionIndex];
  const part = compaction.parts.find(
    (p): p is CompactionPart =>
      p.type === "compaction" && p.tail_start_id !== undefined
  );
  const tail = part?.tail_start_id;
  if (!tail) return msgs;

  const summaryIndex = msgs.findIndex(
    (msg, index) =>
      index > compactionIndex &&
      msg.info.role === "assistant" &&
      msg.info.summary &&
      msg.info.parentID === compaction.info.id
  );
  if (summaryIndex < 0) return msgs;

  const tailIndex = msgs.findIndex((msg) => msg.info.id === tail);
  if (tailIndex < 0 || tailIndex >= compactionIndex) return msgs;

  return [
    ...msgs.slice(compactionIndex, summaryIndex + 1),
    ...msgs.slice(tailIndex, compactionIndex),
    ...msgs.slice(summaryIndex + 1),
  ];
}
